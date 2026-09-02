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
import { getSessionDurationSeconds } from "@/lib/browseParams";
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
  const related = relatedSessions(session, 12);
  const duration = getSessionDurationSeconds(session);

  return (
    <div
      style={accentStyle(event?.accentColor ?? org?.accentColor) as CSSProperties | undefined}
      className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-6 sm:px-6 lg:flex-row lg:items-start"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4">
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

        <h1 className="text-xl font-semibold text-ink sm:text-2xl">{session.name}</h1>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          {org && (
            <Link href={`/${org.slug}`} className="flex items-center gap-3 hover:text-white">
              {org.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={org.logo}
                  alt={org.name}
                  className="h-10 w-10 rounded-full bg-panel object-contain"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-panel text-sm text-ink-dim">
                  {org.name.slice(0, 1)}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-ink">{org.name}</span>
                {event && (
                  <span className="font-mono text-xs text-ink-faint">
                    {event.name} · {formatDateLong(session.start)}
                    {duration ? ` · ${formatTimecode(duration)}` : ""}
                  </span>
                )}
              </div>
            </Link>
          )}
        </div>

        {session.speakers && session.speakers.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {session.speakers.map((sp) => (
              <SpeakerChip key={sp._id} speaker={sp} />
            ))}
          </div>
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

        {session.description && (
          <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-dim">
            {session.description}
          </p>
        )}
      </div>

      {related.length > 0 && (
        <div className="flex w-full shrink-0 flex-col gap-3 lg:sticky lg:top-[73px] lg:w-[380px]">
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">Up next</h2>
          <div className="flex flex-col gap-3">
            {related.map((s) => {
              const relatedEvent = getEventById(s.eventId);
              return (
                <VideoCard
                  key={s._id}
                  session={s}
                  event={relatedEvent}
                  org={getOrgForEvent(relatedEvent)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

