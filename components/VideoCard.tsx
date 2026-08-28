import Link from "next/link";
import type { Session, Event } from "@/lib/types";
import { formatDateShort } from "@/lib/format";

export default function VideoCard({
  session,
  event,
}: {
  session: Session;
  event?: Event;
}) {
  return (
    <Link href={`/watch/${session._id}`} className="group flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-neutral-800">
        {session.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.coverImage}
            alt={session.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-500 text-sm">
            No thumbnail
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-2 text-sm font-medium text-neutral-100 group-hover:text-white">
          {session.name}
        </h3>
        <p className="text-xs text-neutral-400">
          {event?.name ?? session.eventSlug}
          {session.start ? ` · ${formatDateShort(session.start)}` : ""}
        </p>
      </div>
    </Link>
  );
}
