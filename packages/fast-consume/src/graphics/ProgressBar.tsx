import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "./theme.ts";

// A hairline along the bottom edge of the cut, showing how far through it the viewer is.
export const ProgressBar: React.FC<{ durationS: number; scale: number }> = ({ durationS, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = Math.min(1, frame / fps / durationS);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div style={{ height: Math.max(2, Math.round(4 * scale)), backgroundColor: "rgba(255, 255, 255, 0.2)" }}>
        <div style={{ height: "100%", width: `${progress * 100}%`, backgroundColor: COLORS.white }} />
      </div>
    </AbsoluteFill>
  );
};
