import { Composition, type CalculateMetadataFunction } from "remotion";
import { FastConsume } from "./FastConsume.tsx";
import type { FastConsumeProps } from "./props.ts";
import { timeline } from "./timing.ts";

// Size, frame rate and length all follow the condensed cut, which render.ts
// probes and passes in.
const calculateMetadata: CalculateMetadataFunction<FastConsumeProps> = ({ props }) => ({
  width: props.width,
  height: props.height,
  fps: props.fps,
  durationInFrames: timeline(props.fps, props.videoDurationS).totalFrames,
});

const defaultProps: FastConsumeProps = {
  videoSrc: "cut.mp4",
  musicSrc: "",
  width: 1920,
  height: 1080,
  fps: 30,
  videoDurationS: 60,
  sourceDurationS: 600,
  title: "",
  speakers: [],
  event: "",
  url: "",
  thesis: "",
  captions: [],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="FastConsume"
    component={FastConsume}
    width={defaultProps.width}
    height={defaultProps.height}
    fps={defaultProps.fps}
    durationInFrames={timeline(defaultProps.fps, defaultProps.videoDurationS).totalFrames}
    defaultProps={defaultProps}
    calculateMetadata={calculateMetadata}
  />
);
