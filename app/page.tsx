import Link from "next/link";
import type { Metadata } from "next";
import BrowseControls from "@/components/BrowseControls";
import UnifiedVideoCard from "@/components/UnifiedVideoCard";
import AskBox from "@/components/AskBox";
import CoverageColumn from "@/components/CoverageColumn";
import EventTile from "@/components/EventTile";
import LiveBlock from "@/components/LiveBlock";
import SeasonRail from "@/components/SeasonRail";
import SectionHeader from "@/components/SectionHeader";
import {
  eventCover,
  eventFormatCounts,
  featuredUpcoming,
  formatEventDates,
  liveAndLatest,
  pastCoverage,
  requestTime,
  statusOf,
  upcomingEvents,
} from "@/lib/season";
import { browseVideos, listChannelOptions, topTopics } from "@/lib/videoDb";
import { filtersFromParams, isIdleFilters, paramsFromFilters } from "@/lib/browseParams";
import { listAllEvents, listOrganizations } from "@/lib/data";
import { listRecentEvents } from "@/lib/events";
import { formatDateShort } from "@/lib/format";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const rawParams = await searchParams;
  const urlSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") urlSearchParams.set(key, value);
  }
  const filters = filtersFromParams(urlSearchParams);
  // Every filter/search/page variant canonicalizes to the homepage; search
  // results themselves stay out of the index (thin, endless permutations)
  // while their links are still followed.
  return {
    alternates: { canonical: "/" },
    ...(isIdleFilters(filters) ? {} : { robots: { index: false, follow: true } }),
  };
}

