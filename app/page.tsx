import Link from "next/link";
import BrowseControls from "@/components/BrowseControls";
import SessionCarousel from "@/components/SessionCarousel";
import UnifiedVideoCard from "@/components/UnifiedVideoCard";
import StageHero from "@/components/StageHero";
import Avatar from "@/components/Avatar";
import {
  archiveStats,
  browseVideos,
  listChannelOptions,
  channelShelves,
  topTopics,
} from "@/lib/videoDb";
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
    const recent = browseVideos(EMPTY_FILTERS).slice(0, CAROUSEL_SIZE);
    // Feature a full-length talk (not a short clip/teaser) with a real cover.
    const featured = browseVideos({ ...EMPTY_FILTERS, duration: "long" }).find(
      (v) => v.coverImage
    );
    const shelves = channelShelves(5, 12);
    const stats = archiveStats();

    return (
      <div className="flex flex-col">
        <StageHero featured={featured} stats={stats} />

        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-14 px-4 py-12 sm:px-6 sm:py-16">
          <SessionCarousel
            title="Just added"
            detail="The newest recordings across every channel"
            videos={recent.filter((v) => v.id !== featured?.id)}
          />
          {shelves.map((shelf) => (
            <SessionCarousel
              key={shelf.slug}
              title={shelf.name}
              href={`/${shelf.slug}`}
              linkLabel="Open channel"
              detail={`${shelf.total.toLocaleString()} videos`}
              leading={
                <Avatar
                  name={shelf.name}
                  photo={shelf.logo}
                  shape="square"
                  className="h-11 w-11 text-sm"
                />
              }
              videos={shelf.videos}
            />
          ))}
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-panel p-6 ring-1 ring-line sm:flex-row sm:items-center sm:p-8">
            <div>
              <p className="text-lg font-bold tracking-[-0.01em] text-ink">
                Looking for a specific event?
              </p>
              <p className="text-sm text-ink-dim">
                Browse all {stats.channels} channels, from Devcon to your local meetup.
              </p>
            </div>
            <Link
              href="/channels"
              className="rounded-full bg-stage px-5 py-2.5 text-sm font-semibold text-stage-ink transition-colors hover:bg-accent"
            >
              Browse channels
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const topics = topTopics();
  const results = browseVideos(filters);
  const shown = results.slice(0, page * PAGE_SIZE);
  const hasMore = shown.length < results.length;

  const moreParams = paramsFromFilters(filters);
  moreParams.set("page", String(page + 1));

  const query = filters.q.trim();

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h1 className="display text-[clamp(2rem,4vw,3.25rem)] text-ink">
            {query ? `“${query}”` : "All talks"}
          </h1>
          <p className="pb-1 text-sm font-medium text-ink-faint">
            <span className="tabular text-ink">{results.length.toLocaleString()}</span>{" "}
            {results.length === 1 ? "talk" : "talks"}
          </p>
        </div>
        <BrowseControls
          filters={filters}
          channels={channels}
          events={events}
          orgIdBySlug={orgIdBySlug}
          topics={topics}
        />
      </header>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-panel px-6 py-16 text-center ring-1 ring-line">
          <p className="text-lg font-bold tracking-[-0.01em] text-ink">No talks match that.</p>
          <p className="max-w-sm text-sm text-ink-dim">
            Try fewer words, a different spelling, or remove a filter.
          </p>
          <Link
            href="/"
            className="mt-2 rounded-full bg-stage px-5 py-2.5 text-sm font-semibold text-stage-ink transition-colors hover:bg-accent"
          >
            Start over
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-10 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {shown.map((v) => (
            <UnifiedVideoCard key={v.id} video={v} />
          ))}
        </div>
      )}

      {hasMore && (
        <Link
          href={`/?${moreParams.toString()}`}
          scroll={false}
          className="mx-auto rounded-full bg-panel px-6 py-3 text-sm font-semibold text-ink shadow-sm ring-1 ring-line transition-colors hover:bg-stage hover:text-stage-ink hover:ring-stage"
        >
          Show more talks
          <span className="ml-2 font-medium text-ink-faint">
            {(results.length - shown.length).toLocaleString()} left
          </span>
        </Link>
      )}
    </div>
  );
}
