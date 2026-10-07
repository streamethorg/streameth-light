"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import "plyr/dist/plyr.css";
import { useHlsSource } from "@/lib/useHlsSource";
import { YOUTUBE_PLYR_OPTIONS, loadPlyr, type PlyrInstance } from "@/lib/plyrYoutube";
import { createViewTracker, type ViewTracker } from "@/lib/viewTracking";

interface StreamethTrack {
  source: "streameth";
  id: string;
  title: string;
  orgName: string;
  coverImage: string | null;
  watchUrl: string;
  src: string;
  type: "hls" | "mp4";
}

interface YoutubeTrack {
  source: "youtube";
  id: string;
  title: string;
  orgName: string;
  coverImage: string | null;
  watchUrl: string;
  videoId: string;
}

export type PodcastTrack = StreamethTrack | YoutubeTrack;

interface PodcastPlayerState {
  track: PodcastTrack | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  playTrack: (track: PodcastTrack, startAt?: number) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  stop: () => void;
  /** Reads the live position without waiting for the polled state update —
   * used when handing playback back to an inline player on the watch page. */
  getCurrentTime: () => number;
}

const PodcastPlayerContext = createContext<PodcastPlayerState | null>(null);

export function usePodcastPlayer() {
  const ctx = useContext(PodcastPlayerContext);
  if (!ctx) throw new Error("usePodcastPlayer must be used within PodcastPlayerProvider");
  return ctx;
}

