import { createTikTokStyleCaptions, type Caption, type TikTokPage } from "@remotion/captions";
import { useMemo } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { COLORS, SANS } from "./theme.ts";

// Plain subtitles: words that start within this window share a line.
const PAGE_MS = 1800;
// A line stays up this long after its last word, unless the next one comes first.
const LINGER_MS = 400;

const Line: React.FC<{ page: TikTokPage; scale: number }> = ({ page, scale }) => {
  const u = scale;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 64 * u }}>
      <div
        style={{
          // Narrow enough to clear the corners, where venues put their own logos.
          maxWidth: 1100 * u,
          fontFamily: SANS,
          fontWeight: 600,
          fontSize: 42 * u,
          lineHeight: 1.3,
          textAlign: "center",
          color: COLORS.white,
          // An outline plus a soft shadow: legible on a white slide and on a dark stage.
          textShadow: `0 0 ${3 * u}px rgba(0,0,0,0.9), 0 ${2 * u}px ${10 * u}px rgba(0,0,0,0.6)`,
        }}
      >
        {page.text.trim()}
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{ captions: Caption[]; scale: number }> = ({ captions, scale }) => {
  const { fps } = useVideoConfig();
  const { pages } = useMemo(
    () => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: PAGE_MS }),
    [captions]
  );
  return (
    <AbsoluteFill>
      {pages.map((page, i) => {
        const next = pages[i + 1];
        const lastToken = page.tokens[page.tokens.length - 1];
        const endMs = Math.min(next ? next.startMs : Infinity, (lastToken?.toMs ?? page.startMs) + LINGER_MS);
        const from = Math.round((page.startMs / 1000) * fps);
        const durationInFrames = Math.round((endMs / 1000) * fps) - from;
        if (durationInFrames <= 0) return null;
        return (
          <Sequence key={page.startMs} from={from} durationInFrames={durationInFrames} layout="none">
            <Line page={page} scale={scale} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
