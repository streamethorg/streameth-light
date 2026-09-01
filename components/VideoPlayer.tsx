"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export default function VideoPlayer({
  src,
  type,
  poster,
}: {
  src: string;
  type: "hls" | "mp4";
  poster?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || type !== "hls") return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => setReady(true));
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) setError(true);
      });
      return () => hls.destroy();
    }

    const timer = window.setTimeout(() => setError(true), 0);
    return () => window.clearTimeout(timer);
  }, [src, type]);

  return (
    <div className="relative h-full w-full">
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-panel">
          <span className="on-air-dot h-2 w-2 rounded-full bg-accent" />
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
        {...(type === "mp4" ? { src } : {})}
      />
    </div>
  );
}
