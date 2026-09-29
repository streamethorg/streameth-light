import Link from "next/link";
import EventTile from "./EventTile";
import { formatDateShort } from "@/lib/format";
import type { EventSummary } from "@/lib/events";

/** "New events" shelf, dropped into the home grid the way YouTube drops
 * shelves into its feed. Swipes sideways on phones; on wider screens it
 * shows exactly one grid row, matching the feed's column count. */
export default function EventShelf({
  events,
  className = "",
  style,
}: {
  events: EventSummary[];
  className?: string;
  style?: React.CSSProperties;
}) {
  if (events.length === 0) return null;

  return (
    <section className={`col-span-full flex flex-col gap-4 border-y border-line py-6 ${className}`} style={style}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-ink">New events</h2>
        <Link
          href="/events"
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/10"
        >
          See all
        </Link>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] min-[560px]:mx-0 min-[560px]:grid min-[560px]:snap-none min-[560px]:grid-cols-2 min-[560px]:overflow-visible min-[560px]:px-0 min-[560px]:max-lg:[&>*:nth-child(n+3)]:hidden lg:grid-cols-3 lg:max-2xl:[&>*:nth-child(n+4)]:hidden 2xl:grid-cols-4 2xl:[&>*:nth-child(n+5)]:hidden">
        {events.map((e) => (
          <div key={e.key} className="flex w-[78%] shrink-0 snap-start flex-col min-[560px]:w-auto">
            <EventTile
              href={e.href}
              cover={e.cover}
              title={e.name}
              count={e.talkCount}
              channel={e.channelName}
              when={e.latest ? formatDateShort(e.latest) : undefined}
              where={e.location}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
