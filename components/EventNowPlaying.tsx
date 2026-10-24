import Link from "next/link";
import { Suspense } from "react";
import YoutubeSessionPlayer from "./YoutubeSessionPlayer";
import SessionPlayer from "./SessionPlayer";
import SaveButton from "./SaveButton";
import SpeakerCard from "./SpeakerCard";
import DescriptionBox from "./DescriptionBox";
import TranscriptPanel from "./TranscriptPanel";
import AskTalk from "./AskTalk";
import { actionButtonClass, DownloadIcon, WATCH_ACTIONS_SLOT_ID } from "./ActionButton";
import { buildPlaybackSrc, getDownloadUrl, getSession } from "@/lib/data";
import { getFullTranscript } from "@/lib/transcriptChunks";
import { formatDateLong, formatTimecode, withoutEventSuffix } from "@/lib/format";
import type { UnifiedVideo } from "@/lib/videoDb";
import { videoLink } from "@/lib/videoLink";

type AskEventProp = { key: string; name: string; transcribedTalks: number };

/** Whether a talk has enough of its own text for "Ask about this talk" to
 * answer from it (the watch page's rule). */
export function talkHasText(video: UnifiedVideo, transcript: string | null): boolean {
  const substantial = Boolean(transcript && transcript.replace(/\[[^\]]*\]/g, "").trim().length >= 400);
  return substantial || video.description.trim().length >= 200;
}

/** The video that was clicked, opened at the top of an event page's middle
 * column with everything the watch page has: the player (with Listen), the
 * title and when, Save and Download, the speakers, the description and the
 * searchable transcript. The feed carries on below it. */
export default async function EventNowPlaying({
  video,
  closeHref,
  event,
}: {
  video: UnifiedVideo;
  closeHref: string;
  /** The event page it's open on, so Ask can switch to the whole event. */
  event?: AskEventProp;
}) {
  const transcript = video.hasTranscript ? await getFullTranscript(video.id) : null;
  const session = video.source === "streameth" ? getSession(video.id) : undefined;
  const playback = session ? buildPlaybackSrc(session) : undefined;
  const downloadUrl = session ? getDownloadUrl(session) : video.downloadUrl ?? undefined;
  const youtubeId = video.source === "youtube" ? video.id.replace(/^yt-/, "") : null;
  const title = withoutEventSuffix(video.title, event?.name, video.eventName, video.orgName);
  const meta = [
    video.publishedAt ? formatDateLong(video.publishedAt) : null,
    video.durationSeconds ? formatTimecode(video.durationSeconds) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="flex flex-col gap-4 border-b border-line px-4 pb-6 pt-5" aria-label="Now playing">
      {youtubeId ? (
        <YoutubeSessionPlayer
          key={video.id}
          videoId={youtubeId}
          title={title}
          poster={video.coverImage}
          vertical={video.format === "short"}
          track={{
            source: "youtube",
            id: video.id,
            title: video.title,
            orgName: video.orgName,
            coverImage: video.coverImage,
            watchUrl: videoLink(video),
            videoId: youtubeId,
          }}
        />
      ) : (
        <SessionPlayer
          key={video.id}
          playback={playback}
          poster={video.coverImage ?? undefined}
          track={{
            source: "streameth",
            id: video.id,
            title: video.title,
            orgName: video.orgName,
            coverImage: video.coverImage,
            watchUrl: videoLink(video),
            src: playback?.src ?? "",
            type: playback?.type ?? "mp4",
          }}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[20px] font-semibold leading-[1.6rem] sm:text-[24px] sm:leading-[1.85rem] tracking-[-0.02em] text-ink">{title}</h2>
        <Link
          href={closeHref}
          aria-label="Close video"
          title="Close video"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-line-strong text-xl leading-none text-ink-dim transition-colors hover:border-ink-faint hover:text-ink"
        >
          ×
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {meta && <p className="tabular text-sm text-ink-dim">{meta}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {/* YoutubeSessionPlayer / SessionPlayer render their Listen button here. */}
          <div id={WATCH_ACTIONS_SLOT_ID} className="contents" />
          <SaveButton videoId={video.id} videoSource={video.source} title={video.title} coverImage={video.coverImage} />
          {downloadUrl && (
            <a href={downloadUrl} download className={actionButtonClass()}>
              <DownloadIcon />
              Download
            </a>
          )}
        </div>
      </div>

      {(video.speakers.length > 0 || video.description.trim()) && (
        <div className="flex flex-col gap-4 border-t border-line pt-4">
          {video.speakers.length > 0 && (
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {video.speakers.map((name) => (
                <SpeakerCard key={name} speaker={{ _id: name, name }} compact />
              ))}
            </div>
          )}
          {video.description.trim() && <DescriptionBox description={video.description} />}
        </div>
      )}

      {/* The right-hand column holds Ask on wide screens; below that it
          sits here, under the talk. */}
      <div className="border-t border-line pt-4 xl:hidden">
        <Suspense fallback={null}>
          <AskTalk
            videoId={video.id}
            hasTranscript={Boolean(transcript)}
            talkHasText={talkHasText(video, transcript)}
            event={event}
          />
        </Suspense>
      </div>

      {transcript?.trim() && (
        <div className="flex max-h-[420px] flex-col">
          <TranscriptPanel transcript={transcript} />
        </div>
      )}
    </section>
  );
}

// Pinned while the feed scrolls; a solid background so the panels below
// don't show through as they pass under it.
const ASK_PANEL =
  "sticky top-16 z-[5] flex max-h-[calc(100vh-4rem)] flex-col gap-3 overflow-y-auto bg-void pb-4 pt-1";

/** "Ask about this talk" for the right-hand column. */
export async function NowPlayingAsk({ video, event }: { video: UnifiedVideo; event?: AskEventProp }) {
  const transcript = video.hasTranscript ? await getFullTranscript(video.id) : null;
  return (
    <section className={ASK_PANEL}>
      <Suspense fallback={null}>
        <AskTalk
          videoId={video.id}
          hasTranscript={Boolean(transcript)}
          talkHasText={talkHasText(video, transcript)}
          event={event}
        />
      </Suspense>
    </section>
  );
}

/** "Ask about <event>" for the right-hand column when no video is open:
 * answers searched across the event's transcribed talks. */
export function EventAsk({ eventKey, eventName, transcribedTalks }: { eventKey: string; eventName: string; transcribedTalks: number }) {
  return (
    <section className={ASK_PANEL}>
      <Suspense fallback={null}>
        <AskTalk hasTranscript talkHasText event={{ key: eventKey, name: eventName, transcribedTalks }} />
      </Suspense>
    </section>
  );
}
