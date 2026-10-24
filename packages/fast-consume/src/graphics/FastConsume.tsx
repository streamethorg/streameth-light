import { Video } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Captions } from "./Captions.tsx";
import { Mark } from "./Logo.tsx";
import { LowerThird } from "./LowerThird.tsx";
import { Music } from "./Music.tsx";
import { OutroCard } from "./OutroCard.tsx";
import { ProgressBar } from "./ProgressBar.tsx";
import type { FastConsumeProps } from "./props.ts";
import { COLORS } from "./theme.ts";
import { LOWER_THIRD_IN_S, LOWER_THIRD_S, timeline } from "./timing.ts";

export const FastConsume: React.FC<FastConsumeProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const t = timeline(fps, props.videoDurationS);
  // Every size is designed at 1080p and scaled to the source's height.
  const scale = height / 1080;
  const bugOpacity = 0.85 * interpolate(frame, [0, fps], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink }}>
      <Sequence durationInFrames={t.videoFrames}>
        <Video src={staticFile(props.videoSrc)} objectFit="contain" style={{ width: "100%", height: "100%" }} />
        <Captions captions={props.captions} scale={scale} />
        <ProgressBar durationS={props.videoDurationS} scale={scale} />
        <AbsoluteFill style={{ alignItems: "flex-end", padding: `${40 * scale}px ${48 * scale}px`, opacity: bugOpacity }}>
          <Mark height={34 * scale} color={COLORS.white} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={Math.round(LOWER_THIRD_IN_S * fps)} durationInFrames={Math.round(LOWER_THIRD_S * fps)}>
        <LowerThird speakers={props.speakers} title={props.title} event={props.event} scale={scale} />
      </Sequence>
      <Sequence from={t.outroFrom} durationInFrames={t.outroFrames}>
        <OutroCard
          thesis={props.thesis}
          speakers={props.speakers}
          title={props.title}
          url={props.url}
          fadeFrames={t.fadeFrames}
          scale={scale}
        />
      </Sequence>
      {props.musicSrc && <Music src={props.musicSrc} fps={fps} timeline={t} />}
    </AbsoluteFill>
  );
};
