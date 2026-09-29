import Link from "next/link";
import BrowseControls from "@/components/BrowseControls";
import UnifiedVideoCard from "@/components/UnifiedVideoCard";
import StageHero from "@/components/StageHero";
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
import { formatDateShort } from "@/lib/format";

const PAGE_SIZE = 48;
const LATEST_SIZE = 5;
const LEAD_MIN_SECONDS = 10 * 60;

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
    const recent = browseVideos(EMPTY_FILTERS)
      .filter((v) => v.coverImage)
      .slice(0, 40);
    // Lead with a full-length talk rather than a short clip or teaser.
    const lead =
      recent.find((v) => (v.durationSeconds ?? 0) >= LEAD_MIN_SECONDS) ?? recent[0];
    const latest = recent.filter((v) => v !== lead).slice(0, LATEST_SIZE - 1);
    const channelRows = channelShelves(6, 4, { order: "recent" });
    const stats = archiveStats();

    return (
      <div className="flex flex-col">
        <StageHero stats={stats} />

        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-20 px-4 py-14 sm:px-6 sm:py-20">
          {lead && (
            <section className="flex flex-col gap-6">
              <h2 className="text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">
                Latest talks
              </h2>
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 min-[480px]:grid-cols-2 lg:grid-cols-4">
                <div className="min-[480px]:col-span-2 lg:row-span-2">
                  <UnifiedVideoCard video={lead} lead />
                </div>
                {latest.map((v) => (
                  <UnifiedVideoCard key={v.id} video={v} />
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4 pb-4">
              <h2 className="text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">
                Recently active channels
              </h2>
              <Link
                href="/channels"
                className="shrink-0 rounded-sm text-[15px] font-semibold text-accent underline-offset-4 hover:underline"
              >
                All {stats.channels} channels
              </Link>
            </div>
            {channelRows.map((row) => (
              <div
                key={row.slug}
                className="grid gap-6 border-t border-line py-8 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-10"
              >
                <div className="flex flex-col gap-1">
                  <Link
                    href={`/${row.slug}`}
                    className="w-fit rounded-sm text-xl font-bold tracking-[-0.02em] text-ink decoration-accent decoration-2 underline-offset-[5px] hover:underline sm:text-2xl"
                  >
                    {row.name}
                  </Link>
                  <p className="text-sm text-ink-faint">
                    {row.total.toLocaleString()} talks, latest {formatDateShort(row.latest)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4">
                  {row.videos.map((v) => (
                    <UnifiedVideoCard key={v.id} video={v} hideSource />
                  ))}
                </div>
              </div>
            ))}
          </section>
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
