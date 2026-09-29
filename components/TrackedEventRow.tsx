import type { MiraEvent } from "@/lib/directory";
import { formatDateShort } from "@/lib/format";

export default function TrackedEventRow({ event }: { event: MiraEvent }) {
  const content = (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="truncate text-[15px] font-semibold text-ink">{event.name}</span>
      <span className="flex flex-wrap gap-x-3 text-[13px] text-ink-faint">
        <span className="font-medium text-ink-dim">
          {event.startTime ? formatDateShort(event.startTime) : "Date to be announced"}
        </span>
        {event.city && <span>{event.city}</span>}
        {event.organizer && <span className="truncate">{event.organizer}</span>}
      </span>
    </div>
  );

  return (
    <div className="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-b-0">
      {event.website ? (
        <a
          href={event.website}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:text-accent"
        >
          {content}
        </a>
      ) : (
        content
      )}
      <span className="shrink-0 rounded-full bg-panel-raised px-2.5 py-0.5 text-xs font-medium text-ink-dim">
        {event.kind === "main" ? "Main event" : "Side event"}
      </span>
    </div>
  );
}
