import Link from "next/link";
import type { Session, Event, Organization } from "@/lib/types";
import { formatDateShort, formatTimecode, initials } from "@/lib/format";
import { getSessionDurationSeconds } from "@/lib/browseParams";
import CoverPlaceholder from "./CoverPlaceholder";

export default function VideoCard({
  session,
  event,
  org,
}: {
  session: Session;
  event?: Event;
  org?: Organization;
}) {
  const duration = getSessionDurationSeconds(session);
  const speakerNames = (session.speakers ?? []).map((sp) => sp.name).filter(Boolean);

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
        {duration !== undefined && (
          <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-black/80 px-1.5 py-0.5 font-mono text-[10px] tabular text-white">
            {formatTimecode(duration)}
          </span>
        )}
        <span className="absolute inset-0 ring-1 ring-inset ring-white/5 transition-colors group-hover:ring-accent/40" />
      </div>
      <div className="flex gap-2.5">
        {org && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel text-[10px] font-medium text-ink-dim">
            {initials(org.name)}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-ink transition-colors group-hover:text-accent">
            {session.name}
          </h3>
          {org && <p className="truncate text-xs text-ink-dim">{org.name}</p>}
          <p className="truncate font-mono text-[11px] text-ink-faint">
            {event?.name ?? session.eventSlug}
            {session.start ? ` · ${formatDateShort(session.start)}` : ""}
          </p>
          {speakerNames.length > 0 && (
            <p className="truncate font-mono text-[11px] text-ink-faint">
              {speakerNames.join(", ")}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
