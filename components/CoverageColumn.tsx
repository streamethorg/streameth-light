import Link from "next/link";
import CoverImage from "./CoverImage";
import {
  eventCover,
  eventFormatCounts,
  formatEventDates,
  statusLine,
  type SeasonEvent,
} from "@/lib/season";

function EventLink({ event, className, children }: { event: SeasonEvent; className: string; children: React.ReactNode }) {
  if (event.href) {
    return (
      <Link href={event.href} className={className}>
        {children}
      </Link>
    );
  }
  if (event.website) {
    return (
      <a href={event.website} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return <div className={className}>{children}</div>;
}

/** The front page's middle column: the next event we'll cover, big, then
 * the most recent events we covered, each linking to its coverage page. */
export default function CoverageColumn({
  now,
  upcoming,
  past,
}: {
  now: number;
  upcoming?: SeasonEvent;
  past: SeasonEvent[];
}) {
  if (!upcoming && past.length === 0) {
    return <p className="text-sm text-ink-faint">No event coverage yet.</p>;
  }
  return (
    <div className="flex min-w-0 flex-col divide-y divide-line">
      {upcoming && (
        <div className="pb-6">
          <EventLink event={upcoming} className="group flex flex-col gap-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-panel-raised">
              <CoverImage src={eventCover(upcoming)} label={upcoming.name} loading="eager" />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-dim">Coming up</span>
              <h2 className="text-[24px] font-semibold leading-[1.85rem] tracking-[-0.01em] text-ink transition-colors group-hover:text-ink-dim">
                {upcoming.name}
              </h2>
              <p className="tabular text-[15px] text-ink-dim">
                {[formatEventDates(upcoming), upcoming.city, statusLine(upcoming, now)].filter(Boolean).join(" · ")}
              </p>
              {upcoming.description && (
                <p className="dek line-clamp-3 text-[15px] leading-6 text-ink-dim">{upcoming.description}</p>
              )}
            </div>
          </EventLink>
        </div>
      )}
      {past.map((event, i) => {
        const counts = eventFormatCounts(event);
        const recordings = counts.talk + counts.clip + counts.stream;
        return (
          <div key={event.key} className={i === 0 && !upcoming ? "pb-5" : "py-5"}>
            <EventLink event={event} className="group grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4">
              <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-panel-raised">
                <CoverImage src={eventCover(event)} label={event.name} />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="tabular text-[12px] font-semibold uppercase tracking-wider text-ink-faint">{statusLine(event, now)}</span>
                <h3 className="line-clamp-2 text-[16px] font-semibold leading-5 text-ink transition-colors group-hover:text-ink-dim">
                  {event.name}
                </h3>
                <p className="tabular truncate text-[13px] text-ink-faint">
                  {[formatEventDates(event), recordings > 0 ? `${recordings.toLocaleString()} recordings` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </EventLink>
          </div>
        );
      })}
    </div>
  );
}
