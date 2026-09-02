"use client";

import Link from "next/link";
import { usePodcastPlayer } from "@/components/PodcastPlayerProvider";
import { formatTimecode, initials } from "@/lib/format";

export default function MiniPlayerBar() {
  const { track, playing, currentTime, duration, togglePlay, seek, stop } = usePodcastPlayer();

  if (!track) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-panel shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
      <input
        type="range"
        min={0}
        max={duration || 0}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => seek(Number(e.target.value))}
        className="h-1 w-full cursor-pointer accent-accent"
      />
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink"
        >
          {playing ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <rect x="5" y="4" width="3" height="12" />
              <rect x="12" y="4" width="3" height="12" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6 4l10 6-10 6V4z" />
            </svg>
          )}
        </button>

        {track.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.coverImage} alt="" className="h-9 w-9 shrink-0 rounded-sm object-cover" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-panel-raised text-[10px] text-ink-dim">
            {initials(track.title)}
          </div>
        )}

        <Link href={track.watchUrl} className="min-w-0 flex-1 hover:opacity-80">
          <p className="truncate text-sm text-ink">{track.title}</p>
          <p className="truncate text-xs text-ink-faint">{track.orgName}</p>
        </Link>

        <span className="hidden shrink-0 font-mono text-xs tabular text-ink-faint sm:inline">
          {formatTimecode(currentTime)} / {formatTimecode(duration)}
        </span>

        <button
          type="button"
          onClick={stop}
          aria-label="Close player"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-panel-raised hover:text-ink"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M4.29 4.29a1 1 0 011.42 0L10 8.59l4.29-4.3a1 1 0 111.42 1.42L11.41 10l4.3 4.29a1 1 0 01-1.42 1.42L10 11.41l-4.29 4.3a1 1 0 01-1.42-1.42L8.59 10l-4.3-4.29a1 1 0 010-1.42z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
