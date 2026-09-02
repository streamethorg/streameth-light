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

const organizationsRaw = load("organizations.json").filter((o) => o.slug);
const events = load("events.json").filter((e) => e.slug && !e.unlisted);
const sessions = load("sessions.json");
const directory = load("directory.json").entries;
const livepeerResolved = loadSource("livepeer-resolved.json") ?? {};
const youtubeVideosBySlug = loadSource("youtube-videos.json") ?? {};
const youtubeTranscripts = loadSource("youtube-transcripts.json") ?? {};

const orgById = new Map(organizationsRaw.map((o) => [o._id, o]));
const eventById = new Map(events.map((e) => [e._id, e]));
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
    has_transcript INTEGER NOT NULL DEFAULT 0
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
    speakers, topics, has_transcript
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  const speakers = (s.speakers ?? []).map((sp) => sp.name).filter(Boolean).join(", ");
  const topics = (s.autoLabels ?? []).join(", ");
  const description = [s.description, s.aiDescription].filter(Boolean).join(" ");
  const duration =
    s.playback?.duration ??
    (s.start && s.end && s.end > s.start ? (s.end - s.start) / 1000 : null);
  const transcript = s.transcripts?.text ?? "";

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
    s.coverImage ?? null,
    `/watch/${s._id}`,
    speakers,
    topics,
    transcript ? 1 : 0
  );
  insertFts.run(
    s._id,
    s.name ?? "",
    description,
    speakers,
    topics,
    org?.name ?? "",
    event?.name ?? "",
    transcript
  );
  streamethCount++;
}

let youtubeCount = 0;
let youtubeDupeCount = 0;
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
    seenVideoIds.add(v.videoId);
    const transcript = youtubeTranscripts[v.videoId] ?? "";
    const publishedAt = v.publishedAt ? new Date(v.publishedAt).getTime() : 0;
    const id = `yt-${v.videoId}`;

    insertVideo.run(
      id,
      "youtube",
      v.title ?? "",
      v.description ?? "",
      null,
      orgName,
      channelSlug,
      null,
      "",
      publishedAt,
      null,
      v.thumbnail ?? null,
      `/watch/${id}`,
      "",
      "",
      transcript ? 1 : 0
    );
    insertFts.run(id, v.title ?? "", v.description ?? "", "", "", orgName, "", transcript);
    youtubeCount++;
  }
}

db.exec("PRAGMA optimize;");
db.close();

console.log(`Built ${DB_PATH}`);
console.log(`  streameth videos: ${streamethCount}`);
console.log(`  youtube videos:   ${youtubeCount} (skipped ${youtubeDupeCount} cross-channel dupes)`);
console.log(`  total:            ${streamethCount + youtubeCount}`);
