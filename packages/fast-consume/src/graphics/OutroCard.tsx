import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Logo } from "./Logo.tsx";
import { Reveal } from "./Reveal.tsx";
import { COLORS, SANS } from "./theme.ts";

// Solid brand color, the talk's point in large type, and where to watch the
// whole thing.
export const OutroCard: React.FC<{
  thesis: string;
  speakers: string[];
  title: string;
  url: string;
  fadeFrames: number;
  scale: number;
}> = ({ thesis, speakers, title, url, fadeFrames, scale }) => {
  const frame = useCurrentFrame();
  const u = scale;
  const opacity = interpolate(frame, [0, fadeFrames], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity, backgroundColor: COLORS.brand }}>
      <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${140 * u}px` }}>
        <Reveal delay={fadeFrames} distance={20 * u}>
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 84 * u,
              lineHeight: 1.08,
              letterSpacing: -2 * u,
              color: COLORS.white,
              maxWidth: 1450 * u,
              textWrap: "balance",
              textIndent: thesis ? -0.42 * 84 * u : 0,
            }}
          >
            {thesis ? `“${thesis}”` : title}
          </div>
        </Reveal>
        {thesis && speakers.length > 0 && (
          <Reveal delay={fadeFrames + 6} distance={14 * u}>
            <div style={{ marginTop: 32 * u, fontFamily: SANS, fontWeight: 500, fontSize: 36 * u, color: "rgba(255,255,255,0.72)" }}>
              {speakers.join(", ")}
            </div>
          </Reveal>
        )}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          padding: `0 ${140 * u}px ${100 * u}px`,
        }}
      >
        <Logo height={40 * u} color={COLORS.white} />
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 28 * u, color: "rgba(255,255,255,0.72)" }}>
          {url ? `Full talk: ${url.replace(/^https?:\/\/(www\.)?/, "")}` : "Full talk on streameth.org"}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
