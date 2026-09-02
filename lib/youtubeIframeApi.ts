"use client";

// Minimal surface of YouTube's official IFrame Player API — loaded via their
// own <script src="https://www.youtube.com/iframe_api">, not a scraped or
// extracted stream. This is the sanctioned way to embed a controllable,
// persistent YouTube player (play/pause/seek, current time) rather than
// pulling a raw media URL out of their CDN.
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  loadVideoById(videoId: string, startSeconds?: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YTPlayerOptions {
  videoId: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
  };
}

interface YTNamespace {
  Player: new (elementId: string, options: YTPlayerOptions) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

export function loadYoutubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadYoutubeIframeApi called on the server"));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}
