import type { MiraEvent } from "@/lib/directory";
import { formatDateShort } from "@/lib/format";

export default function TrackedEventRow({ event }: { event: MiraEvent }) {
  const content = (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="truncate text-sm text-ink">{event.name}</span>
      <span className="truncate font-mono text-[11px] text-ink-faint">
        {event.startTime ? formatDateShort(event.startTime) : "date tbd"}
        {event.city ? ` · ${event.city}` : ""}
        {event.organizer ? ` · ${event.organizer}` : ""}
      </span>
    </div>
  );

  return (
    <div className="flex items-center gap-3 border-b border-line py-2.5">
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
      <span className="shrink-0 rounded-sm bg-panel-raised px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink-faint">
        {event.kind}
      </span>
    </div>
  );
}
