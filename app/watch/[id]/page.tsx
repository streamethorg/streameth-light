import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SessionPlayer from "@/components/SessionPlayer";
import VideoCard from "@/components/VideoCard";
import UnifiedVideoCard from "@/components/UnifiedVideoCard";
import SpeakerCard from "@/components/SpeakerCard";
import TranscriptPanel from "@/components/TranscriptPanel";
import SaveButton from "@/components/SaveButton";
import {
  getSession,
  getEventById,
  getOrgForEvent,
  buildPlaybackSrc,
  getDownloadUrl,
  listAllSessions,
  relatedSessions,
} from "@/lib/data";
import { getVideoById, relatedVideos } from "@/lib/videoDb";
import { slugifyTopic } from "@/lib/topics";
import { getSessionDurationSeconds } from "@/lib/browseParams";
import { accentStyle, formatDateLong, formatTimecode, initials } from "@/lib/format";

// YouTube-backed watch pages (`yt-<videoId>`) aren't in this list — they're
// rendered on demand instead of prerendered at build time, since there are
// 11.5k of them and they're just an iframe embed, not worth the build cost.
export const dynamicParams = true;

export function generateStaticParams() {
  return listAllSessions().map((session) => ({ id: session._id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (id.startsWith("yt-")) {
    const video = getVideoById(id);
    if (!video) return {};
    return {
      title: `${video.title} — StreamETH Light`,
      description: video.description?.slice(0, 200),
    };
  }
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

  if (id.startsWith("yt-")) {
    return <YoutubeWatchPage id={id} />;
  }

  const session = getSession(id);
  if (!session) notFound();

  const event = getEventById(session.eventId);
  const org = getOrgForEvent(event);
  const playback = buildPlaybackSrc(session);
  const related = relatedSessions(session, 12);
  const duration = getSessionDurationSeconds(session);
  const downloadUrl = getDownloadUrl(session);
  const transcript = session.transcripts?.text;

  return (
    <div
      style={accentStyle(event?.accentColor ?? org?.accentColor) as CSSProperties | undefined}
      className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-6 sm:px-6 lg:flex-row lg:items-start"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <SessionPlayer
          playback={playback}
          poster={session.coverImage}
          track={{
            id: session._id,
            title: session.name,
            orgName: org?.name ?? "",
            coverImage: session.coverImage ?? null,
            watchUrl: `/watch/${session._id}`,
            src: playback?.src ?? "",
            type: playback?.type ?? "mp4",
          }}
        />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">{session.name}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <SaveButton
              videoId={session._id}
              videoSource="streameth"
              title={session.name}
              coverImage={session.coverImage ?? null}
            />
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink-dim hover:bg-panel hover:text-ink"
              >
                Download
              </a>
            )}
          </div>
        </div>

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {session.speakers.map((sp) => (
              <SpeakerCard key={sp._id} speaker={sp} />
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

        {transcript && <TranscriptPanel text={transcript} />}
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

function YoutubeWatchPage({ id }: { id: string }) {
  const video = getVideoById(id);
  if (!video) notFound();

  const videoId = id.slice("yt-".length);
  const related = relatedVideos(video, 12);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-6 sm:px-6 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="aspect-video w-full overflow-hidden rounded-md border border-line bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">{video.title}</h1>
          <SaveButton
            videoId={video.id}
            videoSource="youtube"
            title={video.title}
            coverImage={video.coverImage}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <Link href={`/${video.orgSlug}`} className="flex items-center gap-3 hover:text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-panel text-sm text-ink-dim">
              {initials(video.orgName)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-ink">{video.orgName}</span>
              <span className="font-mono text-xs text-ink-faint">
                YouTube
                {video.publishedAt ? ` · ${formatDateLong(video.publishedAt)}` : ""}
              </span>
            </div>
          </Link>
        </div>

        {video.description && (
          <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-dim">
            {video.description}
          </p>
        )}

        {video.transcript && <TranscriptPanel text={video.transcript} />}
      </div>

      {related.length > 0 && (
        <div className="flex w-full shrink-0 flex-col gap-3 lg:sticky lg:top-[73px] lg:w-[380px]">
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">Up next</h2>
          <div className="flex flex-col gap-3">
            {related.map((v) => (
              <UnifiedVideoCard key={v.id} video={v} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
