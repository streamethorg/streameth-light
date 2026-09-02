import Link from "next/link";
import BrowseControls from "@/components/BrowseControls";
import HomeSearchHero from "@/components/HomeSearchHero";
import SessionCarousel from "@/components/SessionCarousel";
import UnifiedVideoCard from "@/components/UnifiedVideoCard";
import { browseVideos, listChannelOptions, topTopics } from "@/lib/videoDb";
import { EMPTY_FILTERS, filtersFromParams, paramsFromFilters } from "@/lib/browseParams";
import { listAllEvents, listOrganizations } from "@/lib/data";

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

  const channels = listChannelOptions();
  const events = listAllEvents();
  const orgIdBySlug = Object.fromEntries(listOrganizations().map((o) => [o.slug, o._id]));

  if (isIdle(filters)) {
    const highlights = browseVideos(EMPTY_FILTERS).slice(0, CAROUSEL_SIZE);

    return (
      <div className="mx-auto flex w-full max-w-[1600px] min-h-[calc(100vh-53px)] flex-col gap-10 px-4 py-6 sm:px-6">
        <div className="flex flex-1 items-center justify-center">
          <HomeSearchHero />
        </div>
        <SessionCarousel title="Recently added" videos={highlights} />
      </div>
    );
  }

  const topics = topTopics();
  const results = browseVideos(filters);
  const shown = results.slice(0, page * PAGE_SIZE);
  const hasMore = shown.length < results.length;

  const moreParams = paramsFromFilters(filters);
  moreParams.set("page", String(page + 1));

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <BrowseControls
          filters={filters}
          channels={channels}
          events={events}
          orgIdBySlug={orgIdBySlug}
          topics={topics}
        />
      </div>

      <p className="font-mono text-xs text-ink-faint">
        {results.length.toLocaleString()} video{results.length === 1 ? "" : "s"}
      </p>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-faint">
          No videos match your search.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((v) => (
            <UnifiedVideoCard key={v.id} video={v} />
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
