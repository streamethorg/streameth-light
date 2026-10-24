import "server-only";
import { z } from "zod";
import { getVideoById, getVideosByIds, type UnifiedVideo } from "./videoDb";
import { embedQuery, getTranscriptChunks, matchChunks } from "./transcriptChunks";
import { formatDateShort } from "./format";
import { videoLink } from "./videoLink";
import { SITE_NAME, SITE_URL } from "./social";
import { relevanceThreshold, scorePassages } from "./jev";

/** One talk the answer can cite as [n]. */
export interface AskSource {
  n: number;
  videoId: string;
  title: string;
  speakers: string[];
  event: string;
  channel: string;
  date: string | null;
  watchUrl: string;
  coverImage: string | null;
  /** The passage the model read, for the source card. */
  excerpt: string;
}

export type AskEvent =
  | { type: "search"; query: string }
  | { type: "sources"; sources: AskSource[] }
  | { type: "text"; text: string }
  /** Drop the text streamed so far: it was narration before a search, not the answer. */
  | { type: "discard" }
  | { type: "done" }
  | { type: "error"; message: string };

// Any OpenRouter model with tool calling works; override with OPENROUTER_MODEL.
// DeepSeek V4 Flash: ~$0.005/M input, $1.28/M output — answers on par with
// Opus 5.5 in side-by-side tests here at a tiny fraction of the cost (most
// of each request is input: search results and transcripts).
const DEFAULT_MODEL = "deepseek/deepseek-v4-flash";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Rounds of searching (a round may run a few queries in parallel), then a
// final turn with no tools that has to answer.
const MAX_SEARCH_ROUNDS = 4;
const MAX_QUERIES_PER_ROUND = 3;
const VIDEOS_PER_SEARCH = 6;
const PASSAGES_PER_VIDEO = 2;
export const MAX_QUESTION_CHARS = 500;
// How much of a talk's transcript goes in when asking about that talk.
const TALK_CONTEXT_CHARS = 40_000;

const SYSTEM = `You answer questions using the StreamETH archive: transcripts and descriptions of talks, panels and workshops from Ethereum conferences and meetups (Devcon, EthCC, ETHGlobal, and many more).

How to work:
- Call search_archive with short keyword queries (2-5 words, the terms a speaker would actually say). Search again with different wording or narrower terms if the first results don't cover the question. Stop searching once you have enough.
- Answer only from what the search results say. Each result passage is numbered like [3]; cite the passages you rely on with those numbers right after the claim, e.g. "Danksharding splits data into blobs [2][5]." Every factual sentence needs a citation.
- Name the speaker when you attribute a view ("Dankrad Feist argues…").
- If the archive doesn't cover the question, say so plainly in one or two sentences and, if useful, mention the closest talks you did find. Never fill gaps from general knowledge.
- Transcripts are automatic and can misspell names and jargon; read through obvious transcription errors.
- Write for someone skimming: lead with the direct answer, then a few short paragraphs or a short bullet list. Plain markdown only (paragraphs, "- " bullets, **bold**). No headings, no preamble, no closing offer.
- Latency-sensitive; begin your visible answer as soon as you have enough to go on.`;

const SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_archive",
    description:
      "Full-text search over the archive's talk titles, speakers, descriptions and transcripts. Returns the best-matching talks with numbered passages to cite.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: 'Short keyword query, e.g. "based rollups sequencing" or "Vitalik account abstraction"',
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
} as const;

const SearchInput = z.object({ query: z.string().min(1).max(200) });

export function askConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function talkHeader(v: UnifiedVideo): string {
  return [
    `Talk: ${v.title}`,
    v.speakers.length ? `Speakers: ${v.speakers.join(", ")}` : "",
    v.eventName ? `Event: ${v.eventName}` : "",
    v.orgName ? `Channel: ${v.orgName}` : "",
    v.publishedAt ? `Date: ${new Date(v.publishedAt).toISOString().slice(0, 10)}` : "",
    v.hasTranscript ? "" : "(no transcript — passage is from the description)",
  ]
    .filter(Boolean)
    .join("\n");
}

// Overfetches chunks beyond VIDEOS_PER_SEARCH × PASSAGES_PER_VIDEO so there's
// enough similarity-ranked material to fill that many distinct videos even
// when the top matches cluster on just a few talks.
const CHUNK_MATCH_COUNT = VIDEOS_PER_SEARCH * PASSAGES_PER_VIDEO * 5;

/** Runs one semantic search over transcript chunks (via Supabase pgvector),
 * drops passages Jev judges irrelevant to the user's question (when
 * configured), and registers the rest as citable sources. */
