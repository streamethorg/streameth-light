import { NextResponse } from "next/server";
import { searchVideosDetailed } from "@/lib/videoDb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ query: q, results: [] });
  }

  const matches = searchVideosDetailed(q, 30);

  const results = matches.map(({ video, matchedIn, snippet }) => ({
    type: video.source === "streameth" ? ("session" as const) : ("youtube" as const),
    id: video.id,
    name: video.title,
    eventName: video.eventName || video.orgName,
    coverImage: video.coverImage,
    speakers: video.speakers,
    topics: video.topics,
    matchedIn,
    snippet,
    href: video.watchUrl,
  }));

  return NextResponse.json({ query: q, results });
}
