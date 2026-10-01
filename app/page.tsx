import Link from "next/link";
import BrowseControls from "@/components/BrowseControls";
import UnifiedVideoCard from "@/components/UnifiedVideoCard";
import ChipBar from "@/components/ChipBar";
import EventShelf from "@/components/EventShelf";
import { listRecentEvents } from "@/lib/events";
import { browseVideos, listChannelOptions, topTopics } from "@/lib/videoDb";
import { EMPTY_FILTERS, filtersFromParams, isIdleFilters, paramsFromFilters } from "@/lib/browseParams";
import { listAllEvents, listOrganizations } from "@/lib/data";

const HOME_PAGE_SIZE = 36;
const RESULTS_PAGE_SIZE = 30;

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
  const topics = topTopics(14);

  // YouTube's home: a topic chip bar over a grid of the newest videos. A
  // chip narrows the grid in place; only a typed search (or the advanced
  // filters) switches to the results list below.
  const onlyTopic = isIdleFilters({ ...filters, topic: "" });
  if (onlyTopic) {
    const feed = browseVideos({ ...EMPTY_FILTERS, topic: filters.topic }).filter((v) => v.coverImage);
    const shown = feed.slice(0, page * HOME_PAGE_SIZE);
    const moreParams = new URLSearchParams();
    if (filters.topic) moreParams.set("topic", filters.topic);
    moreParams.set("page", String(page + 1));

    return (
      <div className="flex flex-col">
        <ChipBar topics={topics} active={filters.topic} />
        <div className="px-4 pb-12 pt-6 sm:px-6">
          {shown.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-x-4 gap-y-10 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {shown.map((v, i) => (
                // Even `order` slots for videos leave odd slots for the shelf.
                <div key={v.id} style={{ order: i * 2 }}>
                  <UnifiedVideoCard video={v} />
                </div>
              ))}
              {!filters.topic && (
                // After two rows at every column count: 4 videos on 1–2
                // columns, 6 on 3, 8 on 4.
                <EventShelf
                  events={listRecentEvents(8)}
                  className="order-[7] lg:order-[11] 2xl:order-[15]"
                />
              )}
            </div>
          )}
          {shown.length < feed.length && <ShowMore href={`/?${moreParams.toString()}`} />}
        </div>
      </div>
    );
  }

  const channels = listChannelOptions();
  const events = listAllEvents();
  const orgIdBySlug = Object.fromEntries(listOrganizations().map((o) => [o.slug, o._id]));
  const results = browseVideos(filters);
  const shown = results.slice(0, page * RESULTS_PAGE_SIZE);
  const moreParams = paramsFromFilters(filters);
  moreParams.set("page", String(page + 1));

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-6">
      <BrowseControls
        filters={filters}
        channels={channels}
        events={events}
        orgIdBySlug={orgIdBySlug}
        topics={topics}
      />
      <p className="text-sm text-ink-dim">
        About {results.length.toLocaleString()} {results.length === 1 ? "result" : "results"}
      </p>

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
        className="rounded-full bg-panel-raised px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-panel-hover"
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
        className="mt-3 rounded-full bg-panel-raised px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-panel-hover"
      >
        Back to home
      </Link>
    </div>
  );
}
