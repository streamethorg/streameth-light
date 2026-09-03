"use client";

// Plyr's own type declarations (v3.8.4) combine `export =` and
// `export default` in the same file, which TypeScript rejects under this
// project's `isolatedModules` setting ("has no default export"). We only use
// a small slice of its API, so — the same approach the previous hand-rolled
// YouTube IFrame wrapper used for `window.YT` — declare that slice ourselves
// instead of importing Plyr's broken types.
export interface PlyrInstance {
  play(): Promise<void> | void;
  pause(): void;
  destroy(): void;
  currentTime: number;
  readonly duration: number;
  source: { type: "video"; sources: { src: string; provider: "youtube" }[] };
  on(event: string, callback: () => void): void;
  once(event: string, callback: () => void): void;
}

export interface PlyrOptions {
  controls?: string[];
  youtube?: Record<string, number | string | boolean>;
}

type PlyrConstructor = new (target: HTMLElement, options?: PlyrOptions) => PlyrInstance;

/** Shared Plyr options for every YouTube instance — Plyr's own custom-skinned
 * controls replace YouTube's chrome; these embed params trim what's left of
 * YouTube's own UI inside the iframe (related videos, branding, native
 * controls) so only Plyr's skin is visible. */
export const YOUTUBE_PLYR_OPTIONS: PlyrOptions = {
  controls: [
    "play-large",
    "play",
    "progress",
    "current-time",
    "duration",
    "mute",
    "volume",
    "fullscreen",
  ],
  youtube: {
    noCookie: false,
    rel: 0,
    showinfo: 0,
    iv_load_policy: 3,
    modestbranding: 1,
  },
};

// Plyr touches `document` at module-evaluation time, so it can't be a static
// import in files rendered during Next.js's server-side prerender — load it
// lazily, client-side only, and share one loaded module across every player.
let plyrCtorPromise: Promise<PlyrConstructor> | null = null;

export function loadPlyr(): Promise<PlyrConstructor> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadPlyr called on the server"));
  }
  if (!plyrCtorPromise) {
    plyrCtorPromise = import("plyr").then(
      (mod) => (mod as unknown as { default: PlyrConstructor }).default
    );
  }
  return plyrCtorPromise;
}
