import { ImageResponse } from "next/og";
import { MARK_HEIGHT, MARK_WIDTH, markSvg } from "@/lib/streamethMark";

/** The installed-app icon: the StreamETH mark centred on white. The mark
 * fills 60% of the square so it stays inside the maskable safe zone (the
 * inner 80% circle) when Android crops the icon to a circle or squircle. */
export function renderAppIcon(size: number) {
  const width = Math.round(size * 0.6);
  const height = Math.round((width * MARK_HEIGHT) / MARK_WIDTH);
  const src = `data:image/svg+xml;base64,${Buffer.from(markSvg(width)).toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={src} width={width} height={height} />
      </div>
    ),
    { width: size, height: size }
  );
}
