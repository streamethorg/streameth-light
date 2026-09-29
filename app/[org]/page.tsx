import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EventCard from "@/components/EventCard";
import TrackedEventRow from "@/components/TrackedEventRow";
import YoutubeEventTile from "@/components/YoutubeEventTile";
import StreamethOrphanTile from "@/components/StreamethOrphanTile";
import {
  getOrganization,
  listEventsForOrg,
  listSessionsForEvent,
} from "@/lib/data";
import { getDirectory, getDirectoryEntry, getTrackedEvents } from "@/lib/directory";
import {
  findMatchingEventName,
  getYoutubeVideosForChannel,
  groupVideosByInferredEvent,
} from "@/lib/youtube";
import {
  getOrphanSessionsForOrg,
  groupSessionsByInferredEvent,
} from "@/lib/orphanSessions";
import { accentStyle } from "@/lib/format";
import { buildMetadata } from "@/lib/social";

export function generateStaticParams() {
  return getDirectory().map((entry) => ({ org: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string }>;
}): Promise<Metadata> {
  const { org: orgSlug } = await params;
  const org = getOrganization(orgSlug);
  if (org) {
    return buildMetadata({
      title: `${org.name} — StreamETH`,
      description: org.description?.slice(0, 200),
      image: org.banner ?? org.logo,
    });
  }
  const entry = getDirectoryEntry(orgSlug);
  if (!entry) return {};
  return buildMetadata({ title: `${entry.name} — StreamETH` });
}

export default async function OrgPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: orgSlug } = await params;
  const org = getOrganization(orgSlug);

  if (org) {
    const events = listEventsForOrg(org._id);
    const directoryEntry = getDirectoryEntry(org.slug);
    const extraVideos = directoryEntry
      ? getYoutubeVideosForChannel(directoryEntry.slug)
      : [];
    const allGroups = groupVideosByInferredEvent(extraVideos, directoryEntry?.slug ?? org.slug);

    // Sessions whose eventId points at a deleted/missing event record (a
    // real gap in the source DB — see scripts/remote-export.mjs) have no
    // real event to attach to. Group them the same way as YouTube uploads so
    // they're still browsable instead of silently invisible.
    const orphanSessions = getOrphanSessionsForOrg(org._id);
    const allSessionGroups = groupSessionsByInferredEvent(orphanSessions, org.slug, org.name);

    // A YouTube upload cluster or an orphaned-session cluster can be the same
    // real-world conference as an existing StreamETH event under a different
    // label (e.g. "Protocol Berg v2: ..." video titles vs. the StreamETH
    // event "Protocol Berg") — merge those into the one real event tile
    // instead of showing the same conference two or three times.
    const eventNames = events.map((e) => e.name);
    const groupByMatchedEventName = new Map<string, (typeof allGroups)[number]>();
    const standaloneGroups: typeof allGroups = [];
    for (const group of allGroups) {
      const match = findMatchingEventName(group.label, eventNames);
      if (match) {
        groupByMatchedEventName.set(match, group);
      } else {
        standaloneGroups.push(group);
      }
    }

    const sessionGroupByMatchedEventName = new Map<
      string,
      (typeof allSessionGroups)[number]
    >();
    const standaloneSessionGroups: typeof allSessionGroups = [];
    for (const group of allSessionGroups) {
      const match = findMatchingEventName(group.label, eventNames);
      if (match) {
        sessionGroupByMatchedEventName.set(match, group);
      } else {
        standaloneSessionGroups.push(group);
      }
    }

    type Tile =
      | {
          kind: "streameth";
          date: number;
          key: string;
          extraGroup?: (typeof allGroups)[number];
          extraSessionGroup?: (typeof allSessionGroups)[number];
        }
      | { kind: "youtube"; date: number; key: string; group: (typeof allGroups)[number] }
      | {
          kind: "orphan";
          date: number;
          key: string;
          group: (typeof allSessionGroups)[number];
        };

    const tiles: Tile[] = [
      ...events.map((event): Tile => ({
        kind: "streameth",
        date: new Date(event.start).getTime(),
        key: event._id,
        extraGroup: groupByMatchedEventName.get(event.name),
        extraSessionGroup: sessionGroupByMatchedEventName.get(event.name),
      })),
      ...standaloneGroups.map((group): Tile => ({
        kind: "youtube",
        date: new Date(group.videos[0].publishedAt ?? 0).getTime(),
        key: group.slug,
        group,
      })),
      ...standaloneSessionGroups.map((group): Tile => ({
        kind: "orphan",
        date: group.sessions[0]?.start ?? 0,
        key: group.slug,
        group,
      })),
    ].sort((a, b) => b.date - a.date);

    return (
      <div
        style={accentStyle(org.accentColor) as CSSProperties | undefined}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6"
      >
        <div className="flex flex-col gap-4">
          <Link
            href="/"
            className="w-fit font-mono text-xs uppercase tracking-wide text-ink-faint transition-colors hover:text-ink-dim"
          >
            ← All channels
          </Link>
          <div className="flex items-center gap-4">
            {org.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logo}
                alt=""
                className="h-12 w-auto max-w-[160px] object-contain object-left"
              />
            )}
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
              {org.name}
            </h1>
          </div>
          {org.description && (
            <p className="max-w-2xl text-sm leading-relaxed text-ink-dim">
              {org.description}
            </p>
          )}
          {directoryEntry?.youtubeChannel && (
            <a
              href={directoryEntry.youtubeChannel}
              target="_blank"
              rel="noreferrer"
              className="w-fit rounded-sm border border-line px-3 py-1.5 font-mono text-xs text-ink-dim transition-colors hover:border-accent/50 hover:text-ink"
            >
              YouTube ↗
            </a>
          )}
        </div>

        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">
            Events
          </h2>
          <span className="font-mono text-xs tabular text-ink-faint">
            {String(tiles.length).padStart(2, "0")} total
          </span>
        </div>

        {tiles.length === 0 ? (
          <p className="py-12 text-center font-mono text-sm text-ink-faint">
            No events found.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((tile) => {
              if (tile.kind === "streameth") {
                const extraCount =
                  (tile.extraGroup?.videos.length ?? 0) +
                  (tile.extraSessionGroup?.sessions.length ?? 0);
                return (
                  <EventCard
                    key={tile.key}
                    event={events.find((e) => e._id === tile.key)!}
                    orgSlug={org.slug}
                    count={listSessionsForEvent(tile.key).length}
                    extraVideoCount={extraCount}
                    fallbackCover={
                      tile.extraGroup?.videos[0]?.thumbnail ??
                      tile.extraSessionGroup?.sessions[0]?.coverImage
                    }
                  />
                );
              }
              if (tile.kind === "youtube") {
                return (
                  <YoutubeEventTile key={tile.key} orgSlug={org.slug} group={tile.group} />
                );
              }
              return (
                <StreamethOrphanTile key={tile.key} orgSlug={org.slug} group={tile.group} />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const entry = getDirectoryEntry(orgSlug);
  if (!entry) notFound();

  const videos = getYoutubeVideosForChannel(entry.slug);
  const videoGroups = groupVideosByInferredEvent(videos, entry.slug);
  const trackedEvents = getTrackedEvents(entry.miraSeriesSlug);
  const hasAnyContent = videos.length > 0 || trackedEvents.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/"
          className="w-fit font-mono text-xs uppercase tracking-wide text-ink-faint transition-colors hover:text-ink-dim"
        >
          ← All channels
        </Link>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
          {entry.name}
        </h1>
        {entry.location && (
          <p className="font-mono text-xs uppercase tracking-wide text-ink-faint">
            {entry.location}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {entry.website && (
            <a
              href={entry.website}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm border border-line px-3 py-1.5 font-mono text-xs text-ink-dim transition-colors hover:border-accent/50 hover:text-ink"
            >
              Website ↗
            </a>
          )}
          {entry.youtubeChannel && (
            <a
              href={entry.youtubeChannel}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm border border-line px-3 py-1.5 font-mono text-xs text-ink-dim transition-colors hover:border-accent/50 hover:text-ink"
            >
              YouTube ↗
            </a>
          )}
          {entry.onStreamETH && (
            <span className="rounded-sm border border-accent/40 px-3 py-1.5 font-mono text-xs text-accent">
              Has a StreamETH page — no public sessions yet
            </span>
          )}
        </div>
      </div>

      {videoGroups.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">
              Events
            </h2>
            <span className="font-mono text-xs tabular text-ink-faint">
              {String(videoGroups.length).padStart(2, "0")} total
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videoGroups.map((group) => (
              <YoutubeEventTile key={group.slug} orgSlug={entry.slug} group={group} />
            ))}
          </div>
        </div>
      )}

      {trackedEvents.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">
              Side events
            </h2>
            <span className="font-mono text-xs tabular text-ink-faint">
              {String(trackedEvents.length).padStart(2, "0")} total
            </span>
          </div>
          <p className="font-mono text-xs text-ink-faint">
            Community-tracked side events happening around {entry.name}, via
            Mira — not official programming, no video.
          </p>
          <div>
            {trackedEvents.map((e) => (
              <TrackedEventRow key={e.id} event={e} />
            ))}
          </div>
        </div>
      )}

      {!hasAnyContent && (
        <p className="py-12 text-center font-mono text-sm text-ink-faint">
          No video archive here yet — no sessions on StreamETH, no YouTube
          channel found, and no side events tracked from other sources.
        </p>
      )}
    </div>
  );
}
