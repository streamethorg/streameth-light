import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// Rises and fades in, starting `delay` frames into its parent sequence.
export const Reveal: React.FC<{ delay: number; distance: number; children: React.ReactNode }> = ({ delay, distance, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: Math.round(0.7 * fps) });
  return (
    <div style={{ opacity: t, transform: `translateY(${interpolate(t, [0, 1], [distance, 0])}px)` }}>{children}</div>
  );
};
