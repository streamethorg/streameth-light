"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useHlsSource } from "@/lib/useHlsSource";

export interface PodcastTrack {
  id: string;
  title: string;
  orgName: string;
  coverImage: string | null;
  watchUrl: string;
  src: string;
  type: "hls" | "mp4";
}

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
   * used when handing playback back to an inline <video> on the watch page. */
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
  const [track, setTrack] = useState<PodcastTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const { ready } = useHlsSource(videoRef, track?.src, track?.type);
  const pendingSeekRef = useRef<number | undefined>(undefined);

  const playTrack = useCallback((next: PodcastTrack, startAt?: number) => {
    pendingSeekRef.current = startAt;
    setTrack(next);
    setPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, []);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = time;
  }, []);

  const stop = useCallback(() => {
    const video = videoRef.current;
    if (video) video.pause();
    setTrack(null);
    setPlaying(false);
  }, []);

  const getCurrentTime = useCallback(() => videoRef.current?.currentTime ?? 0, []);

  // Once the source is loaded, apply the requested start time and play.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready) return;
    if (pendingSeekRef.current !== undefined) {
      video.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = undefined;
    }
    video.play().catch(() => setPlaying(false));
  }, [ready]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDuration = () => setDuration(video.duration || 0);
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
  }, []);

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
    navigator.mediaSession.setActionHandler("play", () => videoRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => videoRef.current?.pause());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (videoRef.current && details.seekTime !== undefined) {
        videoRef.current.currentTime = details.seekTime;
      }
    });
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, [track]);

  return (
    <PodcastPlayerContext.Provider
      value={{ track, playing, currentTime, duration, playTrack, togglePlay, seek, stop, getCurrentTime }}
    >
      {children}
      {/* Kept mounted (not display:none, to avoid any browser suspending a
          fully hidden video's audio) but visually and interactively inert —
          this is the one element that actually plays audio in Listen mode. */}
      <video
        ref={videoRef}
        playsInline
        className="pointer-events-none fixed bottom-0 left-0 h-px w-px opacity-0"
        aria-hidden="true"
        tabIndex={-1}
      />
    </PodcastPlayerContext.Provider>
  );
}
