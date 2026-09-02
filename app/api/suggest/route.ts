import { NextResponse } from "next/server";
import { browseVideos } from "@/lib/videoDb";
import { EMPTY_FILTERS } from "@/lib/browseParams";

const LIMIT = 8;

// Powers the search-box dropdown (like YouTube/Google's autocomplete) —
// a handful of direct video matches you can jump straight to, distinct
// from submitting the query to the full filterable grid on `/`.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = browseVideos({ ...EMPTY_FILTERS, q, sort: "relevance" })
    .slice(0, LIMIT)
    .map((v) => ({
      id: v.id,
      title: v.title,
      orgName: v.orgName,
      coverImage: v.coverImage,
      durationSeconds: v.durationSeconds,
      watchUrl: v.watchUrl,
    }));

  return NextResponse.json({ results });
}
