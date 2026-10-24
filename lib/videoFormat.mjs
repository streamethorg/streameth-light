// What kind of video something is — a vertical Short, a medium-length clip
// (interview, recap, lightning talk), a full talk, or a livestream — decided
// from which YouTube channel tab listed it and its duration. Shared by the
// app and the search-index build (scripts/build-db.mjs), like autoLabels.mjs.

/** @typedef {"short" | "clip" | "talk" | "stream"} VideoFormat */

/** @type {VideoFormat[]} */
export const VIDEO_FORMATS = ["talk", "clip", "short", "stream"];

// Same cut-off as lib/browseParams.ts's "medium" duration bucket.
export const CLIP_MAX_SECONDS = 20 * 60;

/**
 * @param {{
 *   source: "streameth" | "youtube",
 *   tab?: string | null,
 *   liveStatus?: string | null,
 *   durationSeconds?: number | null,
 * }} video
 * @returns {VideoFormat}
 */
export function videoFormat({ source, tab, liveStatus, durationSeconds }) {
  // StreamETH sessions are stage recordings: one talk each.
  if (source === "streameth") return "talk";
  if (tab === "shorts") return "short";
  if (tab === "streams" || liveStatus) return "stream";
  // Under 4 minutes but listed under /videos, not /shorts, is landscape: a
  // clip, not a Short.
  if (typeof durationSeconds === "number" && durationSeconds <= CLIP_MAX_SECONDS) return "clip";
  return "talk";
}

/**
 * @param {string | null | undefined} value
 * @returns {VideoFormat | undefined}
 */
export function parseVideoFormat(value) {
  return VIDEO_FORMATS.find((f) => f === value);
}
