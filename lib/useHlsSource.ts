"use client";

import { useEffect, useState, type RefObject } from "react";

/** Attaches an HLS source to a <video> element via native support or
 * hls.js, or sets `src` directly for a plain mp4 — shared by VideoPlayer
 * (inline watch-page playback) and PodcastPlayerProvider (the persistent
 * background player), so both handle the same set of sources identically.
 *
 * hls.js (~150KB gzipped) is only fetched when a browser without native HLS
 * actually opens an HLS source, so it isn't in every page's bundle (Safari
 * and iOS never download it). It parses the playlist up front but holds off
 * on video segments until playback starts, so opening a watch page on a
 * phone doesn't spend a megabyte of data on a video nobody pressed play on. */
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

    // Native playback (mp4 everywhere, HLS on Safari/iOS and newer Chrome):
    // the browser shows the poster and its own controls straight away; the
    // inline player's preload="none" keeps it from fetching until play.
    if (type === "mp4" || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      const timer = window.setTimeout(() => setReady(true), 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    let destroy: (() => void) | undefined;

    import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setError(true);
          return;
        }
        const hls = new Hls({ autoStartLoad: false });
        let loading = false;
        const startLoading = () => {
          if (loading) return;
          loading = true;
          hls.startLoad(video.currentTime || -1);
        };
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => setReady(true));
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) setError(true);
        });
        // Scrubbing a paused video counts as starting it.
        video.addEventListener("play", startLoading);
        video.addEventListener("seeking", startLoading);
        destroy = () => {
          video.removeEventListener("play", startLoading);
          video.removeEventListener("seeking", startLoading);
          hls.destroy();
        };
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [videoRef, src, type]);

  return { ready, setReady, error };
}
