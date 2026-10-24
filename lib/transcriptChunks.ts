import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lazy } from "./lazy";

/** Transcript text and its embeddings, in Supabase Postgres (pgvector) —
 * not data/streameth.db, which stopped scaling once the YouTube backfill's
 * transcript text pushed it past Vercel's 250MB function size limit. See
 * supabase/migrations/00000000000006_transcript_chunks.sql and
 * scripts/embed-transcripts.mjs (the ingestion side). */

// Through OpenRouter, not api.openai.com directly — reuses the same
// OPENROUTER_API_KEY already configured for lib/ask.ts's chat completions,
// so no separate OpenAI account/key is needed.
const EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
// Stored embeddings are halfvec(512), not the model's native 1536 — see
// supabase/migrations/00000000000008_transcript_chunks_halfvec512.sql.
// scripts/embed-transcripts.mjs applies the same reduction on the write side.
export const EMBEDDING_DIMENSIONS = 512;

/** Cuts a text-embedding-3 vector down to its first EMBEDDING_DIMENSIONS
 * values and re-normalizes it to unit length — what the model's own
 * `dimensions` parameter does, done client-side so it doesn't depend on
 * OpenRouter forwarding that parameter. */
export function toStoredEmbedding(embedding: number[]): number[] {
  const prefix = embedding.slice(0, EMBEDDING_DIMENSIONS);
  const norm = Math.sqrt(prefix.reduce((sum, x) => sum + x * x, 0));
  return norm > 0 ? prefix.map((x) => x / norm) : prefix;
}

export interface ChunkMatch {
  videoId: string;
  source: "streameth" | "youtube";
  chunkIndex: number;
  content: string;
  similarity: number;
}

const getAdmin = lazy(
  (): SupabaseClient =>
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
);

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function ragConfigured(): boolean {
  return supabaseConfigured() && Boolean(process.env.OPENROUTER_API_KEY);
}

/** Embeds a single query string for similarity search, reduced to the
 * stored dimensionality (see toStoredEmbedding). */
export async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch(EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`OpenRouter embeddings ${res.status}: ${await res.text().catch(() => "")}`);
  const body = (await res.json()) as { data: { embedding: number[] }[] };
  return toStoredEmbedding(body.data[0].embedding);
}

/** The chunks whose embeddings are closest to `queryEmbedding`, ranked by
 * cosine similarity (highest first); empty when Supabase isn't configured,
 * matching lib/jev.ts's "fall back to keeping everything" shape for an
 * optional integration. */
export async function matchChunks(
  queryEmbedding: number[],
  matchCount: number,
  /** Only search these videos' chunks (e.g. one event's talks). */
  videoIds?: string[]
): Promise<ChunkMatch[]> {
  if (!supabaseConfigured()) return [];
  if (videoIds && videoIds.length === 0) return [];
  const { data, error } = videoIds
    ? await getAdmin().rpc("match_transcript_chunks_in", {
        query_embedding: queryEmbedding,
        video_ids: videoIds,
        match_count: matchCount,
      })
    : await getAdmin().rpc("match_transcript_chunks", {
        query_embedding: queryEmbedding,
        match_count: matchCount,
      });
  if (error) throw error;
  return (data as { video_id: string; source: "streameth" | "youtube"; chunk_index: number; content: string; similarity: number }[]).map(
    (row) => ({
      videoId: row.video_id,
      source: row.source,
      chunkIndex: row.chunk_index,
      content: row.content,
      similarity: row.similarity,
    })
  );
}

/** A video's chunks in reading order; empty when Supabase isn't configured
 * or the request fails, so a watch page renders without a transcript panel
 * instead of 500ing — and, since 2000+ StreamETH watch pages call this
 * during `next build`'s static generation, a single transient Supabase
 * error can't take down the whole build the way it did once here (a bad
 * key turned into a build-wide crash instead of one missing transcript). */
export async function getTranscriptChunks(videoId: string): Promise<{ chunkIndex: number; content: string }[]> {
  if (!supabaseConfigured()) return [];
  try {
    const { data, error } = await getAdmin()
      .from("transcript_chunks")
      .select("chunk_index, content")
      .eq("video_id", videoId)
      .order("chunk_index", { ascending: true });
    if (error) throw error;
    return (data as { chunk_index: number; content: string }[]).map((row) => ({
      chunkIndex: row.chunk_index,
      content: row.content,
    }));
  } catch (err) {
    console.error(`[transcriptChunks] failed to load chunks for ${videoId}:`, err);
    return [];
  }
}

/** The full transcript text for one video, reassembled from its chunks;
 * null if it has none. */
export async function getFullTranscript(videoId: string): Promise<string | null> {
  const chunks = await getTranscriptChunks(videoId);
  if (chunks.length === 0) return null;
  return chunks.map((c) => c.content).join(" ");
}
