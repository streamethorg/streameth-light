import Link from "next/link";
import { notFound } from "next/navigation";
import VideoPlayer from "@/components/VideoPlayer";
import VideoCard from "@/components/VideoCard";
import {
  getSession,
  getEventById,
  getOrgForEvent,
  buildPlaybackSrc,
  relatedSessions,
} from "@/lib/data";
import { formatDateLong } from "@/lib/format";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = getSession(id);
  if (!session) return {};
  return {
    title: `${session.name} — StreamETH Light`,
    description: session.description?.slice(0, 200),
  };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) notFound();

  const event = getEventById(session.eventId);
  const org = getOrgForEvent(event);
  const playback = buildPlaybackSrc(session);
  const related = relatedSessions(session, 10);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-1 text-xs text-neutral-500">
        {org && (
          <Link href={`/${org.slug}`} className="hover:text-neutral-300">
            {org.name}
          </Link>
        )}
        {event && (
          <Link href={`/${org?.slug ?? ""}/${event.slug}`} className="w-fit hover:text-neutral-300">
            {event.name}
          </Link>
        )}
      </div>

      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        {playback ? (
          <VideoPlayer src={playback.src} type={playback.type} poster={session.coverImage} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-neutral-500">
            No playable video source for this session.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold sm:text-2xl">{session.name}</h1>
        <p className="text-xs text-neutral-500">{formatDateLong(session.start)}</p>

        {session.speakers && session.speakers.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {session.speakers.map((sp) => (
              <div key={sp._id} className="flex items-center gap-2">
                {sp.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sp.photo}
                    alt={sp.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-xs">
                    {sp.name.slice(0, 1)}
                  </div>
                )}
                <span className="text-sm text-neutral-200">{sp.name}</span>
              </div>
            ))}
          </div>
        )}

        {session.description && (
          <p className="max-w-3xl whitespace-pre-line text-sm text-neutral-400">
            {session.description}
          </p>
        )}
      </div>

      {related.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-neutral-300">More from {event?.name}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {related.map((s) => (
              <VideoCard key={s._id} session={s} event={event} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
