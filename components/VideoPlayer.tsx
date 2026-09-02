"use client";

import { useRef, type RefObject } from "react";
import { useHlsSource } from "@/lib/useHlsSource";

export default function VideoPlayer({
  src,
  type,
  poster,
  videoRef: externalRef,
}: {
  src: string;
  type: "hls" | "mp4";
  poster?: string;
  /** Lets a parent read/seek the underlying <video> — used to hand off the
   * current playback position when switching into Listen mode. */
  videoRef?: RefObject<HTMLVideoElement | null>;
}) {
  const internalRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalRef ?? internalRef;
  const { ready, setReady, error } = useHlsSource(videoRef, src, type);

  return (
    <div className="relative h-full w-full">
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-panel">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-panel px-4 text-center font-mono text-xs text-ink-faint">
          This recording couldn&apos;t be loaded.
        </div>
      )}
      <video
        ref={videoRef}
        controls
        playsInline
        poster={poster}
        className="h-full w-full bg-black"
        onLoadedData={() => setReady(true)}
      />
    </div>
  );
}
