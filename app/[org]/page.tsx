import Link from "next/link";
import Avatar from "@/components/Avatar";
import PageHero, { HeroLink } from "@/components/PageHero";
import UnifiedVideoCard from "@/components/UnifiedVideoCard";
import { channelVideos } from "@/lib/videoDb";
import SectionHeader from "@/components/SectionHeader";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EventCard from "@/components/EventCard";
import TrackedEventRow from "@/components/TrackedEventRow";
import YoutubeEventTile from "@/components/YoutubeEventTile";
import StreamethOrphanTile from "@/components/StreamethOrphanTile";
import {
  getOrganization,
  getOrgSessionCount,
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
import { organizationJsonLd, truncate } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

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
      description: truncate(
        org.description || `Talks, panels and livestreams from ${org.name} events in the StreamETH video archive.`,
        200
      ),
      image: org.banner ?? org.logo,
      path: `/${org.slug}`,
    });
  }
  const entry = getDirectoryEntry(orgSlug);
  if (!entry) return {};
  return buildMetadata({
    title: `${entry.name} — StreamETH`,
    description: `Talks, panels and livestreams from ${entry.name} in the StreamETH video archive.`,
    path: `/${entry.slug}`,
  });
}

const VIDEOS_PAGE_SIZE = 36;

export default async function OrgPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { org: orgSlug } = await params;
  const query = await searchParams;
  const tab = query.tab === "videos" ? "videos" : "events";
  const page = Math.max(1, Number(query.page) || 1);
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

    const totalVideos = getOrgSessionCount(org._id) + extraVideos.length;

    return (
      <div style={accentStyle(org.accentColor) as CSSProperties | undefined} className="flex flex-1 flex-col">
        <JsonLd
          data={organizationJsonLd({
            name: org.name,
            path: `/${org.slug}`,
            description: org.description,
            logo: org.logo,
            location: org.location,
            website: org.url,
          })}
        />
        <PageHero
          leading={<Avatar name={org.name} channel className="h-16 w-16 text-xl sm:h-32 sm:w-32 sm:text-4xl" />}
          title={org.name}
          meta={
            <>
              @{org.slug} • {totalVideos.toLocaleString()} videos • {tiles.length}{" "}
              {tiles.length === 1 ? "event" : "events"}
            </>
          }
          description={org.description}
          actions={
            directoryEntry?.youtubeChannel && (
              <HeroLink href={directoryEntry.youtubeChannel}>YouTube channel</HeroLink>
            )
          }
          tabs={channelTabs(org.slug, tab)}
        />

        {tab === "videos" ? (
          <ChannelVideos slug={org.slug} page={page} />
        ) : (
        <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
          {tiles.length === 0 ? (
            <p className="rounded-2xl bg-panel py-12 text-center text-sm text-ink-faint ring-1 ring-line">
              No events here yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-10 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
    <div className="flex flex-1 flex-col">
      <JsonLd
        data={organizationJsonLd({
          name: entry.name,
          path: `/${entry.slug}`,
          location: entry.location ?? undefined,
          website: entry.website ?? undefined,
        })}
      />
      <PageHero
        leading={<Avatar name={entry.name} channel className="h-16 w-16 text-xl sm:h-32 sm:w-32 sm:text-4xl" />}
        title={entry.name}
        meta={[
          `@${entry.slug}`,
          entry.location,
          videos.length > 0 ? `${videos.length.toLocaleString()} videos` : "",
        ]
          .filter(Boolean)
          .join(" • ")}
        description={
          entry.onStreamETH && videos.length === 0
            ? "Has a StreamETH page, but no public sessions yet."
            : undefined
        }
        actions={
          (entry.website || entry.youtubeChannel) && (
            <>
              {entry.website && <HeroLink href={entry.website}>Website</HeroLink>}
              {entry.youtubeChannel && (
                <HeroLink href={entry.youtubeChannel}>YouTube channel</HeroLink>
              )}
            </>
          )
        }
        tabs={videos.length > 0 ? channelTabs(entry.slug, tab) : undefined}
      />

      {tab === "videos" && videos.length > 0 ? (
        <ChannelVideos slug={entry.slug} page={page} />
      ) : (
      <div className="flex flex-1 flex-col gap-12 px-4 py-6 sm:px-6">
        {videoGroups.length > 0 && (
          <div className="flex flex-col gap-6">
            <SectionHeader title="Events" detail={`${videoGroups.length} grouped from the channel's uploads`} />
            <div className="grid grid-cols-1 gap-x-4 gap-y-10 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {videoGroups.map((group) => (
                <YoutubeEventTile key={group.slug} orgSlug={entry.slug} group={group} />
              ))}
            </div>
          </div>
        )}

        {trackedEvents.length > 0 && (
          <div className="flex flex-col gap-4">
            <SectionHeader
              title="Side events"
              detail={`Community-tracked events around ${entry.name}. Not official programming, and not recorded.`}
            />
            <div className="overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
              {trackedEvents.map((e) => (
                <TrackedEventRow key={e.id} event={e} />
              ))}
            </div>
          </div>
        )}

        {!hasAnyContent && (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-panel px-6 py-14 text-center ring-1 ring-line">
            <p className="text-lg font-bold tracking-[-0.01em] text-ink">No recordings yet</p>
            <p className="max-w-md text-sm text-ink-dim">
              We track {entry.name}, but haven&apos;t found any published talks or side events for it.
            </p>
            <Link
              href="/channels"
              className="mt-2 rounded-full bg-stage px-5 py-2.5 text-sm font-semibold text-stage-ink transition-colors hover:bg-accent"
            >
              Browse other channels
            </Link>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function channelTabs(slug: string, tab: "events" | "videos") {
  return [
    { label: "Events", href: `/${slug}`, active: tab === "events" },
    { label: "Videos", href: `/${slug}?tab=videos`, active: tab === "videos" },
  ];
}

function ChannelVideos({ slug, page }: { slug: string; page: number }) {
  const { videos, total } = channelVideos(slug, page * VIDEOS_PAGE_SIZE);
  return (
    <div className="flex flex-col px-4 pb-12 pt-6 sm:px-6">
      <div className="grid grid-cols-1 gap-x-4 gap-y-10 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {videos.map((v) => (
          <UnifiedVideoCard key={v.id} video={v} hideChannel />
        ))}
      </div>
      {videos.length < total && (
        <div className="flex justify-center pt-10">
          <Link
            href={`/${slug}?tab=videos&page=${page + 1}`}
            scroll={false}
            className="rounded-full bg-panel-raised px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-panel-hover"
          >
            Show more
          </Link>
        </div>
      )}
    </div>
  );
}
