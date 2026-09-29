import Link from "next/link";
import BrowseControls from "@/components/BrowseControls";
import HomeSearchHero from "@/components/HomeSearchHero";
import SessionCarousel from "@/components/SessionCarousel";
import UnifiedVideoCard from "@/components/UnifiedVideoCard";
import { browseVideos, listChannelOptions, topTopics } from "@/lib/videoDb";
import {
  EMPTY_FILTERS,
  filtersFromParams,
  isIdleFilters,
  paramsFromFilters,
} from "@/lib/browseParams";
import { listAllEvents, listOrganizations } from "@/lib/data";

const PAGE_SIZE = 48;
const CAROUSEL_SIZE = 16;

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

  if (isIdleFilters(filters)) {
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
        {filters.q.trim() && (
          <>
            {" "}for <span className="text-ink-dim">“{filters.q.trim()}”</span>
          </>
        )}
      </p>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm font-medium text-ink">No videos match your search.</p>
          <p className="max-w-sm text-sm text-ink-faint">
            Try fewer words, a different spelling, or removing some filters.
          </p>
          <Link
            href="/"
            className="mt-1 rounded-full border border-line px-4 py-1.5 text-sm text-ink-dim transition-colors hover:bg-panel hover:text-ink"
          >
            Start over
          </Link>
        </div>
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
          className="mx-auto rounded-full border border-line px-5 py-2 text-sm text-ink-dim transition-colors hover:bg-panel hover:text-ink"
        >
          Load more · {(results.length - shown.length).toLocaleString()} left
        </Link>
      )}
    </div>
  );
}
