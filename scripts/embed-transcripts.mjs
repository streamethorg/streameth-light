// Chunks and embeds every talk's transcript, upserting the result into
// Supabase's transcript_chunks table (see
// supabase/migrations/00000000000006_transcript_chunks.sql) — the backing
// store for semantic search in lib/ask.ts and lib/transcriptChunks.ts, now
// that transcript text no longer lives in data/streameth.db.
//
// Reads from the same sources build-db.mjs does: data/transcripts.json
// (StreamETH, keyed by session _id) and data/sources/youtube-transcripts/
// shard-*.json (see scripts/transcript_shards.py), plus the legacy
// data/sources/youtube-transcripts.json if it still exists.
//
// Resumable: a video with any chunk already stored at chunk_index 0 is
// skipped, so a daily run (scoped externally to data/sources/new-video-ids.json,
// same convention as pull-youtube-metadata.py) or an interrupted backfill
// only pays for what's actually new.
//
// Needs OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY (plus the existing
// NEXT_PUBLIC_SUPABASE_URL) in the environment — `node --env-file=.env.local
// scripts/embed-transcripts.mjs`, or already-exported env vars in CI.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DATA_DIR = join(process.cwd(), "data");
const CHUNK_CHARS = 900;
const EMBED_BATCH = 100;
const EMBEDDING_MODEL = "text-embedding-3-small";
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2000;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} — set it in the environment (or .env.local) before running this script.`);
    process.exit(1);
  }
  return value;
}

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
requireEnv("OPENAI_API_KEY");

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function loadJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

// Same sharding scheme as scripts/transcript_shards.py — reading every
// shard file present is simpler than reimplementing its hash here, since
// this script only ever reads, never writes, the sharded directory.
function loadYoutubeTranscripts() {
  const result = { ...(loadJson(join(DATA_DIR, "sources", "youtube-transcripts.json")) ?? {}) };
  const dir = join(DATA_DIR, "sources", "youtube-transcripts");
  if (existsSync(dir)) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      Object.assign(result, loadJson(join(dir, file)) ?? {});
    }
  }
  return result;
}

function decodeEntities(text) {
  return text
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Splits transcript text into ~CHUNK_CHARS passages on word boundaries —
 * the same shape as lib/ask.ts's talkContext(), so a chunk read back from
 * Postgres looks like what Ask already expects a passage to look like. */
function chunkText(body) {
  const chunks = [];
  let start = 0;
  while (start < body.length) {
    let end = Math.min(start + CHUNK_CHARS, body.length);
    if (end < body.length) {
      const space = body.lastIndexOf(" ", end);
      if (space > start) end = space;
    }
    const chunk = body.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start = end + 1;
  }
  return chunks;
}

/** Every video_id that already has at least one chunk stored, paginated
 * since Supabase caps rows per request. */
async function loadDoneVideoIds() {
  const done = new Set();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from("transcript_chunks")
      .select("video_id")
      .eq("chunk_index", 0)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const row of data) done.add(row.video_id);
    if (data.length < pageSize) break;
  }
  return done;
}

async function embedBatch(texts) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
      });
      if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text().catch(() => "")}`);
      const body = await res.json();
      return body.data.map((d) => d.embedding);
    } catch (err) {
      lastError = err;
      console.error(`  embed batch failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${err.message}`);
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * attempt));
    }
  }
  throw lastError;
}

async function main() {
  const streamethTranscripts = loadJson(join(DATA_DIR, "transcripts.json")) ?? {};
  const youtubeTranscripts = loadYoutubeTranscripts();

  const doneVideoIds = await loadDoneVideoIds();
  console.log(`${doneVideoIds.size} videos already embedded`);

  // Flat queue of chunks still to embed, spanning both sources — batched
  // for the embeddings call independent of which video or source a chunk
  // came from.
  const pending = [];
  let candidateVideos = 0;

  for (const [sessionId, entry] of Object.entries(streamethTranscripts)) {
    const text = entry?.text;
    if (!text || doneVideoIds.has(sessionId)) continue;
    candidateVideos++;
    const body = decodeEntities(text).replace(/\s+/g, " ").trim();
    chunkText(body).forEach((content, chunkIndex) => {
      pending.push({ video_id: sessionId, source: "streameth", chunk_index: chunkIndex, content });
    });
  }

  for (const [videoId, text] of Object.entries(youtubeTranscripts)) {
    const id = `yt-${videoId}`;
    if (!text || doneVideoIds.has(id)) continue;
    candidateVideos++;
    const body = decodeEntities(text).replace(/\s+/g, " ").trim();
    chunkText(body).forEach((content, chunkIndex) => {
      pending.push({ video_id: id, source: "youtube", chunk_index: chunkIndex, content });
    });
  }

  console.log(`${candidateVideos} videos to embed, ${pending.length} chunks total`);
  if (pending.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let embedded = 0;
  for (let i = 0; i < pending.length; i += EMBED_BATCH) {
    const batch = pending.slice(i, i + EMBED_BATCH);
    const embeddings = await embedBatch(batch.map((c) => c.content));
    const rows = batch.map((c, j) => ({ ...c, embedding: embeddings[j] }));
    const { error } = await db.from("transcript_chunks").upsert(rows, { onConflict: "video_id,chunk_index" });
    if (error) throw error;
    embedded += batch.length;
    console.log(`[${embedded}/${pending.length}] chunks embedded and stored`);
  }

  console.log(`done: ${embedded} chunks across ${candidateVideos} videos`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
