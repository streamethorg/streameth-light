import Link from "next/link";
import type { Metadata } from "next";
import BrowseControls from "@/components/BrowseControls";
import UnifiedVideoCard from "@/components/UnifiedVideoCard";
import AskBox from "@/components/AskBox";
import NewTalks from "@/components/NewTalks";
import { newTalksByEvent } from "@/lib/events";
import { browseVideos, listChannelOptions, topTopics } from "@/lib/videoDb";
import { filtersFromParams, isIdleFilters, paramsFromFilters } from "@/lib/browseParams";
import { listAllEvents, listOrganizations } from "@/lib/data";

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
const NEW_GROUPS = 12;

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

  // Home: ask the archive, then what's new. A typed search (or any filter)
  // switches to the keyword results list below.
  if (isIdleFilters(filters)) {
    const ask = typeof rawParams.ask === "string" ? rawParams.ask.slice(0, 500) : "";
    const { days, since, groups } = newTalksByEvent();
    const totalNew = groups.reduce((n, g) => n + g.videos.length, 0);

    return (
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-10 px-4 pb-16 sm:px-6">
        <AskBox key={ask} initialQuestion={ask} />

        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <h2 className="text-lg font-bold text-ink">
              New {days === 7 ? "this week" : "this month"}
              <span className="tabular ml-2 text-sm font-normal text-ink-faint">
                {totalNew.toLocaleString()} {totalNew === 1 ? "talk" : "talks"} from {groups.length}{" "}
                {groups.length === 1 ? "event" : "events"}
              </span>
            </h2>
            <Link href="/events" className="shrink-0 text-sm font-medium text-ink-dim hover:text-accent">
              All events →
            </Link>
          </div>
          {groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-dim">Nothing new in the past month.</p>
          ) : (
            <NewTalks groups={groups.slice(0, NEW_GROUPS)} />
          )}
          {groups.length > NEW_GROUPS && (
            <Link
              href={`/?from=${new Date(since).toISOString().slice(0, 10)}`}
              className="self-center rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:border-accent/40"
            >
              See all new talks
            </Link>
          )}
        </section>
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
    <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-6 px-4 py-6 sm:px-6">
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
            className="rounded-lg border border-accent/30 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/5"
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
        className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40"
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
