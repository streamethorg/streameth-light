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
import { loadYoutubeIframeApi, type YTPlayer } from "@/lib/youtubeIframeApi";

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

const YT_MOUNT_ID = "podcast-yt-mount";

export default function PodcastPlayerProvider({ children }: { children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const [track, setTrack] = useState<PodcastTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const streamethSrc = track?.source === "streameth" ? track.src : undefined;
  const streamethType = track?.source === "streameth" ? track.type : undefined;
  const { ready } = useHlsSource(videoRef, streamethSrc, streamethType);
  const pendingSeekRef = useRef<number | undefined>(undefined);

  const playTrack = useCallback((next: PodcastTrack, startAt?: number) => {
    // Only one source plays at a time — pause whichever isn't about to be used.
    if (next.source === "streameth") {
      ytPlayerRef.current?.pauseVideo();
      pendingSeekRef.current = startAt;
      setTrack(next);
      setPlaying(true);
      return;
    }

    videoRef.current?.pause();
    setTrack(next);
    setPlaying(true);
    if (ytPlayerRef.current) {
      ytPlayerRef.current.loadVideoById(next.videoId, startAt);
      return;
    }
    loadYoutubeIframeApi().then((YT) => {
      ytPlayerRef.current = new YT.Player(YT_MOUNT_ID, {
        videoId: next.videoId,
        playerVars: { playsinline: 1, start: Math.floor(startAt ?? 0) },
        events: {
          onStateChange: (e) => setPlaying(e.data === YT.PlayerState.PLAYING),
        },
      });
    });
  }, []);

  const togglePlay = useCallback(() => {
    if (track?.source === "youtube") {
      const yt = ytPlayerRef.current;
      if (!yt) return;
      if (playing) yt.pauseVideo();
      else yt.playVideo();
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
        ytPlayerRef.current?.seekTo(time, true);
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
    ytPlayerRef.current?.pauseVideo();
    setTrack(null);
    setPlaying(false);
  }, []);

  const getCurrentTime = useCallback(() => {
    if (track?.source === "youtube") return ytPlayerRef.current?.getCurrentTime() ?? 0;
    return videoRef.current?.currentTime ?? 0;
  }, [track]);

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
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => {
      if (track?.source === "streameth") setCurrentTime(video.currentTime);
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

  // YouTube: the IFrame API has no timeupdate event, so poll for position.
  useEffect(() => {
    if (track?.source !== "youtube") return;
    const interval = setInterval(() => {
      const yt = ytPlayerRef.current;
      if (!yt) return;
      setCurrentTime(yt.getCurrentTime() || 0);
      setDuration(yt.getDuration() || 0);
    }, 500);
    return () => clearInterval(interval);
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
      {/* YouTube's own IFrame Player — official embed API, not an extracted
          stream. Shown as a small floating video when a YouTube track is
          active (their player doesn't reliably keep decoding when fully
          hidden), collapsed to nothing otherwise; the element itself is
          never unmounted so the same player instance survives navigation. */}
      <div
        className={`fixed z-40 overflow-hidden rounded-md shadow-lg transition-all ${
          isYoutube ? "bottom-20 right-4 h-24 w-40 border border-line" : "h-0 w-0"
        }`}
      >
        <div id={YT_MOUNT_ID} className="h-full w-full" />
      </div>
    </PodcastPlayerContext.Provider>
  );
}
