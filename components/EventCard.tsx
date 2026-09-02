import Link from "next/link";
import type { Event } from "@/lib/types";
import { formatDateShort } from "@/lib/format";
import CoverPlaceholder from "./CoverPlaceholder";

export default function EventCard({
  event,
  orgSlug,
  count,
  extraVideoCount = 0,
  fallbackCover,
}: {
  event: Event;
  orgSlug: string;
  count: number;
  extraVideoCount?: number;
  fallbackCover?: string | null;
}) {
  const cover = event.eventCover || event.banner || fallbackCover;
  const total = count + extraVideoCount;

  return (
    <Link
      href={`/${orgSlug}/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-md border border-line bg-panel transition-all duration-200 hover:border-accent/50 hover:shadow-md"
    >
      <div className="relative aspect-[2/1] w-full overflow-hidden bg-panel-raised">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <CoverPlaceholder label={event.name} />
        )}
        {extraVideoCount > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-black/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white">
            +YouTube
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <h2 className="font-display text-sm font-bold leading-snug text-ink group-hover:text-accent">
          {event.name}
        </h2>
        <p className="font-mono text-[11px] text-ink-faint">
          {event.start ? formatDateShort(event.start) : ""}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        <p className="font-mono text-[11px] tabular text-ink-dim">
          {String(total).padStart(2, "0")} video{total === 1 ? "" : "s"}
        </p>
      </div>
    </Link>
  );
}
