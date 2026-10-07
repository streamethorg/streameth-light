"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import VideoPlayer from "@/components/VideoPlayer";
import CoverPlaceholder from "@/components/CoverPlaceholder";
import { usePodcastPlayer, type PodcastTrack } from "@/components/PodcastPlayerProvider";
import { actionButtonClass, WATCH_ACTIONS_SLOT_ID } from "@/components/ActionButton";
import { trackMediaElement } from "@/lib/viewTracking";

export default function SessionPlayer({
  playback,
  poster,
  track,
}: {
  playback?: { src: string; type: "hls" | "mp4" };
  poster?: string;
  track: PodcastTrack;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const player = usePodcastPlayer();
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const isListening = player.track?.id === track.id;
  const playbackSrc = playback?.src;

  // Watch analytics for the inline video; Listen mode is tracked by the
  // podcast player instead.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackSrc || isListening) return;
    return trackMediaElement(video, { videoId: track.id, source: "streameth", mode: "video" });
  }, [playbackSrc, isListening, track.id]);

  function startListening() {
    const startAt = videoRef.current?.currentTime ?? 0;
    videoRef.current?.pause();
    player.playTrack(track, startAt);
  }

  function switchToVideo() {
    const resumeAt = player.getCurrentTime();
    player.stop();
    if (videoRef.current) {
      videoRef.current.currentTime = resumeAt;
      videoRef.current.play();
    }
  }

  return (
    <div
      ref={(el) => {
        // The Listen button renders into the watch page's actions row (next
        // to Save/Download), which lives outside this component.
        if (el && !actionsSlot) setActionsSlot(document.getElementById(WATCH_ACTIONS_SLOT_ID));
      }}
      className="flex flex-col"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black sm:rounded-xl">
        {isListening ? (
          <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden bg-stage-raised px-4 text-center">
            <div className="absolute inset-0">
              {track.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={track.coverImage}
                  alt=""
                  className="h-full w-full scale-110 object-cover opacity-20 blur-2xl"
                />
              ) : (
                <div className="h-full w-full opacity-20">
                  <CoverPlaceholder label={track.title} />
                </div>
              )}
            </div>

            <div className="relative flex flex-col items-center gap-3">
              <div className="relative h-24 w-24 overflow-hidden rounded-lg shadow-lg">
                {track.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={track.coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <CoverPlaceholder label={track.title} />
                )}
              </div>

              {player.playing && (
                <div className="flex h-4 items-end gap-[3px]" aria-hidden="true">
                  {[0, 0.15, 0.3, 0.1].map((delay, i) => (
                    <span
                      key={i}
                      className="eq-bar w-[3px] rounded-full bg-accent"
                      style={{ height: "100%", animationDelay: `${delay}s` }}
                    />
                  ))}
                </div>
              )}

              <div>
                <p className="line-clamp-1 max-w-xs text-sm font-semibold text-stage-ink">{track.title}</p>
                <p className="text-xs text-stage-dim">Playing audio only</p>
              </div>

              <button
                type="button"
                onClick={switchToVideo}
                className={`mt-1 ${actionButtonClass()}`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M4 4.5A1.5 1.5 0 015.5 3h2A1.5 1.5 0 019 4.5v11A1.5 1.5 0 017.5 17h-2A1.5 1.5 0 014 15.5v-11zM11 4.5A1.5 1.5 0 0112.5 3h2A1.5 1.5 0 0116 4.5v11a1.5 1.5 0 01-1.5 1.5h-2a1.5 1.5 0 01-1.5-1.5v-11z" opacity=".4" />
                  <path d="M6.79 8.06A.75.75 0 008 8.75v2.5a.75.75 0 001.21.59l1.67-1.25a.75.75 0 000-1.18L9.21 8.16a.75.75 0 00-.42-.1z" />
                </svg>
                Switch to video
              </button>
            </div>
          </div>
        ) : playback ? (
          <VideoPlayer
            key={playback.src}
            videoRef={videoRef}
            src={playback.src}
            type={playback.type}
            poster={poster}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-stage-dim">
            No playable video source for this session.
          </div>
        )}
      </div>

      {actionsSlot &&
        playback && !isListening &&
        createPortal(
          <button type="button" onClick={startListening} className={actionButtonClass()}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
              <path
                d="M4 11v-1a6 6 0 1112 0v1M4 11a2 2 0 00-2 2v1a2 2 0 002 2h1v-5H4zm12 0a2 2 0 012 2v1a2 2 0 01-2 2h-1v-5h1z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Listen
          </button>,
          actionsSlot
        )}
    </div>
  );
}
