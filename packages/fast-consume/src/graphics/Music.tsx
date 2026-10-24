import { Audio } from "@remotion/media";
import { interpolate, staticFile } from "remotion";
import type { Timeline } from "./timing.ts";

// A quiet bed under the speaker that comes up on the closing card, faded
// at both ends.
const UNDER_SPEECH_VOLUME = 0.06;
const CARD_VOLUME = 0.5;
const SWELL_S = 1;
const END_FADE_S = 1.5;

export function musicVolume(frame: number, fps: number, t: Timeline): number {
  return interpolate(
    frame,
    [
      0,
      Math.round(1 * fps),
      t.videoFrames - Math.round(SWELL_S * fps),
      t.videoFrames,
      t.totalFrames - Math.round(END_FADE_S * fps),
      t.totalFrames,
    ],
    [0, UNDER_SPEECH_VOLUME, UNDER_SPEECH_VOLUME, CARD_VOLUME, CARD_VOLUME, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
}

export const Music: React.FC<{ src: string; fps: number; timeline: Timeline }> = ({ src, fps, timeline }) => (
  // Looped for a cut longer than the track; "extend" keeps the frame count
  // running across loops, so the volume curve follows the whole timeline.
  <Audio src={staticFile(src)} loop loopVolumeCurveBehavior="extend" volume={(f: number) => musicVolume(f, fps, timeline)} />
);
