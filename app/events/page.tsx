import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import EventTile from "@/components/EventTile";
import { listRecentEvents } from "@/lib/events";
import { formatDateShort } from "@/lib/format";

export const metadata: Metadata = {
  title: "Events — StreamETH",
  description: "Conferences and meetups in the archive, newest first.",
};

const PAGE_SIZE = 48;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const all = listRecentEvents();
  const shown = all.slice(0, page * PAGE_SIZE);

  return (
    <div className="flex flex-1 flex-col">
      <PageHero title="Events" meta={`${all.length.toLocaleString()} events • newest talks first`} />
      <div className="flex flex-1 flex-col px-4 pb-12 pt-6 sm:px-6">
        <div className="grid grid-cols-1 gap-x-4 gap-y-10 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((e) => (
            <EventTile
              key={e.key}
              href={e.href}
              cover={e.cover}
              title={e.name}
              count={e.talkCount}
              channel={e.channelName}
              when={e.latest ? formatDateShort(e.latest) : undefined}
              where={e.location}
            />
          ))}
        </div>
        {shown.length < all.length && (
          <div className="flex justify-center pt-10">
            <Link
              href={`/events?page=${page + 1}`}
              scroll={false}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent/40"
            >
              Show more
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