const RESULTS_PAGE_SIZE = 30;
const PAST_COVERAGE = 4;
const MORE_EVENTS = 8;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const urlSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") urlSearchParams.set(key, value);
  }
  const filters = filtersFromParams(urlSearchParams);
  const page = Math.max(1, Number(rawParams.page) || 1);

  // Home, as a front page: the top live (or latest) event beside a column
  // with the next event we'll cover and the ones we just covered, and a
  // rail of what's on and coming up; then more events we covered. A typed search (or any filter)
  // switches to the keyword results list below; ?ask= (e.g. coming back
  // from sign-in) answers a question from the archive.
  if (isIdleFilters(filters)) {
    const ask = typeof rawParams.ask === "string" ? rawParams.ask.slice(0, 500) : "";
    const now = requestTime(rawParams.now);
    const { featured, alsoLive } = liveAndLatest(now, 3);
    // Stories live on their event's page; the top live (or latest) event
    // leads, with its newest story inside.
    const leadEvent = featured[0];
    const upcoming = featuredUpcoming(now);
    const upcomingShown = upcoming && upcoming.key !== leadEvent?.key ? upcoming : undefined;
    // The column lists real calendar events; archive events (whose dates
    // are upload spans) and the rest of the calendar fill "More events".
    const past = pastCoverage(now, PAST_COVERAGE + 1, "calendar")
      .filter((e) => e.key !== leadEvent?.key)
      .slice(0, PAST_COVERAGE);
    const skip = new Set([leadEvent?.key, ...past.map((e) => e.key)]);
    const moreEvents = pastCoverage(now, MORE_EVENTS + skip.size)
      .filter((e) => !skip.has(e.key))
      .slice(0, MORE_EVENTS);
    const covered = [...past, ...moreEvents];
    const shown = new Set(
      [...featured, ...alsoLive, ...covered, ...(upcoming ? [upcoming] : [])].map((e) => e.key)
    );
    const coming = upcomingEvents(now, 10).filter((e) => !shown.has(e.key)).slice(0, 6);
    const live = [...featured.filter((e) => statusOf(e, now) === "live"), ...alsoLive];
    // Archive events' start/end are the span of their uploads, not when the
    // event happened; those show the newest recording's date, as /events does.
    const latestByHref = new Map(listRecentEvents().map((e) => [e.href, e.latest]));
    const eventWhen = (e: (typeof moreEvents)[number]) => {
      if (!e.videoIds) return formatEventDates(e);
      const latest = e.href ? latestByHref.get(e.href) : undefined;
      return formatDateShort(latest || `${e.end}T12:00:00Z`);
    };

    return (
      <div className="flex flex-col gap-14 px-4 pb-20 pt-8 sm:px-8">
        {ask && <AskBox key={ask} initialQuestion={ask} />}

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)_minmax(0,0.72fr)] lg:gap-0 lg:divide-x lg:divide-line">
          <div className="min-w-0 lg:pr-10">
            {leadEvent ? (
              // On phones what's on now and next follows the lead's headline,
              // ahead of its long recordings grid; on desktop it's the right column.
              <LiveBlock
                event={leadEvent}
                now={now}
                variant="lead"
                aside={
                  <div className="flex flex-col gap-6">
                    <SeasonRail now={now} live={live} coming={coming} />
                  </div>
                }
              />
            ) : (
              <>
                <p className="dek text-xl text-ink-dim">Nothing on right now.</p>
                <div className="mt-10 flex flex-col gap-6 lg:hidden">
                  <SeasonRail now={now} live={live} coming={coming} />
                </div>
              </>
            )}
          </div>

          <div className="min-w-0 lg:px-8">
            <CoverageColumn now={now} upcoming={upcomingShown} past={past} />
          </div>

          <aside className="hidden min-w-0 flex-col gap-6 lg:flex lg:pl-8">
            <SeasonRail now={now} live={live} coming={coming} />
          </aside>
        </div>

        {moreEvents.length > 0 && (
          <section className="flex flex-col gap-8">
            <SectionHeader title="More events" href="/events" linkLabel="All events" />
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-4">
              {moreEvents.map((e) => {
                const counts = eventFormatCounts(e);
                return (
                  <EventTile
                    key={e.key}
                    href={e.href ?? `/${e.channelSlug}`}
                    cover={eventCover(e)}
                    title={e.name}
                    count={counts.talk + counts.clip + counts.stream}
                    channel={e.channelName && e.channelName !== e.name ? e.channelName : undefined}
                    when={eventWhen(e)}
                    where={e.city ?? undefined}
                  />
                );
              })}
            </div>
          </section>
        )}
      </div>
    );
  }

  const topics = topTopics(14);
  const channels = listChannelOptions();
  const events = listAllEvents();
  const orgIdBySlug = Object.fromEntries(listOrganizations().map((o) => [o.slug, o._id]));
  const results = browseVideos(filters);
  const shown = results.slice(0, page * RESULTS_PAGE_SIZE);
  const moreParams = paramsFromFilters(filters);
  moreParams.set("page", String(page + 1));

  return (
    <div className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
      <BrowseControls
        filters={filters}
        channels={channels}
        events={events}
        orgIdBySlug={orgIdBySlug}
        topics={topics}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-dim">
          About {results.length.toLocaleString()} {results.length === 1 ? "result" : "results"}
        </p>
        {filters.q.trim().length >= 3 && (
          <Link
            href={`/?ask=${encodeURIComponent(filters.q.trim())}`}
            className="inline-flex h-9 items-center rounded-sm border border-line-strong px-3 text-sm font-medium text-accent transition-colors hover:border-ink-faint"
          >
            Ask AI about “{filters.q.trim()}” →
          </Link>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-6 sm:gap-4">
          {shown.map((v) => (
            <UnifiedVideoCard key={v.id} video={v} layout="row" />
          ))}
        </div>
      )}

      {shown.length < results.length && <ShowMore href={`/?${moreParams.toString()}`} />}
    </div>
  );
}

function ShowMore({ href }: { href: string }) {
  return (
    <div className="flex justify-center pt-10">
      <Link
        href={href}
        scroll={false}
        className="inline-flex h-9 items-center rounded-sm border border-line-strong px-4 text-sm font-medium text-ink transition-colors hover:border-ink-faint"
      >
        Show more
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-24 text-center">
      <p className="text-xl font-semibold text-ink">No results found</p>
      <p className="max-w-sm text-sm text-ink-dim">
        Try different keywords, or remove search filters.
      </p>
      <Link
        href="/"
        className="mt-3 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40"
      >
        Back to home
      </Link>
    </div>
  );
}
