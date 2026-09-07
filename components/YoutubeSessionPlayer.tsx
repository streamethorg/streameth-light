"use client";

import { useEffect, useRef, useState } from "react";
import "plyr/dist/plyr.css";
import CoverPlaceholder from "@/components/CoverPlaceholder";
import { usePodcastPlayer, type PodcastTrack } from "@/components/PodcastPlayerProvider";
import { YOUTUBE_PLYR_OPTIONS, loadPlyr, type PlyrInstance } from "@/lib/plyrYoutube";
import { actionButtonClass } from "@/components/ActionButton";

export default function YoutubeSessionPlayer({
  videoId,
  title,
  poster,
  track,
}: {
  videoId: string;
  title: string;
  poster?: string | null;
  track: Extract<PodcastTrack, { source: "youtube" }>;
}) {
  const embedRef = useRef<HTMLDivElement>(null);
  const inlinePlayerRef = useRef<PlyrInstance | null>(null);
  const [inlineReady, setInlineReady] = useState(false);
  const player = usePodcastPlayer();
  const isListening = player.track?.id === track.id;

  useEffect(() => {
    if (!embedRef.current) return;
    let cancelled = false;
    loadPlyr().then((PlyrCtor) => {
      if (cancelled || !embedRef.current) return;
      const plyr = new PlyrCtor(embedRef.current, YOUTUBE_PLYR_OPTIONS);
      plyr.once("ready", () => setInlineReady(true));
      inlinePlayerRef.current = plyr;
    });
    return () => {
      cancelled = true;
      inlinePlayerRef.current?.destroy();
      inlinePlayerRef.current = null;
    };
  }, [videoId]);

  function startListening() {
    const startAt = inlinePlayerRef.current?.currentTime ?? 0;
    inlinePlayerRef.current?.pause();
    player.playTrack(track, startAt);
  }

  function switchToVideo() {
    const resumeAt = player.getCurrentTime();
    player.stop();
    const plyr = inlinePlayerRef.current;
    if (plyr) {
      plyr.currentTime = resumeAt;
      plyr.play();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-black">
        <div className={isListening || !inlineReady ? "h-0 w-0 overflow-hidden" : "h-full w-full"}>
          <div ref={embedRef} data-plyr-provider="youtube" data-plyr-embed-id={videoId} />
        </div>

        {!inlineReady && !isListening && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-ink-faint">
            Loading player…
          </div>
        )}

        {isListening && (
          <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden bg-panel px-4 text-center">
            <div className="absolute inset-0">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" className="h-full w-full scale-110 object-cover opacity-20 blur-2xl" />
              ) : (
                <div className="h-full w-full opacity-20">
                  <CoverPlaceholder label={title} />
                </div>
              )}
            </div>

            <div className="relative flex flex-col items-center gap-3">
              <div className="relative h-24 w-24 overflow-hidden rounded-lg shadow-lg">
                {poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="" className="h-full w-full object-cover" />
                ) : (
                  <CoverPlaceholder label={title} />
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
                <p className="line-clamp-1 max-w-xs text-sm font-medium text-ink">{title}</p>
                <p className="text-xs text-ink-faint">Playing audio-only</p>
              </div>

              <button
                type="button"
                onClick={switchToVideo}
                className={`mt-1 ${actionButtonClass()} bg-panel hover:bg-panel-raised`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M4 4.5A1.5 1.5 0 015.5 3h2A1.5 1.5 0 019 4.5v11A1.5 1.5 0 017.5 17h-2A1.5 1.5 0 014 15.5v-11zM11 4.5A1.5 1.5 0 0112.5 3h2A1.5 1.5 0 0116 4.5v11a1.5 1.5 0 01-1.5 1.5h-2a1.5 1.5 0 01-1.5-1.5v-11z" opacity=".4" />
                  <path d="M6.79 8.06A.75.75 0 008 8.75v2.5a.75.75 0 001.21.59l1.67-1.25a.75.75 0 000-1.18L9.21 8.16a.75.75 0 00-.42-.1z" />
                </svg>
                Switch to video
              </button>
            </div>
          </div>
        )}
      </div>

      {inlineReady && !isListening && (
        <button
          type="button"
          onClick={startListening}
          className={actionButtonClass()}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
            <path
              d="M4 11v-1a6 6 0 1112 0v1M4 11a2 2 0 00-2 2v1a2 2 0 002 2h1v-5H4zm12 0a2 2 0 012 2v1a2 2 0 01-2 2h-1v-5h1z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Listen (audio only)
        </button>
      )}
    </div>
  );
}