async function runSearch(
  query: string,
  question: string,
  sources: AskSource[],
  seen: Map<string, number>,
  /** Only search these videos (an event's talks). */
  scopeIds?: string[]
): Promise<{ text: string; added: AskSource[] }> {
  const queryEmbedding = await embedQuery(query);
  const matches = await matchChunks(queryEmbedding, CHUNK_MATCH_COUNT, scopeIds);
  if (matches.length === 0) return { text: `No talks matched "${query}".`, added: [] };

  // Group by video in similarity order, capped at VIDEOS_PER_SEARCH distinct
  // videos and PASSAGES_PER_VIDEO chunks each.
  const byVideo = new Map<string, typeof matches>();
  for (const m of matches) {
    if (!byVideo.has(m.videoId) && byVideo.size >= VIDEOS_PER_SEARCH) continue;
    const list = byVideo.get(m.videoId) ?? [];
    if (list.length >= PASSAGES_PER_VIDEO) continue;
    list.push(m);
    byVideo.set(m.videoId, list);
  }

  const videoIds = [...byVideo.keys()];
  const videoById = new Map(getVideosByIds(videoIds).map((v) => [v.id, v]));
  const candidates = videoIds.flatMap((id) => {
    const video = videoById.get(id);
    if (!video) return [];
    // Reading order within the talk, not similarity order.
    const chunks = [...byVideo.get(id)!].sort((a, b) => a.chunkIndex - b.chunkIndex);
    return chunks.map((c) => ({ video, excerpt: c.content }));
  });
  if (candidates.length === 0) return { text: `No talks matched "${query}".`, added: [] };

  const scores = await scorePassages(
    question,
    candidates.map((c) => `${talkHeader(c.video)}\n${c.excerpt}`)
  );
  const threshold = relevanceThreshold();
  const kept = scores ? candidates.filter((_, i) => scores[i] >= threshold) : candidates;
  if (kept.length === 0) {
    return {
      text: `Talks matched "${query}", but none of their passages address the question. Try other keywords.`,
      added: [],
    };
  }

  const added: AskSource[] = [];
  const orderedVideos = videoIds.map((id) => videoById.get(id)).filter((v): v is UnifiedVideo => Boolean(v));
  const blocks = orderedVideos.flatMap((v) => {
    const passages = kept.filter((c) => c.video === v).map((c) => c.excerpt);
    if (passages.length === 0) return [];

    const numbered = passages.map((excerpt) => {
      const key = `${v.id}:${excerpt.slice(0, 80)}`;
      let n = seen.get(key);
      if (n === undefined) {
        n = sources.length + 1;
        seen.set(key, n);
        const source: AskSource = {
          n,
          videoId: v.id,
          title: v.title,
          speakers: v.speakers,
          event: v.eventName,
          channel: v.orgName,
          date: v.publishedAt ? formatDateShort(v.publishedAt) : null,
          watchUrl: videoLink(v),
          coverImage: v.coverImage,
          excerpt,
        };
        sources.push(source);
        added.push(source);
      }
      return `[${n}] ${excerpt}`;
    });
    return [`${talkHeader(v)}\n${numbered.join("\n")}`];
  });

  return { text: blocks.join("\n\n---\n\n"), added };
}

const FINAL_TURN_INSTRUCTION =
  "No more searches are available. Answer the question now using only the search results above, citing passages as [n]. If they don't cover it, say so plainly in a sentence or two and mention the closest talks found, if any.";

// Some models (seen with DeepSeek) occasionally write a tool call into the
// text in their native markup — "<｜DSML｜tool_calls>…", "<|tool▁calls…" —
// instead of a real tool call. None of it belongs in an answer.
const TOOL_MARKUP = /<\s*[|｜]|<\/?tool_call/;

function stripToolMarkup(text: string): string {
  const at = text.search(TOOL_MARKUP);
  return at === -1 ? text : text.slice(0, at).trimEnd();
}

/** Streams text through while holding back anything that might be the
 * start of tool-call markup ("<"); once markup is confirmed, everything
 * after it is dropped. */
class MarkupGuard {
  private pending = "";
  private blocked = false;
  sawMarkup = false;

  push(chunk: string): string {
    if (this.blocked) return "";
    this.pending += chunk;
    let out = "";
    for (;;) {
      const lt = this.pending.indexOf("<");
      if (lt === -1) {
        out += this.pending;
        this.pending = "";
        return out;
      }
      out += this.pending.slice(0, lt);
      this.pending = this.pending.slice(lt);
      if (TOOL_MARKUP.test(this.pending.slice(0, 12))) {
        this.blocked = true;
        this.sawMarkup = true;
        this.pending = "";
        return out;
      }
      // Not enough characters yet to tell: wait for more.
      if (this.pending.length < 12) return out;
      // An ordinary "<": let it through and keep scanning.
      out += "<";
      this.pending = this.pending.slice(1);
    }
  }

