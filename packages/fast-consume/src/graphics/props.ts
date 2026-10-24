import type { Caption } from "@remotion/captions";

// Everything the composition draws, passed in as inputProps by render.ts.
export type FastConsumeProps = {
  // The condensed cut, by its name in the bundle's public dir.
  videoSrc: string;
  // Background music in the same dir; empty for none.
  musicSrc: string;
  width: number;
  height: number;
  fps: number;
  videoDurationS: number;
  sourceDurationS: number;
  title: string;
  speakers: string[];
  event: string;
  url: string;
  thesis: string;
  captions: Caption[];
};
