"use client";

import { useEffect, useRef } from "react";
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
      return () => hls.destroy();
    }
  }, [src, type]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      poster={poster}
      className="w-full h-full bg-black"
      {...(type === "mp4" ? { src } : {})}
    />
  );
}
