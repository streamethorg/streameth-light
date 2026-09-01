import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import VideoPlayer from "@/components/VideoPlayer";
import VideoCard from "@/components/VideoCard";
import SpeakerChip from "@/components/SpeakerChip";
import {
  getSession,
  getEventById,
  getOrgForEvent,
  buildPlaybackSrc,
  listAllSessions,
  relatedSessions,
} from "@/lib/data";
import { slugifyTopic } from "@/lib/topics";
import { accentStyle, formatDateLong, formatTimecode } from "@/lib/format";

export function generateStaticParams() {
  return listAllSessions().map((session) => ({ id: session._id }));
}

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
  const duration = session.playback?.duration;

  return (
    <div
      style={
        accentStyle(event?.accentColor ?? org?.accentColor) as
          | CSSProperties
          | undefined
      }
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-xs uppercase tracking-wide text-ink-faint">
        {org && (
          <Link href={`/${org.slug}`} className="transition-colors hover:text-ink-dim">
            {org.name}
          </Link>
        )}
        {event && (
          <>
            <span>/</span>
            <Link
              href={`/${org?.slug ?? ""}/${event.slug}`}
              className="transition-colors hover:text-ink-dim"
            >
              {event.name}
            </Link>
          </>
        )}
      </div>

      <div className="aspect-video w-full overflow-hidden rounded-md border border-line bg-black">
        {playback ? (
          <VideoPlayer
            key={playback.src}
            src={playback.src}
            type={playback.type}
            poster={session.coverImage}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-xs text-ink-faint">
            No playable video source for this session.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 border-b border-line pb-8">
        <h1 className="font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
          {session.name}
        </h1>
        <p className="font-mono text-xs tabular text-ink-faint">
          {formatDateLong(session.start)}
          {duration ? ` · ${formatTimecode(duration)}` : ""}
        </p>

        {session.speakers && session.speakers.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {session.speakers.map((sp) => (
              <SpeakerChip key={sp._id} speaker={sp} />
            ))}
          </div>
        )}

        {session.description && (
          <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-dim">
            {session.description}
          </p>
        )}

        {session.autoLabels && session.autoLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {session.autoLabels.map((topic) => (
              <Link
                key={topic}
                href={`/topics/${slugifyTopic(topic)}`}
                className="rounded-sm border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-faint transition-colors hover:border-accent/50 hover:text-ink"
              >
                {topic}
              </Link>
            ))}
          </div>
        )}
      </div>

      {related.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">
            More from {event?.name}
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {related.map((s) => (
              <VideoCard key={s._id} session={s} event={event} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
