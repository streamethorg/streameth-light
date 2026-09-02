"use client";

import { useRef } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import { usePodcastPlayer, type PodcastTrack } from "@/components/PodcastPlayerProvider";

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
  const isListening = player.track?.id === track.id;

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
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-black">
        {isListening ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-panel px-4 text-center">
            {track.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.coverImage}
                alt=""
                className="h-16 w-16 rounded-md object-cover opacity-70"
              />
            )}
            <p className="text-sm text-ink-dim">Playing audio-only in the player below</p>
            <button
              type="button"
              onClick={switchToVideo}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-dim hover:bg-panel-raised hover:text-ink"
            >
              Switch to video
            </button>
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
          <div className="flex h-full w-full items-center justify-center font-mono text-xs text-ink-faint">
            No playable video source for this session.
          </div>
        )}
      </div>

      {playback && !isListening && (
        <button
          type="button"
          onClick={startListening}
          className="flex w-fit items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink-dim hover:bg-panel hover:text-ink"
        >
          Listen (audio only)
        </button>
      )}
    </div>
  );
}
