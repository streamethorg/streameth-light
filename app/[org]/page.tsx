import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Avatar from "@/components/Avatar";
import { HeroLink } from "@/components/PageHero";
import SectionHeader from "@/components/SectionHeader";
import EventCard from "@/components/EventCard";
import EventTile from "@/components/EventTile";
import YoutubeEventTile from "@/components/YoutubeEventTile";
import StreamethOrphanTile from "@/components/StreamethOrphanTile";
import { StatusChip } from "@/components/LiveBlock";
import { getOrganization, listEventsForOrg, listSessionsForEvent, usableImage } from "@/lib/data";
import { getDirectory, getDirectoryEntry } from "@/lib/directory";
import { findMatchingEventName, getYoutubeVideosForChannel, groupVideosByInferredEvent, type InferredEventGroup } from "@/lib/youtube";
import { getOrphanSessionsForOrg, groupSessionsByInferredEvent } from "@/lib/orphanSessions";
import {
  allEventsForChannel,
  eventCoverage,
  eventFormatCounts,
  formatEventDates,
  inCoverageWindow,
  requestTime,
  youtubeGroupHref,
  type SeasonEvent,
} from "@/lib/season";
import { accentStyle } from "@/lib/format";
import { buildMetadata } from "@/lib/social";
import { organizationJsonLd, truncate } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

