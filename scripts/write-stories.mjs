// The house reporter ("StreamETH Desk"): writes the season's coverage as
// stories from the talks in the archive, and publishes the ones that pass
// the verify gate (lib/storyVerify.mjs) straight to Supabase's stories table
// (migration 09). No human review — the gate is the check.
//
// What it writes each run:
//   day      one per event day with enough transcribed talks (live/recent events)
//   recap    one per event once it ends, rewritten as late uploads grow its input
//   preview  one per event in the week before it starts, from its schedule
//            and what its speakers said earlier in the season
//   thread   up to MAX_THREADS_PER_RUN topics that ran across events
//
// A story is rewritten (old version kept as a revision) only when its input
// talks grew by REWRITE_GROWTH, within REWRITE_DAYS of the event's end.
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
// OPENROUTER_API_KEY; reads data/streameth.db (run build-db first) and the
// committed transcripts. Never fails the data refresh: out-of-credits or a
// Supabase outage logs and exits 0.
//
//   node --env-file=.env.local scripts/write-stories.mjs
//   node --env-file=.env.local scripts/write-stories.mjs --only=recap --event="ETHSofia" --dry-run
//   node --env-file=.env.local scripts/write-stories.mjs --plan   # list what it would write, no model calls
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { verifyStory } from "../lib/storyVerify.mjs";
import { eventStatus, COVERAGE_TAIL_DAYS } from "../lib/seasonCore.mjs";
import { loadSeasonEvents } from "./seasonData.mjs";

const DAY = 24 * 60 * 60 * 1000;
const DATA_DIR = join(process.cwd(), "data");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://streameth.org";
const MODEL = process.env.STORY_MODEL || process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MIN_TALKS = 4;
const MAX_TALKS_PER_STORY = 30;
const CONTEXT_CHARS = 120_000;
const MIN_TALK_CHARS = 2_500;
const MAX_TALK_CHARS = 12_000;
const REWRITE_GROWTH = 1.2;
const REWRITE_DAYS = COVERAGE_TAIL_DAYS;
const PREVIEW_DAYS = 7;
const SEASON_BACK_DAYS = 120;
const MAX_STORIES_PER_RUN = Number(process.env.MAX_STORIES_PER_RUN) || 8;
const MAX_THREADS_PER_RUN = 2;
const HOUSE_SLUG = "streameth-desk";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  })
);
const DRY_RUN = Boolean(args["dry-run"]);
const PLAN = Boolean(args.plan);
const ONLY = typeof args.only === "string" ? new Set(args.only.split(",")) : null;
const EVENT_FILTER = typeof args.event === "string" ? args.event.toLowerCase() : null;
const NOW = typeof args.now === "string" ? Date.parse(args.now) : Date.now();

function log(...parts) {
  console.log("[write-stories]", ...parts);
}

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", ...(PLAN ? [] : ["OPENROUTER_API_KEY"])]) {
  if (!process.env[name]) {
    log(`${name} not set — skipping story writing.`);
    process.exit(0);
  }
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ---------------------------------------------------------------- data

const db = new DatabaseSync(join(DATA_DIR, "streameth.db"), { readOnly: true });

function rowToVideo(r) {
  return {
    id: r.id,
    title: r.title,
    orgSlug: r.org_slug,
    orgName: r.org_name,
    eventName: r.event_name,
    publishedAt: r.published_at,
    durationSeconds: r.duration_seconds,
    coverImage: r.cover_image,
    // The event feed that plays it, when it has one (see build-db.mjs).
    watchUrl: r.feed_url ?? r.watch_url,
    speakers: r.speakers ? r.speakers.split(", ").filter(Boolean) : [],
    hasTranscript: Boolean(r.has_transcript),
    format: r.format,
  };
}

function channelVideosBetween(slug, from, to) {
  return db
    .prepare(
      "SELECT * FROM videos WHERE org_slug = ? AND published_at >= ? AND published_at < ? ORDER BY published_at DESC"
    )
    .all(slug, from, to)
    .map(rowToVideo);
}

function videosBySpeaker(name, before, since, limit = 3) {
  return db
    .prepare(
      `SELECT * FROM videos WHERE speakers LIKE ? COLLATE NOCASE AND has_transcript = 1
       AND published_at < ? AND published_at >= ? ORDER BY published_at DESC LIMIT ?`
    )
    .all(`%${name}%`, before, since, limit)
    .map(rowToVideo);
}

