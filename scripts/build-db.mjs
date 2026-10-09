// Builds data/streameth.db — a single SQLite database unifying StreamETH
// sessions and tracked YouTube videos into one `videos` table with an FTS5
// full-text index, so the homepage feed and /search query one real index
// instead of two separate in-memory JS pipelines that don't agree with each
// other. Regenerated from the committed JSON exports; safe to delete and
// re-run (`pnpm build-db`) any time data/*.json changes.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { cleanAutoLabels } from "../lib/autoLabels.mjs";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "streameth.db");

function load(file) {
  return JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8"));
}
function loadSource(file) {
  const path = join(DATA_DIR, "sources", file);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

// data/sources/youtube-transcripts/shard-NN.json (see scripts/transcript_shards.py)
// — the backfilled dataset outgrew a single committed file (~300MB at full
// backfill vs. GitHub's 100MB single-file push limit), so it's sharded by a
// hash of videoId into SHARD_COUNT files, read back here as one merged map.
const TRANSCRIPT_SHARD_COUNT = 10;
function loadTranscripts() {
  const result = { ...(loadSource("youtube-transcripts.json") ?? {}) };
  for (let i = 0; i < TRANSCRIPT_SHARD_COUNT; i++) {
    const shard = loadSource(`youtube-transcripts/shard-${String(i).padStart(2, "0")}.json`);
    if (shard) Object.assign(result, shard);
  }
  return result;
}

const DEAD_VIDEO_HOSTS = new Set(["lp-playback.com"]);
function isDeadVideoHost(url) {
  try {
    return DEAD_VIDEO_HOSTS.has(new URL(url).hostname);
  } catch {
    return true;
  }
}

// The old StreamETH DigitalOcean Spaces bucket that hosted session cover
// images is gone for good (see lib/data.ts's cleanImageUrl) — strip it here
// too so the DB doesn't carry dead image URLs into the UI.
function cleanImageUrl(url) {
  if (!url || /digitaloceanspaces\.com/i.test(url)) return null;
  return url;
}

// Some orgs' YouTube channels re-upload the exact same recording that's
// already a StreamETH session (own Livepeer asset, own /watch page) — same
// talk, two catalog entries. Detected ~335/16.2k YouTube videos this way
// when auditing the data. Normalize + substring-match titles within the
// same org to catch it (YouTube titles are often "Talk Title - Speaker" or
// "Talk Title | EventName" rather than an exact match).
const MIN_TITLE_LEN = 12;
function normalizeTitle(t) {
  return (t || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const sessionTitlesByOrgSlug = new Map();
function isReuploadOfSession(orgSlug, rawTitle) {
  const titles = sessionTitlesByOrgSlug.get(orgSlug);
  if (!titles) return false;
  const nt = normalizeTitle(rawTitle);
  if (nt.length < MIN_TITLE_LEN) return false;
  for (const st of titles) {
    if (st.length < MIN_TITLE_LEN) continue;
    if (nt.includes(st) || st.includes(nt)) return true;
  }
  return false;
}

// Curated by hand while auditing data/organizations.json + data/sessions.json
// (2026-09) — test/dev tenants, personal test accounts, and content
// unrelated to the Ethereum ecosystem. Kept in sync by hand with the
// identical list in lib/curation.ts (this script runs via plain `node`, not
// the TS toolchain, so it can't import that file — see cleanImageUrl above
// for the same constraint).
const HIDDEN_ORG_SLUGS = new Set([
  "test",
  "pablo",
  "pablo_one",
  "pablo_test",
  "pablos_org",
  "pblvrt",
  "demo_org",
  "testy",
  "manad",
  "tanda_takon",
  "farmer",
  "supportvideos",
  "streameth_support_videos",
  "streameth",
  "letsgethai",
  "omotayo_wardaddy",
  "the_sound_of_the_crown",
  "grafica_directa_sl",
  "virtual_wingme",
  "virtual_wingmen",
  "hfdxgj",
  "pebels",
  "sebas",
  "john_pham",
  "ace_mansion",
  "scope_productions",
  "lost_laing",
  "nottv",
  "peregrinev2",
]);

function isJunkDescription(raw) {
  const d = (raw ?? "").trim().toLowerCase();
  if (!d) return true;
  if (["no description", "clip", "test", "few"].includes(d)) return true;
  if (/^video\+[a-z0-9]+$/i.test(d)) return true;
  return false;
}

const JUNK_WORDS = [
  "test", "testing", "demo", "sample", "untitled", "no name", "no title",
  "testung", "testy", "testcaps",
];
const SUFFIX_WORDS = "clip|demo|live|recording|prod|caps|bypass|export";
const JUNK_WHOLE_TITLE_RE = new RegExp(
  `^(${JUNK_WORDS.join("|")})([ _.-]+(${SUFFIX_WORDS}))?([ _.-]*\\d+)?$`,
  "i"
);

// See the identical (documented) version in lib/curation.ts.
function isJunkSession(s) {
  const t = (s.name ?? "").trim();
  if (!t) return true;
  if (/^\d+$/.test(t)) return true;
  if (/^video\+[a-z0-9]+$/i.test(t)) return true;
  if (/\.(mp4|mov|mkv|m4v)$/i.test(t)) return true;
  if (/^\d{3,5}(\s*\(\d+\))*\.[a-z0-9]+$/i.test(t)) return true;
  const bare = t.replace(/[\s_.-]+/g, " ").trim();
  if (JUNK_WHOLE_TITLE_RE.test(bare)) return true;
  if (/^test/i.test(t) && !t.includes(":") && t.split(/\s+/).length <= 6) {
    if (isJunkDescription(s.description)) return true;
  }
  if (/-Recording \d+$/i.test(t) && isJunkDescription(s.description)) return true;
  return false;
}

const organizationsRaw = load("organizations.json").filter(
  (o) => o.slug && !HIDDEN_ORG_SLUGS.has(o.slug)
);
const hiddenOrgIds = new Set(
  load("organizations.json")
    .filter((o) => o.slug && HIDDEN_ORG_SLUGS.has(o.slug))
    .map((o) => o._id)
);
const events = load("events.json").filter((e) => e.slug && !e.unlisted);
const sessions = load("sessions.json");
// Kept in its own file, keyed by session _id — see the identical note in
// lib/data.ts's getTranscripts.
const transcriptsById = load("transcripts.json");
const stages = load("stages.json");
const directory = load("directory.json").entries;
const livepeerResolved = loadSource("livepeer-resolved.json") ?? {};
const livepeerThumbnails = loadSource("livepeer-thumbnails.json") ?? {};
const livepeerDownloads = loadSource("livepeer-downloads.json") ?? {};
const youtubeVideosBySlug = loadSource("youtube-videos.json") ?? {};
const youtubeTranscripts = loadTranscripts();
// Built by scripts/extract-youtube-speakers.py — exact matches of a YouTube
// title against real speaker names already known from StreamETH's own
// sessions.json/speakers.json, not an inferred/invented name.
const youtubeSpeakersBySlug = loadSource("youtube-speakers.json") ?? {};
// pull-youtube-videos.py's --flat-playlist listing has no duration, real
// description, or tags — scripts/pull-youtube-metadata.py backfills those
// per-video via a heavier yt-dlp call, run separately (it's slow: one
// YouTube request per video) and still in progress as of writing, so this
// is partial coverage that improves as more of it finishes.
const youtubeMetadata = loadSource("youtube-metadata.json") ?? {};

function resolvedCoverImage(s) {
  const clean = cleanImageUrl(s.coverImage);
  if (clean) return clean;
  if (s.playbackId) return livepeerThumbnails[s.playbackId] ?? null;
  return null;
}

// The playable stream/file URL, resolved the same way as lib/data.ts's
// buildPlaybackSrc — what the video sitemap and VideoObject JSON-LD hand to
// search engines as `contentUrl`.
function resolvedContentUrl(s) {
  const videoUrl = s.videoUrl || s.playback?.videoUrl;
  if (videoUrl && !isDeadVideoHost(videoUrl)) return videoUrl;
  if (s.playbackId) return livepeerResolved[s.playbackId] ?? null;
  return null;
}

function resolvedDownloadUrl(s) {
  const videoUrl = s.videoUrl || s.playback?.videoUrl;
  if (videoUrl && !isDeadVideoHost(videoUrl) && videoUrl.endsWith(".mp4")) {
    return videoUrl;
  }
  if (s.playbackId) return livepeerDownloads[s.playbackId] ?? null;
  return null;
}

const orgById = new Map(organizationsRaw.map((o) => [o._id, o]));
const eventById = new Map(events.map((e) => [e._id, e]));
const stageById = new Map(stages.map((st) => [st._id, st]));
const directoryBySlug = new Map(directory.map((d) => [d.slug, d]));

// Literal upload-test recordings ("test", "test clip", "TEsting") — not real
// conference content, just noise left over from testing the recording setup.
const TEST_TITLE_RE = /^test(ing)?(\s+(clip|live))?$/i;
// A raw device/export filename with no real title ever set (e.g. "IMG_4887.MOV",
// "9M78AK.mp4", "1003 (1)(1).mp4") — unlike "Fund Tokenization.mp4" (a real
// title that just kept its extension), these have no recoverable talk name.
const RAW_FILENAME_RE = /^(img_\d+|[0-9a-z]{4,10}|\d+\s*(\(\d+\))*)\.(mp4|mov|mkv|m4v)$/i;

// An organizing team credited as if it were an individual speaker (e.g.
// "ETHBerlin Team", "Zuzalu Team", or the platform name "StreamETH" itself)
// — a real artifact in the source data, not a person.
function isPlaceholderSpeakerName(name) {
  const n = (name ?? "").trim();
  return /\bteam$/i.test(n) || /^streameth$/i.test(n);
}

function isJunkTitle(title) {
  const t = (title ?? "").trim();
  return TEST_TITLE_RE.test(t) || RAW_FILENAME_RE.test(t);
}

// A real title that just kept its file extension (e.g. "Fund Tokenization.mp4")
// — strip it so the display title reads like every other session's.
function cleanTitle(title) {
  const t = (title ?? "").trim();
  return t.replace(/\.(mp4|mov|mkv|m4v)$/i, "");
}

// Same fallback as lib/data.ts's sessionStart: a missing or near-zero
// start (a 1970 date) falls back to when the session record was created.
const MIN_PLAUSIBLE_START = Date.UTC(2000, 0, 1);
function sessionStart(s) {
  return s.start >= MIN_PLAUSIBLE_START ? s.start : Date.parse(s.createdAt ?? "") || s.start || 0;
}

function sessionHasVideo(s) {
  // `published: "private"` sessions are internal review copies, failed/pending
  // processing clips, or unlisted draft segments (e.g. Devcon 7 SEA alone has
  // 1,667 private sessions vs. 459 public ones, many sharing the exact same
  // generic talk title as their public counterpart) — never meant to be
  // browsable, so they're excluded regardless of whether a video URL resolved.
  if (s.published === "private") return false;
  if (isJunkTitle(s.name)) return false;
  const url = s.videoUrl || s.playback?.videoUrl;
  if (url && !isDeadVideoHost(url)) return true;
  return Boolean(s.playbackId && livepeerResolved[s.playbackId]);
}

if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE organizations (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    logo TEXT
  );

  CREATE TABLE videos (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL CHECK (source IN ('streameth','youtube')),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    org_id TEXT,
    org_name TEXT NOT NULL DEFAULT '',
    org_slug TEXT NOT NULL DEFAULT '',
    event_id TEXT,
    event_name TEXT NOT NULL DEFAULT '',
    published_at INTEGER NOT NULL DEFAULT 0,
    duration_seconds REAL,
    cover_image TEXT,
    watch_url TEXT NOT NULL,
    speakers TEXT NOT NULL DEFAULT '',
    topics TEXT NOT NULL DEFAULT '',
    has_transcript INTEGER NOT NULL DEFAULT 0,
    transcript TEXT,
    download_url TEXT,
    content_url TEXT
  );

  CREATE INDEX idx_videos_org ON videos(org_id);
  CREATE INDEX idx_videos_event ON videos(event_id);
  CREATE INDEX idx_videos_published ON videos(published_at);
  CREATE INDEX idx_videos_duration ON videos(duration_seconds);

  -- Contentless (content=''): only the search index is stored, not a second
  -- copy of every column. Transcripts are most of the data, and storing them
  -- twice pushed the database past Vercel's 250 MB function size limit.
  -- Each row's rowid is its videos.rowid; queries join on that.
  CREATE VIRTUAL TABLE videos_fts USING fts5(
    title,
    description,
    speakers,
    topics,
    org_name,
    event_name,
    transcript,
    content=''
  );
`);

for (const o of organizationsRaw) {
  db.prepare(
    "INSERT INTO organizations (id, slug, name, logo) VALUES (?, ?, ?, ?)"
  ).run(o._id, o.slug, o.name, o.logo ?? null);
}

const insertVideo = db.prepare(`
  INSERT INTO videos (
    id, source, title, description, org_id, org_name, org_slug, event_id,
    event_name, published_at, duration_seconds, cover_image, watch_url,
    speakers, topics, has_transcript, transcript, download_url, content_url
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertFts = db.prepare(`
  INSERT INTO videos_fts (rowid, title, description, speakers, topics, org_name, event_name, transcript)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let streamethCount = 0;
const seenIds = new Set();
for (const s of sessions) {
  if (!sessionHasVideo(s)) continue;
  if (hiddenOrgIds.has(s.organizationId) || isJunkSession(s)) continue;
  if (seenIds.has(s._id)) {
    console.warn(`Skipping duplicate session id: ${s._id}`);
    continue;
  }
  seenIds.add(s._id);
  const event = eventById.get(s.eventId);
  const org = event ? orgById.get(event.organizationId) : orgById.get(s.organizationId);
  const stage = stageById.get(s.stageId);
  const speakerList = (s.speakers ?? []).filter((sp) => !isPlaceholderSpeakerName(sp.name));

  if (org?.slug && s.name) {
    const list = sessionTitlesByOrgSlug.get(org.slug) ?? [];
    list.push(normalizeTitle(s.name));
    sessionTitlesByOrgSlug.set(org.slug, list);
  }

  // Display columns stay clean (just names / autoLabels) — the FTS index
  // below is separately enriched with everything else we know how to
  // extract (speaker bios, track/talk type, stage, event & org context) so
  // a query can match on it without it cluttering the video card/detail UI.
  const speakerNames = speakerList.map((sp) => sp.name).filter(Boolean).join(", ");
  const topicsDisplay = cleanAutoLabels(s.autoLabels).join(", ");
  const description = [s.description, s.aiDescription].filter(Boolean).join(" ");
  const duration =
    s.playback?.duration ??
    (s.start && s.end && s.end > s.start ? (s.end - s.start) / 1000 : null);
  const transcript = transcriptsById[s._id]?.text ?? "";

  const speakerSearchText = speakerList
    .map((sp) => [sp.name, sp.company, sp.bio].filter(Boolean).join(" — "))
    .join(" | ");
  const track = Array.isArray(s.track) ? s.track.join(", ") : s.track;
  const topicsSearchText = [topicsDisplay, track, s.talkType, stage?.name]
    .filter(Boolean)
    .join(", ");
  const descriptionSearchText = [
    description,
    event?.description,
    event?.location,
    org?.description,
    org?.location,
  ]
    .filter(Boolean)
    .join(" ");

  const { lastInsertRowid: streamethRowid } = insertVideo.run(
    s._id,
    "streameth",
    cleanTitle(s.name),
    description,
    org?._id ?? null,
    org?.name ?? "",
    org?.slug ?? "",
    event?._id ?? null,
    event?.name ?? s.eventSlug ?? "",
    sessionStart(s),
    duration,
    resolvedCoverImage(s),
    `/watch/${s._id}`,
    speakerNames,
    topicsDisplay,
    transcript ? 1 : 0,
    transcript || null,
    resolvedDownloadUrl(s),
    resolvedContentUrl(s)
  );
  insertFts.run(
    streamethRowid,
    cleanTitle(s.name),
    descriptionSearchText,
    speakerSearchText,
    topicsSearchText,
    org?.name ?? "",
    event?.name ?? "",
    transcript
  );
  streamethCount++;
}

let youtubeCount = 0;
let youtubeDupeCount = 0;
let youtubeReuploadCount = 0;
// The same video occasionally turns up under more than one discovered
// channel slug (shared/cross-posted uploads) — keep the first occurrence.
const seenVideoIds = new Set();
for (const [channelSlug, videos] of Object.entries(youtubeVideosBySlug)) {
  const entry = directoryBySlug.get(channelSlug);
  const orgName = entry?.name ?? channelSlug;
  for (const v of videos) {
    if (seenVideoIds.has(v.videoId)) {
      youtubeDupeCount++;
      continue;
    }
    if (isReuploadOfSession(channelSlug, v.title)) {
      youtubeReuploadCount++;
      continue;
    }
    seenVideoIds.add(v.videoId);
    const meta = youtubeMetadata[v.videoId];
    const transcript = youtubeTranscripts[v.videoId] ?? "";
    const publishedAt = v.publishedAt ? new Date(v.publishedAt).getTime() : 0;
    const id = `yt-${v.videoId}`;
    const description = meta?.description || v.description || "";
    const duration = meta?.duration ?? null;
    const topics = [...(meta?.tags ?? []), ...(meta?.categories ?? [])].join(", ");
    const descriptionSearchText = [description, entry?.location].filter(Boolean).join(" ");
    const speakerNames = (youtubeSpeakersBySlug[channelSlug]?.[v.videoId] ?? []).join(", ");

    const { lastInsertRowid: youtubeRowid } = insertVideo.run(
      id,
      "youtube",
      v.title ?? "",
      description,
      null,
      orgName,
      channelSlug,
      null,
      "",
      publishedAt,
      duration,
      v.thumbnail ?? null,
      `/watch/${id}`,
      speakerNames,
      topics,
      transcript ? 1 : 0,
      transcript || null,
      null,
      null
    );
    insertFts.run(youtubeRowid, v.title ?? "", descriptionSearchText, speakerNames, topics, orgName, "", transcript ?? "");
    youtubeCount++;
  }
}

db.exec("PRAGMA optimize;");
db.close();

console.log(`Built ${DB_PATH}`);
console.log(`  streameth videos: ${streamethCount}`);
console.log(
  `  youtube videos:   ${youtubeCount} (skipped ${youtubeDupeCount} cross-channel dupes, ${youtubeReuploadCount} re-uploads of a StreamETH session)`
);
console.log(`  total:            ${streamethCount + youtubeCount}`);