  flush(): string {
    if (this.blocked) return "";
    const rest = stripToolMarkup(this.pending);
    if (rest !== this.pending) this.sawMarkup = true;
    this.pending = "";
    return rest;
  }
}

/** The model provider is out of capacity or credits for now. */
export class AskBusyError extends Error {}

function registerSource(
  video: UnifiedVideo,
  excerpt: string,
  sources: AskSource[],
  seen: Map<string, number>
): AskSource {
  const key = `${video.id}:${excerpt.slice(0, 80)}`;
  const n = sources.length + 1;
  seen.set(key, n);
  const source: AskSource = {
    n,
    videoId: video.id,
    title: video.title,
    speakers: video.speakers,
    event: video.eventName,
    channel: video.orgName,
    date: video.publishedAt ? formatDateShort(video.publishedAt) : null,
    watchUrl: videoLink(video),
    coverImage: video.coverImage,
    excerpt,
  };
  sources.push(source);
  return source;
}

/** The talk a question is about, split into numbered, citable passages:
 * its transcript in reading order (capped, ~40k chars), read from its
 * precomputed chunks (lib/transcriptChunks.ts) — or its description when
 * there's no transcript. */
async function talkContext(
  video: UnifiedVideo,
  sources: AskSource[],
  seen: Map<string, number>
): Promise<{ text: string; added: AskSource[] }> {
  const chunks = video.hasTranscript ? await getTranscriptChunks(video.id) : [];

  if (chunks.length === 0) {
    const body = decodeEntities(video.description || "").replace(/\s+/g, " ").trim();
    if (!body) return { text: `${talkHeader(video)}\n(no transcript or description)`, added: [] };
    const source = registerSource(video, body, sources, seen);
    return { text: `${talkHeader(video)}\n[${source.n}] ${body}`, added: [source] };
  }

  let totalChars = 0;
  const included: typeof chunks = [];
  for (const c of chunks) {
    if (totalChars + c.content.length > TALK_CONTEXT_CHARS && included.length > 0) break;
    included.push(c);
    totalChars += c.content.length;
  }

  const added: AskSource[] = [];
  const numbered = included.map(({ content: excerpt }) => {
    const source = registerSource(video, excerpt, sources, seen);
    added.push(source);
    return `[${source.n}] ${excerpt}`;
  });
  const truncated = included.length < chunks.length ? "\n(transcript continues; later parts not shown)" : "";
  return { text: `${talkHeader(video)}\n${numbered.join("\n")}${truncated}`, added };
}

// OpenRouter's (OpenAI-style) chat message shapes, as far as used here.
interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface StreamChunk {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
    };
    finish_reason?: string | null;
  }[];
  error?: { message?: string };
}

/** One streamed model turn: yields text deltas as they arrive and returns
 * the turn's tool calls and finish reason. */
async function* streamTurn(
  messages: ChatMessage[],
  withTools: boolean,
  signal?: AbortSignal
): AsyncGenerator<string, { text: string; toolCalls: ToolCall[]; finishReason: string | null }> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // OpenRouter's app attribution headers.
      "HTTP-Referer": SITE_URL,
      "X-Title": SITE_NAME,
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      stream: true,
      // Answers are a few paragraphs. OpenRouter reserves max_tokens × price
      // per in-flight request, so a tight cap keeps that reservation small.
      max_tokens: 4000,
      reasoning: { effort: "low" },
      messages,
      // On the final turn the tool is left out entirely (plus an explicit
      // "answer now" instruction): with it merely disabled, some models write
      // their next tool call into the text instead of answering.
      ...(withTools ? { tools: [SEARCH_TOOL], tool_choice: "auto" } : {}),
    }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    // 402: out of credits; 429: rate limited. Both clear up on their own or
    // with a top-up, so say "busy" rather than "something went wrong".
    if (res.status === 402 || res.status === 429) throw new AskBusyError(`OpenRouter ${res.status}: ${detail}`);
    throw new Error(`OpenRouter ${res.status}: ${detail}`);
  }

  let text = "";
  let finishReason: string | null = null;
  const calls: { id: string; name: string; arguments: string }[] = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      // Blank lines separate events; ":" lines are OpenRouter keep-alives.
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      const chunk = JSON.parse(data) as StreamChunk;
      if (chunk.error) throw new Error(`OpenRouter: ${chunk.error.message ?? "stream error"}`);
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.delta?.content) {
        text += choice.delta.content;
        yield choice.delta.content;
      }
      for (const tc of choice.delta?.tool_calls ?? []) {
        const call = (calls[tc.index] ??= { id: "", name: "", arguments: "" });
        if (tc.id) call.id = tc.id;
        if (tc.function?.name) call.name += tc.function.name;
        if (tc.function?.arguments) call.arguments += tc.function.arguments;
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }

  const toolCalls: ToolCall[] = calls
    .filter(Boolean)
    .map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } }));
  return { text, toolCalls, finishReason };
}

