import Link from "next/link";
import { notFound } from "next/navigation";
import VideoCard from "@/components/VideoCard";
import { getOrganization, getEvent, listSessionsForEvent } from "@/lib/data";
import { formatDateShort } from "@/lib/format";

export default async function EventPage({
  params,
}: {
  params: Promise<{ org: string; event: string }>;
}) {
  const { org: orgSlug, event: eventSlug } = await params;
  const org = getOrganization(orgSlug);
  const event = getEvent(eventSlug);
  if (!org || !event || event.organizationId !== org._id) notFound();

  const sessions = listSessionsForEvent(event._id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-3">
        <Link
          href={`/${org.slug}`}
          className="w-fit text-xs text-neutral-500 hover:text-neutral-300"
        >
          ← {org.name}
        </Link>
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-sm text-neutral-400">
          {event.start ? formatDateShort(event.start) : ""}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        {event.description && (
          <p className="max-w-2xl text-sm text-neutral-400">{event.description}</p>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-neutral-500">No public videos found for this event.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {sessions.map((s) => (
            <VideoCard key={s._id} session={s} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
