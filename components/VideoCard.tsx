import Link from "next/link";
import type { Session, Event } from "@/lib/types";
import { formatDateShort, formatTimecode } from "@/lib/format";
import CoverPlaceholder from "./CoverPlaceholder";

export default function VideoCard({
  session,
  event,
}: {
  session: Session;
  event?: Event;
}) {
  const duration = session.playback?.duration;

  return (
    <Link href={`/watch/${session._id}`} className="group flex flex-col gap-2.5">
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-panel">
        {session.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.coverImage}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <CoverPlaceholder label={session.name} />
        )}
        {duration ? (
          <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-void/85 px-1.5 py-0.5 font-mono text-[10px] tabular text-ink">
            {formatTimecode(duration)}
          </span>
        ) : null}
        <span className="absolute inset-0 ring-1 ring-inset ring-white/5 transition-colors group-hover:ring-accent/40" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-ink transition-colors group-hover:text-accent">
          {session.name}
        </h3>
        <p className="font-mono text-[11px] text-ink-faint">
          {event?.name ?? session.eventSlug}
          {session.start ? ` · ${formatDateShort(session.start)}` : ""}
        </p>
      </div>
    </Link>
  );
}