function videosBetween(from, to) {
  return db
    .prepare(
      "SELECT * FROM videos WHERE published_at >= ? AND published_at < ? AND has_transcript = 1 AND format != 'short' ORDER BY published_at DESC"
    )
    .all(from, to)
    .map(rowToVideo);
}

let transcripts = null;
function transcriptFor(videoId) {
  if (!transcripts) {
    transcripts = {};
    const load = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : {});
    Object.assign(transcripts, load(join(DATA_DIR, "sources", "youtube-transcripts.json")));
    for (let i = 0; i < 10; i++) {
      Object.assign(transcripts, load(join(DATA_DIR, "sources", "youtube-transcripts", `shard-${String(i).padStart(2, "0")}.json`)));
    }
    const streameth = load(join(DATA_DIR, "transcripts.json"));
    for (const [id, t] of Object.entries(streameth)) transcripts[id] = t?.text ?? "";
  }
  const key = videoId.startsWith("yt-") ? videoId.slice(3) : videoId;
  return transcripts[key] || null;
}

function slugify(text, max = 80) {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max)
      .replace(/-+$/g, "") || "story"
  );
}

function formatDate(ms) {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------- picking talks

/** Full talks before clips, longest first — keynotes and panels carry the
 * news; capped so the prompt stays a sane size. */
function pickTalks(videos) {
  return videos
    .filter((v) => v.hasTranscript && v.format !== "short" && transcriptFor(v.id))
    .sort(
      (a, b) =>
        Number(b.format === "talk" || b.format === "stream") - Number(a.format === "talk" || a.format === "stream") ||
        (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0)
    )
    .slice(0, MAX_TALKS_PER_STORY);
}

/** The prompt's numbered talk list: [n] header + the start of each
 * transcript, sharing CONTEXT_CHARS between them. */
function talkBlock(talks, speakerHints = new Map()) {
  const perTalk = Math.max(MIN_TALK_CHARS, Math.min(MAX_TALK_CHARS, Math.floor(CONTEXT_CHARS / Math.max(1, talks.length))));
  return talks
    .map((v, i) => {
      const speakers = v.speakers.length ? v.speakers : speakerHints.get(v.id) ?? [];
      const header = [
        `[${i + 1}] Talk: ${v.title}`,
        speakers.length ? `Speakers: ${speakers.join(", ")}` : "Speakers: not listed",
        `Channel: ${v.orgName}`,
        `Published: ${formatDate(v.publishedAt)}`,
      ].join("\n");
      const text = (transcriptFor(v.id) ?? "").slice(0, perTalk);
      return `${header}\nTranscript (automatic captions, may be cut off):\n${text}`;
    })
    .join("\n\n---\n\n");
}

// ---------------------------------------------------------------- the model

const SYSTEM = `You are StreamETH Desk, a reporter covering Ethereum conferences. You write news stories from the recorded talks you are given — nothing else.

Rules — a story that breaks any of these is rejected automatically:
- Use only what the provided talks say. Never add facts, numbers, names or context from your own knowledge.
- Every paragraph and every bullet cites the talks it draws on as [n], right after the claim, e.g. "Rollups are moving to based sequencing [3][7]."
- Anything inside double quotes must be copied word for word from that talk's transcript. You may only fix capitalization and punctuation and drop filler words ("um", "uh"). Never paraphrase inside quotation marks. The paragraph must cite the talk it quotes.
- Attribute views to people only by the speaker names listed for that talk, or a person named in its title ("Security in the AI Age | Krum Pashov, Pashov Audit Group"). Otherwise refer to the talk ("a talk on account abstraction argued…"), not a person.
- Transcripts are automatic and misspell jargon and names; read through obvious errors, but quote the words as they appear.
- News style: specific and plain. No hype, no predictions, no "exciting", no "in conclusion". Lead with the most newsworthy thing that was said.

Return only a JSON object, no other text:
{
  "headline": "specific, under 90 characters, no clickbait",
  "standfirst": "one sentence summing up the story",
  "body": "4 to 8 short paragraphs separated by blank lines; may end with a short '- ' bullet list of talks worth watching, each cited",
  "quotes": [{ "text": "a striking line, word for word", "n": 3, "speaker": "a listed speaker of talk 3, or null" }]
}
Give 1 to 3 quotes.`;

class ModelBusyError extends Error {}

async function complete(messages) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": SITE_URL,
      "X-Title": "StreamETH",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      reasoning: { effort: "low" },
      response_format: { type: "json_object" },
      messages,
    }),
  });
  if (res.status === 402 || res.status === 429) throw new ModelBusyError(`OpenRouter ${res.status}`);
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text().catch(() => "")}`);
  const body = await res.json();
  return body.choices?.[0]?.message?.content ?? "";
}

function parseJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Writes a story from numbered talks and verifies it, retrying once with the
 * failures listed. Returns the draft, or null when it doesn't pass.
 */
async function writeVerified({ brief, talks, speakerHints, externalSources = [] }) {
  const sources = talks.map((v, i) => ({ n: i + 1, videoId: v.id }));
  const talkMap = new Map(
    talks.map((v) => [
      v.id,
      { title: v.title, speakers: v.speakers.length ? v.speakers : speakerHints?.get(v.id) ?? [], transcript: transcriptFor(v.id) },
    ])
  );
  const extra = externalSources.length
    ? `\n\nYou may also cite these non-talk sources as [w1], [w2]… (for dates, places and the schedule only):\n${externalSources
        .map((e) => `[w${e.n}] ${e.title}: ${e.text}`)
        .join("\n")}`
    : "";
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `${brief}${extra}\n\nThe talks:\n\n${talkBlock(talks, speakerHints)}` },
  ];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await complete(messages);
    const parsed = parseJson(raw);
    if (!parsed) {
      log(`  attempt ${attempt}: not JSON`);
      messages.push({ role: "assistant", content: raw }, { role: "user", content: "That wasn't a JSON object. Return only the JSON object." });
      continue;
    }
    const draft = {
      headline: String(parsed.headline ?? ""),
      standfirst: String(parsed.standfirst ?? ""),
      body: String(parsed.body ?? ""),
      quotes: Array.isArray(parsed.quotes)
        ? parsed.quotes
            .filter((q) => q && typeof q.text === "string" && Number.isInteger(q.n))
            .map((q) => ({ text: q.text, n: q.n, speaker: typeof q.speaker === "string" ? q.speaker : null }))
        : [],
      sources,
      externalSources: externalSources.map(({ n, url, title }) => ({ n, url, title })),
    };
    const failures = verifyStory(draft, talkMap, { allowExternal: externalSources.length > 0 });
    if (failures.length === 0) return draft;
    log(`  attempt ${attempt}: ${failures.length} problems — ${failures.slice(0, 3).join(" | ")}`);
    messages.push(
      { role: "assistant", content: raw },
      {
        role: "user",
        content: `The story was rejected:\n- ${failures.join("\n- ")}\n\nFix every problem and return the whole JSON object again. Remove any quote you can't copy word for word.`,
      }
    );
  }
  return null;
}