export default function PodcastPlayerProvider({ children }: { children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytMountRef = useRef<HTMLDivElement>(null);
  const plyrRef = useRef<PlyrInstance | null>(null);
  const [track, setTrack] = useState<PodcastTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const streamethSrc = track?.source === "streameth" ? track.src : undefined;
  const streamethType = track?.source === "streameth" ? track.type : undefined;
  const { ready } = useHlsSource(videoRef, streamethSrc, streamethType);
  const pendingSeekRef = useRef<number | undefined>(undefined);
  // Watch analytics for whatever track is loaded (mode "audio").
  const viewsRef = useRef<ViewTracker | null>(null);

  // Loads a YouTube video into the one persistent Plyr instance — created on
  // first use (Plyr needs the embed id up front), then reused for every
  // later YouTube track via `.source =` so the same player survives
  // navigation between pages.
  const attachYoutubeSource = useCallback((videoId: string, startAt: number | undefined) => {
    const existing = plyrRef.current;
    if (existing) {
      existing.source = { type: "video", sources: [{ src: videoId, provider: "youtube" }] };
      existing.once("ready", () => {
        if (startAt !== undefined) existing.currentTime = startAt;
        existing.play();
      });
      return;
    }

    const mount = ytMountRef.current;
    if (!mount) return;
    mount.setAttribute("data-plyr-provider", "youtube");
    mount.setAttribute("data-plyr-embed-id", videoId);
    loadPlyr().then((PlyrCtor) => {
      const plyr = new PlyrCtor(mount, YOUTUBE_PLYR_OPTIONS);
      plyr.on("playing", () => {
        setPlaying(true);
        viewsRef.current?.playing();
      });
      plyr.on("pause", () => {
        setPlaying(false);
        viewsRef.current?.paused();
      });
      plyr.on("ended", () => viewsRef.current?.paused());
      plyr.on("timeupdate", () => {
        setCurrentTime(plyr.currentTime);
        setDuration(plyr.duration || 0);
        viewsRef.current?.progress(plyr.currentTime, plyr.duration);
      });
      plyrRef.current = plyr;
      plyr.once("ready", () => {
        if (startAt !== undefined) plyr.currentTime = startAt;
        plyr.play();
      });
    });
  }, []);

  const playTrack = useCallback(
    (next: PodcastTrack, startAt?: number) => {
      // Only one source plays at a time — pause whichever isn't about to be used.
      if (next.source === "streameth") {
        plyrRef.current?.pause();
        pendingSeekRef.current = startAt;
        setTrack(next);
        setPlaying(true);
        return;
      }

      videoRef.current?.pause();
      setTrack(next);
      setPlaying(true);
      attachYoutubeSource(next.videoId, startAt);
    },
    [attachYoutubeSource]
  );

  const togglePlay = useCallback(() => {
    if (track?.source === "youtube") {
      const plyr = plyrRef.current;
      if (!plyr) return;
      if (playing) plyr.pause();
      else plyr.play();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, [track, playing]);

  const seek = useCallback(
    (time: number) => {
      if (track?.source === "youtube") {
        if (plyrRef.current) plyrRef.current.currentTime = time;
        setCurrentTime(time);
        return;
      }
      const video = videoRef.current;
      if (video) video.currentTime = time;
    },
    [track]
  );

  const stop = useCallback(() => {
    videoRef.current?.pause();
    plyrRef.current?.pause();
    setTrack(null);
    setPlaying(false);
  }, []);

  const getCurrentTime = useCallback(() => {
    if (track?.source === "youtube") return plyrRef.current?.currentTime ?? 0;
    return videoRef.current?.currentTime ?? 0;
  }, [track]);

  // One view per loaded track; switching tracks or stopping ends it.
  useEffect(() => {
    if (!track) return;
    const views = createViewTracker({ videoId: track.id, source: track.source, mode: "audio" });
    viewsRef.current = views;
    return () => {
      views.dispose();
      if (viewsRef.current === views) viewsRef.current = null;
    };
  }, [track]);

  // The persistent Plyr instance itself lives for the whole app session —
  // only torn down when the provider unmounts.
  useEffect(() => {
    return () => {
      plyrRef.current?.destroy();
      plyrRef.current = null;
    };
  }, []);

  // StreamETH: once the HLS/mp4 source is loaded, apply the requested start
  // time and play.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || track?.source !== "streameth" || !ready) return;
    if (pendingSeekRef.current !== undefined) {
      video.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = undefined;
    }
    video.play().catch(() => setPlaying(false));
  }, [ready, track]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => {
      setPlaying(true);
      if (track?.source === "streameth") viewsRef.current?.playing();
    };
    const onPause = () => {
      setPlaying(false);
      if (track?.source === "streameth") viewsRef.current?.paused();
    };
    const onTimeUpdate = () => {
      if (track?.source !== "streameth") return;
      setCurrentTime(video.currentTime);
      viewsRef.current?.progress(video.currentTime, video.duration);
    };
    const onDuration = () => {
      if (track?.source === "streameth") setDuration(video.duration || 0);
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onDuration);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onDuration);
    };
  }, [track]);

  // System-level (lock screen / OS media key) controls.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.orgName,
      artwork: track.coverImage ? [{ src: track.coverImage }] : [],
    });
    navigator.mediaSession.setActionHandler("play", () => togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => togglePlay());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined) seek(details.seekTime);
    });
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  const isYoutube = track?.source === "youtube";

  return (
    <PodcastPlayerContext.Provider
      value={{ track, playing, currentTime, duration, playTrack, togglePlay, seek, stop, getCurrentTime }}
    >
      {children}
      {/* Kept mounted (not display:none, to avoid any browser suspending a
          fully hidden video's audio) but visually and interactively inert —
          this is the one element that actually plays StreamETH audio. */}
      <video
        ref={videoRef}
        playsInline
        className="pointer-events-none fixed bottom-0 left-0 h-px w-px opacity-0"
        aria-hidden="true"
        tabIndex={-1}
      />
      {/* YouTube playback via a Plyr-skinned embed (own controls, YouTube's
          chrome trimmed via embed params) — official YouTube iframe under
          the hood, not an extracted stream. Shown as a small floating video
          when a YouTube track is active (the underlying iframe doesn't
          reliably keep decoding when fully hidden), collapsed to nothing
          otherwise; the element itself is never unmounted so the same Plyr
          instance survives navigation. */}
      <div
        className={`fixed z-40 overflow-hidden rounded-md shadow-lg transition-all ${
          isYoutube ? "bottom-20 right-4 h-24 w-40 border border-line" : "h-0 w-0"
        }`}
      >
        <div ref={ytMountRef} className="h-full w-full" />
      </div>
    </PodcastPlayerContext.Provider>
  );
}
