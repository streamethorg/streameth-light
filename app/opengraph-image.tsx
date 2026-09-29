import { ImageResponse } from "next/og";

export const alt = "StreamETH — Ethereum ecosystem video archive";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Falls through to every route that doesn't set its own openGraph.images
// (see lib/social.ts) — statically generated once at build time, not per
// request, so it's cheap regardless of how many routes inherit it.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #2c1f8f 0%, #4b2fd9 55%, #6d4ff0 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "rgba(255,255,255,0.16)",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
          }}
        >
          ▶
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 700,
            color: "#ffffff",
            marginTop: 32,
            letterSpacing: -2,
          }}
        >
          StreamETH
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#cfc6f7",
            marginTop: 24,
            maxWidth: 900,
          }}
        >
          Talks, panels and livestreams from Ethereum ecosystem events
        </div>
      </div>
    ),
    { ...size }
  );
}
