import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SANS } from "./theme.ts";

// Broadcast-style name strap over the opening seconds of the talk: the
// speaker on a white bar, the talk's title on a brand-color bar below. Each
// bar wipes in from the left and back out.
const WIPE_S = 0.35;

function wipe(frame: number, fps: number, durationInFrames: number, delay: number): number {
  const w = Math.round(WIPE_S * fps);
  const ease = Easing.bezier(0.2, 0, 0, 1);
  const inn = interpolate(frame - delay, [0, w], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const out = interpolate(frame, [durationInFrames - w - delay, durationInFrames - delay], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return Math.min(inn, out);
}

export const LowerThird: React.FC<{ speakers: string[]; title: string; event: string; scale: number }> = ({
  speakers,
  title,
  event,
  scale,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const u = scale;
  const top = wipe(frame, fps, durationInFrames, 0);
  const bottom = wipe(frame, fps, durationInFrames, Math.round(0.08 * fps));
  const clip = (p: number) => `inset(0 ${(1 - p) * 100}% 0 0)`;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: `0 0 ${200 * u}px ${96 * u}px` }}>
      {speakers.length > 0 && (
        <div
          style={{
            clipPath: clip(top),
            backgroundColor: COLORS.white,
            color: COLORS.ink,
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 40 * u,
            lineHeight: 1,
            padding: `${16 * u}px ${24 * u}px`,
          }}
        >
          {speakers.join(", ")}
        </div>
      )}
      <div
        style={{
          clipPath: clip(bottom),
          backgroundColor: COLORS.brand,
          color: COLORS.white,
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: 30 * u,
          lineHeight: 1.25,
          padding: `${13 * u}px ${24 * u}px`,
          maxWidth: 1300 * u,
        }}
      >
        {title}
        {event && <span style={{ opacity: 0.7 }}>{`  ·  ${event}`}</span>}
      </div>
    </AbsoluteFill>
  );
};
