import VideoCard from "@/components/VideoCard";
import type { Event, Organization, Session } from "@/lib/types";

export default function SessionCarousel({
  title,
  sessions,
  eventById,
  orgById,
}: {
  title: string;
  sessions: Session[];
  eventById: Map<string, Event>;
  orgById: Map<string, Organization>;
}) {
  if (sessions.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-3">
      <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">{title}</h2>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {sessions.map((s) => (
          <div key={s._id} className="w-56 shrink-0 sm:w-64">
            <VideoCard
              session={s}
              event={eventById.get(s.eventId)}
              org={orgById.get(s.organizationId)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
