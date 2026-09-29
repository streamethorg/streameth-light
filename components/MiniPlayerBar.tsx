"use client";

import Link from "next/link";
import { usePodcastPlayer } from "@/components/PodcastPlayerProvider";
import { formatTimecode, initials } from "@/lib/format";

const SKIP_SECONDS = 15;

export default function MiniPlayerBar() {
  const { track, playing, currentTime, duration, togglePlay, seek, stop } = usePodcastPlayer();

  if (!track) return null;

  const safeDuration = duration || 0;
  const pct = safeDuration ? (Math.min(currentTime, safeDuration) / safeDuration) * 100 : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-stage text-stage-ink shadow-[0_-12px_40px_rgb(20_11_54/0.35)]">
      <input
        type="range"
        min={0}
        max={safeDuration}
        value={Math.min(currentTime, safeDuration)}
        onChange={(e) => seek(Number(e.target.value))}
        className="player-scrubber w-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--accent) 0%, var(--peach) ${pct}%, var(--stage-line) ${pct}%)`,
        }}
        aria-label="Seek"
      />
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4">
        {track.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.coverImage}
            alt=""
            className="h-11 w-11 shrink-0 rounded-md object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-stage-raised text-xs text-stage-dim">
            {initials(track.title)}
          </div>
        )}

        <Link href={track.watchUrl} className="min-w-0 flex-1 hover:opacity-80 sm:max-w-xs">
          <p className="truncate text-sm font-semibold text-stage-ink">{track.title}</p>
          <p className="truncate text-xs text-stage-dim">{track.orgName}</p>
        </Link>

        <div className="flex flex-1 items-center justify-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => seek(Math.max(0, currentTime - SKIP_SECONDS))}
            aria-label={`Back ${SKIP_SECONDS} seconds`}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-stage-dim hover:bg-white/10 hover:text-stage-ink sm:flex"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
              <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-stage shadow-sm transition-colors hover:bg-peach"
          >
            {playing ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <rect x="5" y="4" width="3" height="12" />
                <rect x="12" y="4" width="3" height="12" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="ml-0.5 h-4 w-4">
                <path d="M6 4l10 6-10 6V4z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={() => seek(Math.min(safeDuration, currentTime + SKIP_SECONDS))}
            aria-label={`Forward ${SKIP_SECONDS} seconds`}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-stage-dim hover:bg-white/10 hover:text-stage-ink sm:flex"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M21 12a9 9 0 1 1-3-6.7" strokeLinecap="round" />
              <path d="M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <span className="hidden shrink-0 text-xs font-medium tabular text-stage-dim md:inline">
          {formatTimecode(currentTime)} / {formatTimecode(safeDuration)}
        </span>

        <button
          type="button"
          onClick={stop}
          aria-label="Close player"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-stage-dim hover:bg-white/10 hover:text-stage-ink"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M4.29 4.29a1 1 0 011.42 0L10 8.59l4.29-4.3a1 1 0 111.42 1.42L11.41 10l4.3 4.29a1 1 0 01-1.42 1.42L10 11.41l-4.29 4.3a1 1 0 01-1.42-1.42L8.59 10l-4.3-4.29a1 1 0 010-1.42z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