export function generateStaticParams() {
  return getDirectory().map((entry) => ({ org: entry.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ org: string }> }): Promise<Metadata> {
  const { org: orgSlug } = await params;
  const org = getOrganization(orgSlug);
  if (org) {
    return buildMetadata({
      title: `${org.name} — StreamETH`,
      description: truncate(org.description || `Every ${org.name} edition, with live coverage, recordings and reporting.`, 200),
      image: org.banner ?? org.logo,
      path: `/${org.slug}`,
    });
  }
  const entry = getDirectoryEntry(orgSlug);
  if (!entry) return {};
  return buildMetadata({
    title: `${entry.name} — StreamETH`,
    description: `Every ${entry.name} edition, with live coverage, recordings and reporting.`,
    path: `/${entry.slug}`,
  });
}

const MIN_EDITION_VIDEOS = 3;

type Tile =
  | { kind: "season"; date: number; key: string; event: SeasonEvent }
  | { kind: "streameth"; date: number; key: string; node: ReactNode }
  | { kind: "youtube"; date: number; key: string; group: InferredEventGroup }
  | { kind: "orphan"; date: number; key: string; node: ReactNode };

/** A channel's page: a banner, what the channel is, and every edition —
 * each one opens that edition's coverage page. Editions come from the
 * event calendar (with live coverage pages), StreamETH's own events, and
 * events grouped from the channel's YouTube uploads; an upload group that
 * falls inside a calendar edition's dates is that edition, not a second
 * tile. */
export default async function OrgPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { org: orgSlug } = await params;
  const query = await searchParams;
  const now = requestTime(query.now);
  const org = getOrganization(orgSlug);
  const entry = getDirectoryEntry(orgSlug);
  if (!org && !entry) notFound();

  const slug = org?.slug ?? entry!.slug;
  const name = org?.name ?? entry!.name;
  const seasonEditions = allEventsForChannel(slug);
  const youtubeVideos = entry ? getYoutubeVideosForChannel(entry.slug) : [];
  const allGroups = groupVideosByInferredEvent(youtubeVideos, slug);
  // Upload groups that aren't an edition: the year-by-year catch-alls of
  // unclassified uploads ("Devcon — 2023") go in a small "Other uploads" row.
  const isCatchAll = (g: InferredEventGroup) => {
    const m = g.label.match(/^(.*) — (\d{4}|Undated)$/);
    const base = m?.[1] ?? g.label;
    return base === name || base === entry?.name || base === "More uploads" || base === "Recent uploads";
  };
  const catchAll = allGroups.filter(isCatchAll);
  // A group that is a calendar edition — by name ("Devcon 8 Mumbai 2026" is
  // Devcon 8) or because most of its uploads fall in that edition's dates —
  // folds into the edition's tile, lending it a cover.
  const coverFor = new Map<string, string>();
  const groups = allGroups.filter((g) => {
    if (isCatchAll(g)) return false;
    const edition =
      seasonEditions.find((e) => findMatchingEventName(g.label, [e.name]) === e.name) ??
      seasonEditions.find(
        (e) => g.videos.filter((v) => v.publishedAt && inCoverageWindow(e, Date.parse(v.publishedAt))).length * 2 >= g.videos.length
      );
    if (edition) {
      const thumb = g.videos.find((v) => v.thumbnail)?.thumbnail;
      if (thumb && !coverFor.has(edition.key)) coverFor.set(edition.key, thumb);
      return false;
    }
    // One interview or an explainer isn't an edition.
    return g.videos.length >= MIN_EDITION_VIDEOS;
  });

  const tiles: Tile[] = seasonEditions.map((event) => ({ kind: "season", date: event.from, key: event.key, event }));

  if (org) {
    const events = listEventsForOrg(org._id);
    const eventNames = events.map((e) => e.name);
    // A YouTube upload cluster or an orphaned-session cluster can be the same
    // conference as a StreamETH event under a different label ("Protocol
    // Berg v2: ..." titles vs. the event "Protocol Berg"); fold those into
    // the event's tile.
    const groupFor = new Map<string, InferredEventGroup>();
    const sessionGroups = groupSessionsByInferredEvent(getOrphanSessionsForOrg(org._id), org.slug, org.name);
    const sessionGroupFor = new Map<string, (typeof sessionGroups)[number]>();
    for (const g of groups) {
      const match = findMatchingEventName(g.label, eventNames);
      if (match) groupFor.set(match, g);
      else tiles.push({ kind: "youtube", date: Date.parse(g.videos[0].publishedAt ?? "") || 0, key: g.slug, group: g });
    }
    for (const g of sessionGroups) {
      const match = findMatchingEventName(g.label, eventNames);
      if (match) sessionGroupFor.set(match, g);
      else tiles.push({ kind: "orphan", date: g.sessions[0]?.start ?? 0, key: g.slug, node: <StreamethOrphanTile orgSlug={org.slug} group={g} /> });
    }
    for (const event of events) {
      const extra = groupFor.get(event.name);
      const extraSessions = sessionGroupFor.get(event.name);
      tiles.push({
        kind: "streameth",
        date: Date.parse(event.start) || 0,
        key: event._id,
        node: (
          <EventCard
            event={event}
            orgSlug={org.slug}
            count={listSessionsForEvent(event._id).length}
            extraVideoCount={(extra?.videos.length ?? 0) + (extraSessions?.sessions.length ?? 0)}
            fallbackCover={extra?.videos[0]?.thumbnail ?? extraSessions?.sessions[0]?.coverImage}
          />
        ),
      });
    }
  } else {
    for (const g of groups) {
      tiles.push({ kind: "youtube", date: Date.parse(g.videos[0].publishedAt ?? "") || 0, key: g.slug, group: g });
    }
  }
  tiles.sort((a, b) => b.date - a.date);

  // The newest edition with a picture supplies the banner when the channel
  // has none of its own; same for the description.
  const banner =
    usableImage(org?.banner) ??
    seasonEditions.find((e) => e.imageUrl)?.imageUrl ??
    youtubeVideos.find((v) => v.thumbnail)?.thumbnail ??
    null;
  const description = org?.description?.trim() || seasonEditions.find((e) => e.description)?.description || null;
  const website = org?.url ?? entry?.website ?? null;
  const youtube = entry?.youtubeChannel ?? null;

  return (
    <div style={accentStyle(org?.accentColor) as CSSProperties | undefined} className="flex flex-1 flex-col">
      <JsonLd
        data={organizationJsonLd({
          name,
          path: `/${slug}`,
          description: description ?? undefined,
          logo: org?.logo,
          location: org?.location ?? entry?.location ?? undefined,
          website: website ?? undefined,
        })}
      />

      {banner && (
        <div className="px-4 pt-4 sm:px-8 sm:pt-6">
          <div className="relative h-28 w-full overflow-hidden rounded-sm bg-stage sm:h-36 lg:h-44">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      )}

      {/* Two columns on wide screens: the channel on the left (it stays in
          view), its editions on the right. */}
      <div className="grid grid-cols-1 gap-12 px-4 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] lg:gap-0 lg:divide-x lg:divide-line">
        <section className="flex min-w-0 flex-col gap-4 pt-6 lg:sticky lg:top-16 lg:self-start lg:pr-10 lg:pt-8">
          {/* The channel's own logo when it has one; never a monogram. */}
          {org?.logo && (
            <Avatar name={name} photo={org.logo} channel className="h-16 w-16 border border-line sm:h-20 sm:w-20" />
          )}
          <div className="flex flex-col gap-2">
            <h1 className="headline text-[clamp(2rem,4.5vw,3.25rem)] text-ink">{name}</h1>
            <p className="text-[15px] tabular-nums text-ink-faint">
              {tiles.length} {tiles.length === 1 ? "edition" : "editions"}
              {(org?.location ?? entry?.location) ? ` · ${org?.location ?? entry?.location}` : ""}
            </p>
          </div>
          {description && <p className="whitespace-pre-line text-[17px] leading-7 text-ink-dim">{description}</p>}
          {(website || youtube) && (
            <div className="flex flex-wrap gap-2">
              {website && <HeroLink href={website}>Website</HeroLink>}
              {youtube && <HeroLink href={youtube}>YouTube</HeroLink>}
            </div>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-8 lg:pl-10 lg:pt-8">
          <SectionHeader title="Editions" />
          {tiles.length === 0 ? (
            <p className="py-10 text-center text-ink-dim">No editions on the calendar or in the recordings yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 sm:gap-y-10 2xl:grid-cols-3">
              {tiles.map((tile) => {
                if (tile.kind === "season") {
                  return <SeasonEditionTile key={tile.key} event={tile.event} now={now} fallbackCover={coverFor.get(tile.key)} />;
                }
                if (tile.kind === "youtube") return <YoutubeEventTile key={tile.key} orgSlug={slug} group={tile.group} href={youtubeGroupHref(slug, tile.group.slug)} />;
                return <div key={tile.key}>{tile.node}</div>;
              })}
            </div>
          )}
        {catchAll.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-line pt-6">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-dim">Other uploads</h2>
            <div className="flex flex-wrap gap-2">
              {catchAll.map((g) => (
                <Link
                  key={g.slug}
                  href={youtubeGroupHref(slug, g.slug) ?? `/${slug}/y/${g.slug}`}
                  className="rounded-sm border border-line-strong px-3 py-1.5 text-sm tabular-nums text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  {g.label.replace(/^.* — /, "")}{" "}
                  <span className="text-ink-faint">{g.videos.length}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        </section>
      </div>
    </div>
  );
}

function SeasonEditionTile({ event, now, fallbackCover }: { event: SeasonEvent; now: number; fallbackCover?: string }) {
  const counts = eventFormatCounts(event);
  const recordings = counts.talk + counts.clip + counts.short + counts.stream;
  const cover =
    event.imageUrl ?? eventCoverage(event, 20).find((v) => v.coverImage)?.coverImage ?? fallbackCover ?? null;
  return (
    <EventTile
      href={event.href ?? "#"}
      cover={cover}
      title={event.name}
      count={recordings}
      when={formatEventDates(event)}
      where={event.city ?? undefined}
      badge={statusBadge(event, now)}
    />
  );
}

/** Live and upcoming editions get a chip on their cover; past ones don't. */
function statusBadge(event: SeasonEvent, now: number): ReactNode {
  if (now >= event.from && now < event.to) return <StatusChip event={event} now={now} />;
  if (now < event.from) {
    return (
      <span className="rounded-sm bg-void/90 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink">
        Coming up
      </span>
    );
  }
  return undefined;
}
