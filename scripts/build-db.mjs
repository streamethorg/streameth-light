// Builds data/streameth.db — a single SQLite database unifying StreamETH
// sessions and tracked YouTube videos into one `videos` table with an FTS5
// full-text index, so the homepage feed and /search query one real index
// instead of two separate in-memory JS pipelines that don't agree with each
// other. Regenerated from the committed JSON exports; safe to delete and
// re-run (`pnpm build-db`) any time data/*.json changes.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

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

const organizationsRaw = load("organizations.json").filter((o) => o.slug);
const events = load("events.json").filter((e) => e.slug && !e.unlisted);
const sessions = load("sessions.json");
const stages = load("stages.json");
const directory = load("directory.json").entries;
const livepeerResolved = loadSource("livepeer-resolved.json") ?? {};
const livepeerThumbnails = loadSource("livepeer-thumbnails.json") ?? {};
const livepeerDownloads = loadSource("livepeer-downloads.json") ?? {};
const youtubeVideosBySlug = loadSource("youtube-videos.json") ?? {};
const youtubeTranscripts = loadSource("youtube-transcripts.json") ?? {};
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

function sessionHasVideo(s) {
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
    download_url TEXT
  );

  CREATE INDEX idx_videos_org ON videos(org_id);
  CREATE INDEX idx_videos_event ON videos(event_id);
  CREATE INDEX idx_videos_published ON videos(published_at);
  CREATE INDEX idx_videos_duration ON videos(duration_seconds);

  CREATE VIRTUAL TABLE videos_fts USING fts5(
    id UNINDEXED,
    title,
    description,
    speakers,
    topics,
    org_name,
    event_name,
    transcript
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
    speakers, topics, has_transcript, transcript, download_url
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertFts = db.prepare(`
  INSERT INTO videos_fts (id, title, description, speakers, topics, org_name, event_name, transcript)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let streamethCount = 0;
const seenIds = new Set();
for (const s of sessions) {
  if (!sessionHasVideo(s)) continue;
  if (seenIds.has(s._id)) {
    console.warn(`Skipping duplicate session id: ${s._id}`);
    continue;
  }
  seenIds.add(s._id);
  const event = eventById.get(s.eventId);
  const org = event ? orgById.get(event.organizationId) : orgById.get(s.organizationId);
  const stage = stageById.get(s.stageId);
  const speakerList = s.speakers ?? [];

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
  const topicsDisplay = (s.autoLabels ?? []).join(", ");
  const description = [s.description, s.aiDescription].filter(Boolean).join(" ");
  const duration =
    s.playback?.duration ??
    (s.start && s.end && s.end > s.start ? (s.end - s.start) / 1000 : null);
  const transcript = s.transcripts?.text ?? "";

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

  insertVideo.run(
    s._id,
    "streameth",
    s.name ?? "",
    description,
    org?._id ?? null,
    org?.name ?? "",
    org?.slug ?? "",
    event?._id ?? null,
    event?.name ?? s.eventSlug ?? "",
    s.start ?? 0,
    duration,
    resolvedCoverImage(s),
    `/watch/${s._id}`,
    speakerNames,
    topicsDisplay,
    transcript ? 1 : 0,
    transcript || null,
    resolvedDownloadUrl(s)
  );
  insertFts.run(
    s._id,
    s.name ?? "",
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

    insertVideo.run(
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
      "",
      topics,
      transcript ? 1 : 0,
      transcript || null,
      null
    );
    insertFts.run(id, v.title ?? "", descriptionSearchText, "", topics, orgName, "", transcript);
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
