"use client";

import { useEffect, useState, type RefObject } from "react";
import Hls from "hls.js";

/** Attaches an HLS source to a <video> element via native support or
 * hls.js, or sets `src` directly for a plain mp4 — shared by VideoPlayer
 * (inline watch-page playback) and PodcastPlayerProvider (the persistent
 * background player), so both handle the same set of sources identically. */
export function useHlsSource(
  videoRef: RefObject<HTMLVideoElement | null>,
  src: string | undefined,
  type: "hls" | "mp4" | undefined
) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [syncedSrc, setSyncedSrc] = useState(src);

  if (src !== syncedSrc) {
    setSyncedSrc(src);
    setReady(false);
    setError(false);
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || !type) return;

    if (type === "mp4") {
      video.src = src;
      return;
    }

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
  }, [videoRef, src, type]);

  return { ready, setReady, error };
}