function parseSearchArgs(args: string): string | null {
  try {
    const parsed = SearchInput.safeParse(JSON.parse(args));
    return parsed.success ? parsed.data.query : null;
  } catch {
    return null;
  }
}

/** Scopes a question to one event: searches only cover its talks. */
export interface AskEventScope {
  name: string;
  /** The event's transcribed recordings. */
  videoIds: string[];
}

/** Answers a question from the archive: the model searches (via a tool)
 * and writes a cited answer, streamed as events. `videoId` asks about one
 * talk (its transcript first); `event` limits every search to one event's
 * talks. */
export async function* answerQuestion(
  question: string,
  signal?: AbortSignal,
  videoId?: string,
  event?: AskEventScope
): AsyncGenerator<AskEvent> {
  const sources: AskSource[] = [];
  const seen = new Map<string, number>();
  const talk = videoId ? getVideoById(videoId) : undefined;
  let userContent = question;
  if (talk) {
    const { text, added } = await talkContext(talk, sources, seen);
    if (added.length) yield { type: "sources", sources: added };
    userContent = `I'm watching this talk:\n\n${text}\n\nMy question: ${question}\n\nAnswer from this talk first, citing its passages. Only search the archive if the talk doesn't cover the question, or the question asks about other talks.`;
  } else if (event) {
    userContent = `I'm following ${event.name}. search_archive only covers the ${event.videoIds.length} recorded talks from ${event.name}.\n\nMy question: ${question}\n\nAnswer about ${event.name}, from its talks. If its recordings don't cover the question, say so.`;
  }
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userContent },
  ];
  let answered = false;

  for (let round = 0; round <= MAX_SEARCH_ROUNDS; round++) {
    const final = round === MAX_SEARCH_ROUNDS;
    if (final) messages.push({ role: "user", content: FINAL_TURN_INSTRUCTION });

    const turnStream = streamTurn(messages, !final, signal);
    const guard = new MarkupGuard();
    let step = await turnStream.next();
    while (!step.done) {
      const visible = guard.push(step.value);
      if (visible) yield { type: "text", text: visible };
      step = await turnStream.next();
    }
    const tail = guard.flush();
    if (tail) yield { type: "text", text: tail };
    const { toolCalls, finishReason } = step.value;
    const text = stripToolMarkup(step.value.text);

    if (finishReason === "content_filter") {
      yield { type: "error", message: "This question can't be answered here." };
      return;
    }
    if (toolCalls.length === 0) {
      if (text.trim()) {
        answered = true;
        break;
      }
      // Nothing usable (empty, or only leaked tool-call markup): go straight
      // to the final, tool-less turn.
      if (guard.sawMarkup) yield { type: "discard" };
      if (!final) {
        round = MAX_SEARCH_ROUNDS - 1;
        continue;
      }
      break;
    }
    if (text || guard.sawMarkup) yield { type: "discard" };

    messages.push({ role: "assistant", content: text || null, tool_calls: toolCalls });
    for (const [i, call] of toolCalls.entries()) {
      const query = call.function.name === "search_archive" ? parseSearchArgs(call.function.arguments) : null;
      if (!query) {
        messages.push({ role: "tool", tool_call_id: call.id, content: "Invalid call: pass {\"query\": \"keywords\"}." });
        continue;
      }
      if (i >= MAX_QUERIES_PER_ROUND) {
        messages.push({ role: "tool", tool_call_id: call.id, content: "Skipped: at most 3 searches per round." });
        continue;
      }
      yield { type: "search", query };
      const result = await runSearch(query, question, sources, seen, event?.videoIds);
      if (result.added.length) yield { type: "sources", sources: result.added };
      messages.push({ role: "tool", tool_call_id: call.id, content: result.text });
    }
  }

  if (!answered) {
    yield { type: "error", message: "Couldn't put an answer together. Try rephrasing the question." };
    return;
  }
  yield { type: "done" };
}
