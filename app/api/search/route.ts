import { NextResponse } from "next/server";
import { searchAll } from "@/lib/search";
import { getEventById } from "@/lib/data";
import { getDirectoryEntry } from "@/lib/directory";
import { findGroupSlugForVideo } from "@/lib/youtube";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ query: q, results: [] });
  }

  const matches = searchAll(q, 30);

  const results = matches.map((m) => {
    if (m.type === "session") {
      const session = m.session!;
      const event = getEventById(session.eventId);
      return {
        type: "session" as const,
        id: session._id,
        name: session.name,
        eventName: event?.name ?? session.eventSlug,
        coverImage: session.coverImage ?? null,
        speakers: (session.speakers ?? []).map((sp) => sp.name),
        topics: session.autoLabels ?? [],
        score: m.score,
        matchedIn: m.matchedIn,
        snippet: m.snippet,
        href: `/watch/${session._id}`,
      };
    }

    const video = m.video!;
    const entry = getDirectoryEntry(video.channelSlug);
    const groupSlug = findGroupSlugForVideo(video.channelSlug, video.videoId);
    return {
      type: "youtube" as const,
      id: video.videoId,
      name: video.title,
      eventName: entry?.name ?? video.channelSlug,
      coverImage: video.thumbnail,
      speakers: [] as string[],
      topics: [] as string[],
      score: m.score,
      matchedIn: m.matchedIn,
      snippet: m.snippet,
      href: groupSlug
        ? `/${video.channelSlug}/y/${groupSlug}?v=${video.videoId}`
        : `https://www.youtube.com/watch?v=${video.videoId}`,
    };
  });

  return NextResponse.json({ query: q, results });
}
