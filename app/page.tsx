import Link from "next/link";
import BrowseControls from "@/components/BrowseControls";
import HomeSearchHero from "@/components/HomeSearchHero";
import SessionCarousel from "@/components/SessionCarousel";
import VideoCard from "@/components/VideoCard";
import { browseSessions, topAutoLabels } from "@/lib/browse";
import { EMPTY_FILTERS, filtersFromParams, paramsFromFilters } from "@/lib/browseParams";
import { listAllEvents, listAllSessions, listOrganizations, getOrgForEvent } from "@/lib/data";

const PAGE_SIZE = 48;
const CAROUSEL_SIZE = 16;

function isIdle(filters: ReturnType<typeof filtersFromParams>): boolean {
  return (
    !filters.q.trim() &&
    filters.orgIds.length === 0 &&
    filters.eventIds.length === 0 &&
    !filters.speaker &&
    !filters.topic &&
    !filters.duration &&
    !filters.dateFrom &&
    !filters.dateTo
  );
}

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

  const organizations = listOrganizations();
  const events = listAllEvents();
  const eventById = new Map(events.map((e) => [e._id, e]));
  const orgById = new Map(organizations.map((o) => [o._id, o]));

  if (isIdle(filters)) {
    const highlights = browseSessions(EMPTY_FILTERS).slice(0, CAROUSEL_SIZE);

    return (
      <div className="mx-auto flex w-full max-w-[1600px] min-h-[calc(100vh-53px)] flex-col gap-10 px-4 py-6 sm:px-6">
        <div className="flex flex-1 items-center justify-center">
          <HomeSearchHero />
        </div>
        <SessionCarousel
          title="Recently added"
          sessions={highlights}
          eventById={eventById}
          orgById={orgById}
        />
      </div>
    );
  }

  const topics = topAutoLabels(listAllSessions());
  const results = browseSessions(filters);
  const shown = results.slice(0, page * PAGE_SIZE);
  const hasMore = shown.length < results.length;

  const moreParams = paramsFromFilters(filters);
  moreParams.set("page", String(page + 1));

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <BrowseControls
          filters={filters}
          organizations={organizations}
          events={events}
          topics={topics}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-ink-faint">
          {results.length.toLocaleString()} video{results.length === 1 ? "" : "s"}
        </p>
        <Link
          href="/search"
          className="font-mono text-xs text-ink-faint underline-offset-2 hover:text-ink-dim hover:underline"
        >
          Search transcripts &amp; YouTube →
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-faint">
          No videos match your search.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((s) => (
            <VideoCard
              key={s._id}
              session={s}
              event={eventById.get(s.eventId)}
              org={getOrgForEvent(eventById.get(s.eventId))}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <Link
          href={`/?${moreParams.toString()}`}
          scroll={false}
          className="mx-auto rounded-md border border-line px-4 py-2 text-sm text-ink-dim hover:bg-panel hover:text-ink"
        >
          Load more
        </Link>
      )}
    </div>
  );
}
