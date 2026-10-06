import { ImageResponse } from "next/og";
import { getVideoById } from "@/lib/videoDb";
import { MARK_HEIGHT, MARK_WIDTH, markSvg } from "@/lib/streamethMark";
import { joinNames, truncate } from "@/lib/seo";

const WIDTH = 1280;
const HEIGHT = 720;
const MARK_W = 56;
const MARK_H = Math.round((MARK_W * MARK_HEIGHT) / MARK_WIDTH);

/** A 16:9 title card for videos that have no cover image (about a quarter
 * of StreamETH sessions lost theirs with the old storage bucket). Google
 * won't index a video without a thumbnail, so the sitemap, VideoObject
 * JSON-LD and social cards all point here instead (see lib/seo.ts's
 * videoThumbnail). Rendered on first request, then cached by the CDN. */
export async function GET(_request: Request, ctx: RouteContext<"/watch/[id]/poster.png">) {
  const { id } = await ctx.params;
  const video = getVideoById(id);
  if (!video) return new Response("Not found", { status: 404 });

  const title = truncate(video.title, 110);
  const speakers = video.speakers.length > 0 ? joinNames(video.speakers, 3) : "";
  const venue = [video.eventName, video.orgName].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ");
  const mark = `data:image/svg+xml;base64,${Buffer.from(markSvg(MARK_W)).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #2c1f8f 0%, #4b2fd9 55%, #6d4ff0 100%)",
          fontFamily: "system-ui, sans-serif",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 84,
              height: 84,
              borderRadius: 20,
              background: "#ffffff",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={mark} width={MARK_W} height={MARK_H} />
          </div>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>StreamETH</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontSize: title.length > 70 ? 60 : 72,
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: -1.5,
            }}
          >
            {title}
          </div>
          {speakers && (
            <div style={{ display: "flex", fontSize: 34, color: "#e4defc" }}>{truncate(speakers, 80)}</div>
          )}
        </div>

        <div style={{ display: "flex", fontSize: 28, color: "#cfc6f7" }}>{truncate(venue, 90)}</div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        // Data refreshes daily; a week at the CDN keeps crawler hits cheap.
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    }
  );
}
