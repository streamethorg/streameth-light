/** Client side of the video watch analytics: each player creates a tracker,
 * feeds it play/pause/timeupdate events, and the tracker reports progress
 * to /api/views (stored in Supabase's video_views table). */

export interface ViewTarget {
  videoId: string;
  source: "streameth" | "youtube";
  mode: "video" | "audio";
}

export interface ViewReport extends ViewTarget {
  /** One id per playback, generated in the browser. */
  id: string;
  /** Seconds of the talk actually played, seeking excluded. */
  watched: number;
  position: number;
  duration: number | null;
  /** True for the report sent on the first play — the server looks up the
   * signed-in user only then. */
  first: boolean;
}

export interface ViewTracker {
  playing(): void;
  paused(): void;
  /** Call on every timeupdate with the player's current position. */
  progress(position: number, duration: number): void;
  /** Sends what's left and stops listening for page hide. */
  dispose(): void;
}

const ENDPOINT = "/api/views";
// Send progress at most this often while playing.
const REPORT_EVERY_SECONDS = 15;
// A position jump bigger than this between two timeupdates is a seek, not
// playback (timeupdate fires every ~250ms, so 2x playback stays well under).
const MAX_PLAYBACK_STEP = 3;

function send(report: ViewReport) {
  const body = JSON.stringify(report);
  try {
    // sendBeacon survives the page being closed or navigated away from.
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
  } catch {
    // Fall through to fetch.
  }
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics are best-effort; never surface this to the viewer.
  });
}

export function createViewTracker(target: ViewTarget): ViewTracker {
  const id = crypto.randomUUID();
  let started = false;
  let isPlaying = false;
  let watched = 0;
  let position = 0;
  let duration: number | null = null;
  let lastPosition: number | null = null;
  let reportedWatched = 0;
  let reportedPosition = 0;

  function report(first = false) {
    reportedWatched = watched;
    reportedPosition = position;
    send({ ...target, id, watched, position, duration, first });
  }

  function flush() {
    if (started && (watched > reportedWatched || position > reportedPosition)) report();
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden") flush();
  }

  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return {
    playing() {
      isPlaying = true;
      lastPosition = null;
      if (!started) {
        started = true;
        report(true);
      }
    },
    paused() {
      isPlaying = false;
      lastPosition = null;
      flush();
    },
    progress(current, total) {
      if (Number.isFinite(total) && total > 0) duration = total;
      if (!Number.isFinite(current) || current < 0) return;
      if (isPlaying && lastPosition !== null) {
        const step = current - lastPosition;
        if (step > 0 && step <= MAX_PLAYBACK_STEP) watched += step;
      }
      lastPosition = current;
      position = Math.max(position, current);
      if (started && watched - reportedWatched >= REPORT_EVERY_SECONDS) report();
    },
    dispose() {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}

/** Wires a tracker to a <video>/<audio> element; returns the cleanup. */
export function trackMediaElement(media: HTMLMediaElement, target: ViewTarget): () => void {
  const tracker = createViewTracker(target);
  const onPlaying = () => tracker.playing();
  const onPause = () => tracker.paused();
  const onTimeUpdate = () => tracker.progress(media.currentTime, media.duration);
  media.addEventListener("playing", onPlaying);
  media.addEventListener("pause", onPause);
  media.addEventListener("ended", onPause);
  media.addEventListener("timeupdate", onTimeUpdate);
  return () => {
    media.removeEventListener("playing", onPlaying);
    media.removeEventListener("pause", onPause);
    media.removeEventListener("ended", onPause);
    media.removeEventListener("timeupdate", onTimeUpdate);
    tracker.dispose();
  };
}