// ---------------------------------------------------------------- saving

function buildSources(draft, talks) {
  const excerpts = new Map(draft.quotes.map((q) => [q.n, q.text]));
  return draft.sources
    .map(({ n, videoId }) => {
      const v = talks.find((t) => t.id === videoId);
      if (!v) return null;
      return {
        n,
        videoId: v.id,
        title: v.title,
        speakers: v.speakers,
        event: v.eventName,
        channel: v.orgName,
        date: v.publishedAt ? formatDate(v.publishedAt) : null,
        watchUrl: v.watchUrl,
        coverImage: v.coverImage,
        excerpt: excerpts.get(n) ?? "",
      };
    })
    .filter(Boolean);
}

/** Only the talks the body actually cites — the model is given more than
 * it uses, and uncited talks shouldn't show as sources. Renumbers [n]. */
function keepCited(draft) {
  const cited = new Set([...draft.body.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  for (const q of draft.quotes) cited.add(q.n);
  const kept = draft.sources.filter((s) => cited.has(s.n));
  const renumber = new Map(kept.map((s, i) => [s.n, i + 1]));
  const body = draft.body
    .replace(/\[(\d+(?:\s*,\s*\d+)+)\]/g, (_, list) => list.split(",").map((n) => `[${n.trim()}]`).join(""))
    .replace(/\[(\d+)\]/g, (m, n) => (renumber.has(Number(n)) ? `[${renumber.get(Number(n))}]` : m));
  return {
    ...draft,
    body,
    quotes: draft.quotes.filter((q) => renumber.has(q.n)).map((q) => ({ ...q, n: renumber.get(q.n) })),
    sources: kept.map((s) => ({ ...s, n: renumber.get(s.n) })),
  };
}

async function saveStory({ reporterId, existing, slug, kind, eventKeys, topic, draft, talks }) {
  const final = keepCited(draft);
  const row = {
    kind,
    headline: final.headline.trim(),
    standfirst: final.standfirst.trim(),
    body: final.body.trim(),
    quotes: final.quotes,
    sources: buildSources(final, talks),
    external_sources: final.externalSources ?? [],
    event_keys: eventKeys,
    topic: topic ?? null,
    source_video_ids: talks.map((t) => t.id),
    model: MODEL,
  };
  if (DRY_RUN) {
    log(`  DRY RUN — would ${existing ? "update" : "publish"} /stories/${existing?.slug ?? slug}`);
    log(`  ${row.headline}\n  ${row.standfirst}\n\n${row.body}\n`);
    return true;
  }
  if (existing) {
    const { error: revisionError } = await supabase.from("story_revisions").insert({
      story_id: existing.id,
      headline: existing.headline,
      standfirst: existing.standfirst,
      body: existing.body,
      quotes: existing.quotes,
      sources: existing.sources,
      external_sources: existing.external_sources,
      written_at: existing.updated_at,
    });
    if (revisionError) throw revisionError;
    const { error } = await supabase
      .from("stories")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    log(`  updated /stories/${existing.slug}`);
    return true;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const trySlug = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
    const { error } = await supabase.from("stories").insert({ ...row, slug: trySlug, reporter_id: reporterId });
    if (!error) {
      log(`  published /stories/${trySlug}`);
      return true;
    }
    if (error.code !== "23505") throw error;
  }
  throw new Error(`no free slug for ${slug}`);
}

function needsRewrite(existing, inputIds, eventEnd) {
  if (!existing) return true;
  if (eventEnd !== null && NOW > eventEnd + REWRITE_DAYS * DAY) return false;
  const had = existing.source_video_ids?.length ?? 0;
  return inputIds.length >= Math.ceil(had * REWRITE_GROWTH) && inputIds.length > had;
}

// ---------------------------------------------------------------- tasks

function eventDays(event) {
  return Math.max(1, Math.round((event.to - event.from) / DAY));
}

function scheduleHints(event, schedules) {
  // Devcon's schedule names each recording's speakers by YouTube id — better
  // attribution than the title-matched speakers in the DB.
  const hints = new Map();
  for (const s of schedules[event.name]?.sessions ?? []) {
    if (s.youtubeId && s.speakers.length) hints.set(`yt-${s.youtubeId}`, s.speakers);
  }
  return hints;
}

function dayTasks(event, schedules) {
  const tasks = [];
  const coverage = channelVideosBetween(event.channelSlug, event.from - DAY, event.to + COVERAGE_TAIL_DAYS * DAY);
  const hints = scheduleHints(event, schedules);
  for (let day = 1; day <= eventDays(event); day++) {
    const from = event.from + (day - 1) * DAY;
    const talks = pickTalks(coverage.filter((v) => v.publishedAt >= from && v.publishedAt < from + DAY));
    if (talks.length < MIN_TALKS) continue;
    tasks.push({
      kind: "day",
      slug: `${slugify(event.name, 60)}-day-${day}`,
      eventKeys: [event.key, `${event.key}:day-${day}`],
      matchKey: `${event.key}:day-${day}`,
      eventEnd: event.to,
      talks,
      speakerHints: hints,
      brief: `Write the day report for day ${day} of ${event.name}${event.city ? ` in ${event.city}` : ""} (${formatDate(from)}): what was said on stage that day, the news and the arguments.`,
    });
  }
  return tasks;
}

function recapTask(event, schedules) {
  const coverage = channelVideosBetween(event.channelSlug, event.from - DAY, event.to + COVERAGE_TAIL_DAYS * DAY);
  const talks = pickTalks(coverage);
  if (talks.length < MIN_TALKS) return null;
  return {
    kind: "recap",
    slug: `${slugify(event.name, 70)}-recap`,
    eventKeys: [event.key],
    matchKey: event.key,
    eventEnd: event.to,
    talks,
    speakerHints: scheduleHints(event, schedules),
    brief: `Write the recap of ${event.name}${event.city ? ` in ${event.city}` : ""} (${formatDate(event.from)} – ${formatDate(event.to - 1)}): the main threads of the event, what was announced or argued, and the talks worth watching.`,
  };
}

function previewTask(event, schedules) {
  const schedule = schedules[event.name];
  const speakers = [...new Set((schedule?.sessions ?? []).flatMap((s) => s.speakers))];
  const seen = new Set();
  const talks = [];
  for (const name of speakers) {
    if (name.trim().split(/\s+/).length < 2) continue; // first names alone match too loosely
    for (const v of videosBySpeaker(name, event.from, NOW - SEASON_BACK_DAYS * DAY, 2)) {
      if (!seen.has(v.id) && transcriptFor(v.id)) {
        seen.add(v.id);
        talks.push(v);
      }
    }
    if (talks.length >= MAX_TALKS_PER_STORY) break;
  }
  if (talks.length < MIN_TALKS) return null;
  const highlights = (schedule?.sessions ?? [])
    .filter((s) => s.speakers.some((sp) => speakers.includes(sp)) && /keynote|talk|panel/i.test(s.type))
    .slice(0, 25)
    .map((s) => `${new Date(s.start).toISOString().slice(0, 16).replace("T", " ")} UTC, ${s.room}: "${s.title}" — ${s.speakers.join(", ")}`)
    .join("\n");
  const externalSources = [
    {
      n: 1,
      url: event.website?.startsWith("https://") ? event.website : `${SITE_URL}${event.href}`,
      title: `${event.name} — official site and schedule`,
      text: `${event.name}, ${formatDate(event.from)} – ${formatDate(event.to - 1)}${event.city ? `, ${event.city}` : ""}.${highlights ? ` Scheduled sessions include:\n${highlights}` : ""}`,
    },
  ];
  return {
    kind: "preview",
    slug: `${slugify(event.name, 70)}-preview`,
    eventKeys: [event.key],
    matchKey: event.key,
    eventEnd: null,
    talks,
    speakerHints: new Map(),
    externalSources,
    brief: `Write a preview of ${event.name}, which starts ${formatDate(event.from)}. Use the schedule [w1] for what's on, and the talks below — earlier talks this season by people speaking there — for what they've been arguing. Don't predict what they will say.`,
  };
}

const THREAD_PICKER = `You pick news threads that ran across several Ethereum events this season. You get a numbered list of recorded talks. Return only JSON:
{ "threads": [{ "topic": "short topic name", "angle": "one sentence: what changed or what people disagreed about", "talks": [numbers] }] }
Each thread: 5 to 15 talks, from at least 2 different channels. Prefer concrete technical or governance topics over generic ones ("Ethereum", "the future"). Skip topics in the "already covered" list.`;

async function threadTasks(existingTopics) {
  const pool = videosBetween(NOW - SEASON_BACK_DAYS * DAY, NOW).filter((v) => transcriptFor(v.id)).slice(0, 400);
  if (pool.length < MIN_TALKS) return [];
  const listing = pool
    .map((v, i) => `${i + 1}. ${v.title} — ${v.speakers.join(", ") || "speakers not listed"} — ${v.orgName}, ${formatDate(v.publishedAt)}`)
    .join("\n");
  const raw = await complete([
    { role: "system", content: THREAD_PICKER },
    {
      role: "user",
      content: `Already covered: ${existingTopics.length ? existingTopics.join("; ") : "none"}\n\nTalks:\n${listing}`,
    },
  ]);
  const parsed = parseJson(raw);
  const threads = Array.isArray(parsed?.threads) ? parsed.threads : [];
  const covered = new Set(existingTopics.map((t) => slugify(t)));
  const tasks = [];
  for (const t of threads) {
    if (typeof t?.topic !== "string" || !Array.isArray(t.talks)) continue;
    if (covered.has(slugify(t.topic))) continue;
    const talks = pickTalks(t.talks.map((n) => pool[n - 1]).filter(Boolean));
    const channels = new Set(talks.map((v) => v.orgSlug));
    const speakers = new Set(talks.flatMap((v) => v.speakers));
    // A thread is several people at several events, not one speaker on tour.
    const knownSpeakers = talks.filter((v) => v.speakers.length).length;
    if (talks.length < MIN_TALKS || channels.size < 2 || (knownSpeakers >= 3 && speakers.size < 3)) continue;
    tasks.push({
      kind: "thread",
      slug: slugify(t.topic, 80),
      eventKeys: [],
      topic: t.topic,
      matchKey: null,
      eventEnd: null,
      talks,
      speakerHints: new Map(),
      brief: `Write a story following "${t.topic}" across this season's events. Angle: ${t.angle ?? "how the conversation moved"}. Show who said what, where, and how views differed.`,
    });
    if (tasks.length >= MAX_THREADS_PER_RUN) break;
  }
  return tasks;
}

// ---------------------------------------------------------------- main

async function main() {
  const { data: house, error: houseError } = await supabase.from("reporters").select("id").eq("slug", HOUSE_SLUG).maybeSingle();
  if (houseError || !house) {
    log(`house reporter "${HOUSE_SLUG}" not found (is migration 09 applied?) — skipping.`, houseError?.message ?? "");
    return;
  }
  const { data: ownStories, error: storiesError } = await supabase
    .from("stories")
    .select("id, slug, kind, event_keys, topic, source_video_ids, headline, standfirst, body, quotes, sources, external_sources, updated_at")
    .eq("reporter_id", house.id)
    .eq("status", "published");
  if (storiesError) throw storiesError;
  const findExisting = (kind, matchKey, topic) =>
    ownStories.find(
      (s) =>
        s.kind === kind &&
        (matchKey ? s.event_keys.includes(matchKey) : slugify(s.topic ?? "") === slugify(topic ?? ""))
    );

  const { events, schedules } = loadSeasonEvents();
  const season = events.filter(
    (e) =>
      e.channelSlug &&
      e.to >= NOW - SEASON_BACK_DAYS * DAY &&
      e.from <= NOW + PREVIEW_DAYS * DAY &&
      (!EVENT_FILTER || e.name.toLowerCase().includes(EVENT_FILTER))
  );

  const tasks = [];
  for (const event of season) {
    const status = eventStatus(event, NOW);
    if (status === "upcoming" && event.from - NOW <= PREVIEW_DAYS * DAY) {
      const t = previewTask(event, schedules);
      if (t) tasks.push(t);
    }
    if (status === "live" || status === "recent") tasks.push(...dayTasks(event, schedules));
    if (status === "recent" || status === "past") {
      const t = recapTask(event, schedules);
      if (t) tasks.push(t);
    }
  }
  if (!PLAN && !EVENT_FILTER && (!ONLY || ONLY.has("thread"))) {
    tasks.push(...(await threadTasks(ownStories.filter((s) => s.kind === "thread").map((s) => s.topic ?? ""))));
  }

  const todo = tasks
    .filter((t) => !ONLY || ONLY.has(t.kind))
    .map((t) => ({ ...t, existing: findExisting(t.kind, t.matchKey, t.topic) }))
    .filter((t) => (t.kind === "preview" || t.kind === "thread" ? !t.existing : needsRewrite(t.existing, t.talks.map((v) => v.id), t.eventEnd)));

  log(`${tasks.length} candidate stories, ${todo.length} to write (cap ${MAX_STORIES_PER_RUN})`);
  if (PLAN) {
    for (const t of todo) {
      log(`  ${t.kind.padEnd(7)} /stories/${t.existing?.slug ?? t.slug}  ${t.talks.length} talks${t.existing ? " (rewrite)" : ""}`);
    }
    log("  (threads are picked by the model, so --plan leaves them out)");
    return;
  }
  let published = 0;
  let rejected = 0;
  for (const task of todo.slice(0, MAX_STORIES_PER_RUN)) {
    log(`${task.kind}: ${task.slug} (${task.talks.length} talks${task.existing ? ", rewrite" : ""})`);
    const draft = await writeVerified(task);
    if (!draft) {
      rejected++;
      log("  rejected twice — skipped; any earlier version stays up");
      continue;
    }
    await saveStory({
      reporterId: house.id,
      existing: task.existing,
      slug: task.slug,
      kind: task.kind,
      eventKeys: task.eventKeys,
      topic: task.topic,
      draft,
      talks: task.talks,
    });
    published++;
  }
  log(`done: ${published} published/updated, ${rejected} rejected`);
}

main().catch((err) => {
  if (err instanceof ModelBusyError) {
    log(`model provider busy or out of credits (${err.message}) — stopping; the data refresh continues.`);
    process.exit(0);
  }
  log("failed:", err?.message ?? err);
  // Stories never block the video data refresh.
  process.exit(0);
});
