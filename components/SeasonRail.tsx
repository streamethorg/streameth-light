import Link from "next/link";
import { formatEventDates, statusLine, type SeasonEvent } from "@/lib/season";

function shortDate(event: SeasonEvent): string {
  return new Date(`${event.start}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function EventLink({ event }: { event: SeasonEvent }) {
  // The ::after stretches the link over its whole row, so the tap target is
  // the row, not just the name.
  const className =
    "text-[16px] font-semibold leading-5 text-ink transition-colors after:absolute after:inset-0 hover:text-ink-dim";
  if (event.href) {
    return (
      <Link href={event.href} className={className}>
        {event.name}
      </Link>
    );
  }
  if (event.website) {
    return (
      <a href={event.website} target="_blank" rel="noreferrer" className={className}>
        {event.name}
      </a>
    );
  }
  return <span className={className}>{event.name}</span>;
}

/** The front page's right-hand column: events on now, then the ones coming
 * up, each a time label beside the event — the season at a glance, read
 * like a departures board. */
export default function SeasonRail({
  now,
  live,
  coming,
}: {
  now: number;
  live: SeasonEvent[];
  coming: SeasonEvent[];
}) {
  return (
    <>
      {live.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[19px] font-semibold text-ink">On now</h2>
          <ul className="flex flex-col">
            {live.map((event) => (
              <li key={event.key} className="relative grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-2 border-t border-line py-3">
                <span className="tabular flex items-center gap-1.5 pt-0.5 text-[12px] font-semibold uppercase leading-5 tracking-wider text-live">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-live" aria-hidden="true" />
                  Live
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <EventLink event={event} />
                  <span className="tabular text-[13px] text-ink-faint">
                    {[event.city, statusLine(event, now)].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[19px] font-semibold text-ink">Coming up</h2>
          <Link href="/events" className="text-[13px] text-ink-faint transition-colors hover:text-ink">
            All events
          </Link>
        </div>
        {coming.length === 0 ? (
          <p className="border-t border-line py-3 text-sm text-ink-faint">Nothing on the calendar yet.</p>
        ) : (
          <ul className="flex flex-col">
            {coming.map((event) => (
              <li
                key={event.key}
                className="relative grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-2 border-t border-line py-3"
                title={formatEventDates(event)}
              >
                <span className="tabular pt-0.5 text-[12px] font-semibold uppercase leading-5 tracking-wider text-ink-dim">{shortDate(event)}</span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <EventLink event={event} />
                  {event.city && <span className="text-[13px] text-ink-faint">{event.city}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
