import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SessionPlayer from "@/components/SessionPlayer";
import YoutubeSessionPlayer from "@/components/YoutubeSessionPlayer";
import VideoCard from "@/components/VideoCard";
import UnifiedVideoCard from "@/components/UnifiedVideoCard";
import SpeakerCard from "@/components/SpeakerCard";
import SaveButton from "@/components/SaveButton";
import WatchLayout from "@/components/WatchLayout";
import { actionButtonClass, DownloadIcon } from "@/components/ActionButton";
import {
  getSession,
  getEventById,
  getOrgForSession,
  getOrgForEvent,
  buildPlaybackSrc,
  getDownloadUrl,
  listAllSessions,
  relatedSessions,
} from "@/lib/data";
import { getVideoById, relatedVideos } from "@/lib/videoDb";
import { slugifyTopic } from "@/lib/topics";
import { getSessionDurationSeconds } from "@/lib/browseParams";
import { formatDateLong, formatTimecode } from "@/lib/format";

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
      title: `${video.title} — StreamETH`,
      description: video.description?.slice(0, 200),
    };
  }
  const session = getSession(id);
  if (!session) return {};
  return {
    title: `${session.name} — StreamETH`,
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
  const org = getOrgForSession(session, event);
  const playback = buildPlaybackSrc(session);
  const related = relatedSessions(session, 12);
  const duration = getSessionDurationSeconds(session);
  const downloadUrl = getDownloadUrl(session);
  const transcript = session.transcripts?.text;

  return (
    <WatchLayout
      accentColor={event?.accentColor ?? org?.accentColor}
      orgName={org?.name}
      orgSlug={org?.slug}
      crumb={event?.name}
      player={
        <SessionPlayer
          playback={playback}
          poster={session.coverImage}
          track={{
            source: "streameth",
            id: session._id,
            title: session.name,
            orgName: org?.name ?? "",
            coverImage: session.coverImage ?? null,
            watchUrl: `/watch/${session._id}`,
            src: playback?.src ?? "",
            type: playback?.type ?? "mp4",
          }}
        />
      }
      title={session.name}
      actions={
        <>
          <SaveButton
            videoId={session._id}
            videoSource="streameth"
            title={session.name}
            coverImage={session.coverImage ?? null}
          />
          {downloadUrl && (
            <a href={downloadUrl} download className={actionButtonClass()}>
              <DownloadIcon />
              Download
            </a>
          )}
        </>
      }
      metaLine={`${formatDateLong(session.start)}${duration ? ` · ${formatTimecode(duration)}` : ""}`}
      topics={
        session.autoLabels &&
        session.autoLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {session.autoLabels.map((topic) => (
              <Link
                key={topic}
                href={`/topics/${slugifyTopic(topic)}`}
                className="rounded-full bg-panel-raised px-3 py-1 text-[13px] font-medium text-ink-dim transition-colors hover:bg-accent/10 hover:text-accent"
              >
                {topic}
              </Link>
            ))}
          </div>
        )
      }
      description={session.description}
      transcript={transcript}
      speakers={
        session.speakers &&
        session.speakers.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {session.speakers.map((sp) => (
              <SpeakerCard key={sp._id} speaker={sp} />
            ))}
          </div>
        )
      }
      relatedLabel={event ? `More from ${event.name}` : org ? `More from ${org.name}` : "More like this"}
      related={related.map((s) => {
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
    />
  );
}

function YoutubeWatchPage({ id }: { id: string }) {
  const video = getVideoById(id);
  if (!video) notFound();

  const videoId = id.slice("yt-".length);
  const related = relatedVideos(video, 12);

  return (
    <WatchLayout
      orgName={video.orgName}
      orgSlug={video.orgSlug}
      crumb="YouTube"
      player={
        <YoutubeSessionPlayer
          videoId={videoId}
          title={video.title}
          poster={video.coverImage}
          track={{
            source: "youtube",
            id: video.id,
            title: video.title,
            orgName: video.orgName,
            coverImage: video.coverImage,
            watchUrl: `/watch/${video.id}`,
            videoId,
          }}
        />
      }
      title={video.title}
      actions={
        <SaveButton
          videoId={video.id}
          videoSource="youtube"
          title={video.title}
          coverImage={video.coverImage}
        />
      }
      metaLine={video.publishedAt ? formatDateLong(video.publishedAt) : undefined}
      description={video.description}
      transcript={video.transcript}
      relatedLabel={`More from ${video.orgName}`}
      related={related.map((v) => (
        <UnifiedVideoCard key={v.id} video={v} />
      ))}
    />
  );
}
