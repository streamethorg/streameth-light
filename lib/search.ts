import "server-only";
import { lazy } from "./lazy";
import { getStore } from "./data";
import type { Session } from "./types";
import { listAllYoutubeVideos, getYoutubeTranscript } from "./youtube";
import type { YoutubeVideoWithChannel } from "./youtube";

type MatchField = "title" | "speaker" | "topic" | "description" | "transcript";

interface IndexedItem {
  type: "session" | "youtube";
  session?: Session;
  video?: YoutubeVideoWithChannel;
  title: string;
  speakerNames: string[];
  topics: string[];
  description: string;
  transcript: string;
}

const getSearchIndex = lazy((): IndexedItem[] => {
  const { sessions } = getStore();
  const items: IndexedItem[] = sessions.map((session) => ({
    type: "session",
    session,
    title: (session.name ?? "").toLowerCase(),
    speakerNames: (session.speakers ?? []).map((sp) => sp.name?.toLowerCase() ?? ""),
    topics: (session.autoLabels ?? []).map((t) => t.toLowerCase()),
    description: `${session.description ?? ""} ${session.aiDescription ?? ""}`.toLowerCase(),
    transcript: (session.transcripts?.text ?? "").toLowerCase(),
  }));

  for (const video of listAllYoutubeVideos()) {
    const transcript = getYoutubeTranscript(video.videoId) ?? "";
    items.push({
      type: "youtube",
      video,
      title: (video.title ?? "").toLowerCase(),
      speakerNames: [],
      topics: [],
      description: (video.description ?? "").toLowerCase(),
      transcript: transcript.toLowerCase(),
    });
  }

  return items;
});

export interface SearchMatch {
  type: "session" | "youtube";
  session?: Session;
  video?: YoutubeVideoWithChannel;
  score: number;
  matchedIn: MatchField[];
  snippet: string | null;
}

const SNIPPET_RADIUS = 120;

function extractSnippet(text: string, rawText: string, term: string): string | null {
  const idx = text.indexOf(term);
  if (idx === -1) return null;
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(rawText.length, idx + term.length + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < rawText.length ? "…" : "";
  return prefix + rawText.slice(start, end).trim() + suffix;
}

export function searchAll(query: string, limit = 30): SearchMatch[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (terms.length === 0) return [];

  const index = getSearchIndex();
  const results: SearchMatch[] = [];

  for (const entry of index) {
    let score = 0;
    const matchedIn = new Set<MatchField>();
    let allTermsFound = true;
    let snippetSource: { field: "transcript" | "description"; term: string } | null = null;

    for (const term of terms) {
      let foundThisTerm = false;

      if (entry.title.includes(term)) {
        score += 10;
        matchedIn.add("title");
        foundThisTerm = true;
      }
      if (entry.speakerNames.some((n) => n.includes(term))) {
        score += 8;
        matchedIn.add("speaker");
        foundThisTerm = true;
      }
      if (entry.topics.some((t) => t.includes(term))) {
        score += 6;
        matchedIn.add("topic");
        foundThisTerm = true;
      }
      if (entry.description.includes(term)) {
        score += 3;
        matchedIn.add("description");
        foundThisTerm = true;
        if (!snippetSource) snippetSource = { field: "description", term };
      }
      if (entry.transcript.includes(term)) {
        score += 1;
        matchedIn.add("transcript");
        foundThisTerm = true;
        snippetSource = { field: "transcript", term };
      }

      if (!foundThisTerm) {
        allTermsFound = false;
        break;
      }
    }

    if (!allTermsFound || score === 0) continue;

    // Real StreamETH sessions (playable, transcript-searched) outrank YouTube
    // videos (title/description only, or auto-caption transcript) at equal
    // term-match score, since they're the primary archive.
    if (entry.type === "session") score += 0.5;

    let snippet: string | null = null;
    if (snippetSource) {
      const rawText =
        entry.type === "session"
          ? snippetSource.field === "transcript"
            ? entry.session!.transcripts?.text ?? ""
            : `${entry.session!.description ?? ""} ${entry.session!.aiDescription ?? ""}`
          : snippetSource.field === "transcript"
            ? getYoutubeTranscript(entry.video!.videoId) ?? ""
            : entry.video!.description ?? "";
      const lowerText =
        snippetSource.field === "transcript" ? entry.transcript : entry.description;
      snippet = extractSnippet(lowerText, rawText, snippetSource.term);
    }

    results.push({
      type: entry.type,
      session: entry.session,
      video: entry.video,
      score,
      matchedIn: [...matchedIn],
      snippet,
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTime = a.session?.start ?? new Date(a.video?.publishedAt ?? 0).getTime();
    const bTime = b.session?.start ?? new Date(b.video?.publishedAt ?? 0).getTime();
    return bTime - aTime;
  });
  return results.slice(0, limit);
}
