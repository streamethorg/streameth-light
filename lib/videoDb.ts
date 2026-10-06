import "server-only";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { lazy } from "./lazy";
import type { BrowseFilters, DurationBucket } from "./browseParams";

export interface UnifiedVideo {
  id: string;
  source: "streameth" | "youtube";
  title: string;
  description: string;
  orgName: string;
  orgSlug: string;
  /** StreamETH event `_id`; null for YouTube uploads. */
  eventId: string | null;
  eventName: string;
  publishedAt: number;
  durationSeconds: number | null;
  coverImage: string | null;
  watchUrl: string;
  speakers: string[];
  topics: string[];
  transcript: string | null;
  downloadUrl: string | null;
  /** Playable stream/file URL for StreamETH sessions; null for YouTube. */
  contentUrl: string | null;
}

export interface OrgOption {
  slug: string;
  name: string;
}

interface VideoRow {
  id: string;
  source: "streameth" | "youtube";
  title: string;
  description: string;
  org_name: string;
  org_slug: string;
  event_id: string | null;
  event_name: string;
  published_at: number;
  duration_seconds: number | null;
  cover_image: string | null;
  watch_url: string;
  speakers: string;
  topics: string;
  transcript: string | null;
  download_url: string | null;
  content_url: string | null;
}

function rowToVideo(row: VideoRow): UnifiedVideo {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    description: row.description,
    orgName: row.org_name,
    orgSlug: row.org_slug,
    eventId: row.event_id,
    eventName: row.event_name,
    publishedAt: row.published_at,
    durationSeconds: row.duration_seconds,
    coverImage: row.cover_image,
    watchUrl: row.watch_url,
    speakers: row.speakers ? row.speakers.split(", ").filter(Boolean) : [],
    topics: row.topics ? row.topics.split(", ").filter(Boolean) : [],
    transcript: row.transcript,
    downloadUrl: row.download_url,
    contentUrl: row.content_url,
  };
}

const getDb = lazy(() => {
  const dbPath = join(process.cwd(), "data", "streameth.db");
  return new DatabaseSync(dbPath, { readOnly: true });
});

const DURATION_BOUNDS: Record<DurationBucket, [number, number]> = {
  short: [0, 4 * 60],
  medium: [4 * 60, 20 * 60],
  long: [20 * 60, Number.MAX_SAFE_INTEGER],
};

const MAX_RESULTS = 4000;

export function browseVideos(filters: BrowseFilters, limit = MAX_RESULTS): UnifiedVideo[] {
  const db = getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filters.orgIds.length > 0) {
    where.push(`v.org_slug IN (${filters.orgIds.map(() => "?").join(",")})`);
    params.push(...filters.orgIds);
  }
  if (filters.eventIds.length > 0) {
    where.push(`v.event_id IN (${filters.eventIds.map(() => "?").join(",")})`);
    params.push(...filters.eventIds);
  }
  if (filters.speaker) {
    where.push("v.speakers LIKE ? COLLATE NOCASE");
    params.push(`%${filters.speaker}%`);
  }
  if (filters.topic) {
    where.push("v.topics LIKE ? COLLATE NOCASE");
    params.push(`%${filters.topic}%`);
  }
  if (filters.duration) {
    const [min, max] = DURATION_BOUNDS[filters.duration];
    where.push("v.duration_seconds >= ? AND v.duration_seconds < ?");
    params.push(min, max);
  }
  if (filters.dateFrom) {
    where.push("v.published_at >= ?");
    params.push(new Date(filters.dateFrom).getTime());
  }
  if (filters.dateTo) {
    where.push("v.published_at < ?");
    params.push(new Date(filters.dateTo).getTime() + 24 * 60 * 60 * 1000);
  }

  const q = filters.q.trim();
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  if (q) {
    const rows = db
      .prepare(
        `SELECT v.* FROM videos_fts
         JOIN videos v ON v.rowid = videos_fts.rowid
         WHERE videos_fts MATCH ? ${where.length ? `AND ${where.join(" AND ")}` : ""}
         ORDER BY ${filters.sort === "newest" ? "v.published_at DESC" : filters.sort === "oldest" ? "v.published_at ASC" : "bm25(videos_fts)"}
         LIMIT ?`
      )
      .all(matchQuery(q), ...params, limit) as unknown as VideoRow[];
    return rows.map(rowToVideo);
  }

  const orderBy =
    filters.sort === "oldest"
      ? "v.published_at ASC"
      : filters.sort === "duration_desc"
      ? "v.duration_seconds DESC"
      : filters.sort === "duration_asc"
      ? "v.duration_seconds ASC"
      : "v.published_at DESC";

  const rows = db
    .prepare(`SELECT v.* FROM videos v ${whereSql} ORDER BY ${orderBy} LIMIT ?`)
    .all(...params, limit) as unknown as VideoRow[];
  return rows.map(rowToVideo);
}

/** FTS5 default syntax treats bare punctuation/quotes as query syntax — quote
 * each term so a plain user query like "vitalik's talk" doesn't throw. */
function matchQuery(q: string): string {
  return q
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"*`)
    .join(" ");
}

// Words that carry no meaning for retrieval — dropped from question-style
// queries so "what is the roadmap for the merge" searches roadmap/merge.
const STOPWORDS = new Set(
  (
    "a an and are as at be been but by can could did do does for from had has have how i if in into is it its " +
    "me my of on or our should so than that the their them then there these they this to was we were what " +
    "when where which who why will with would you your about any some just more most also not no yes vs"
  ).split(" ")
);

/** Retrieval for AI answers: any-term (OR) full-text match ranked by BM25,
 * weighting titles, speakers and transcripts over the rest, so a natural
 * question still finds talks that cover only part of it. Among the top
 * matches, talks with a transcript come first — a description alone rarely
 * says what was actually argued. */
export function searchForAnswers(query: string, limit = 8): UnifiedVideo[] {
  const terms = [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^\p{L}\p{N}-]+/u)
        .map((t) => t.replace(/^-+|-+$/g, ""))
        .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    ),
  ];
  if (terms.length === 0) return [];
  const match = terms.map((t) => `"${t.replace(/"/g, '""')}"*`).join(" OR ");
  const rows = getDb()
    .prepare(
      `SELECT v.* FROM videos_fts
       JOIN videos v ON v.rowid = videos_fts.rowid
       WHERE videos_fts MATCH ?
       ORDER BY bm25(videos_fts, 4, 1, 3, 1, 1, 1, 2)
       LIMIT ?`
    )
    .all(match, limit * 3) as unknown as VideoRow[];
  const withTranscript = rows.filter((r) => r.transcript);
  const without = rows.filter((r) => !r.transcript);
  return [...withTranscript, ...without].slice(0, limit).map(rowToVideo);
}

export function topTopics(limit = 16): string[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT topics FROM videos WHERE topics != ''")
    .all() as unknown as { topics: string }[];
  // Tags come from many uploaders with inconsistent casing ("ethereum" vs
  // "Ethereum"), so group case-insensitively and label each group with its
  // most common spelling — otherwise the chip row shows near-duplicates.
  const groups = new Map<string, { total: number; spellings: Map<string, number> }>();
  for (const row of rows) {
    for (const topic of row.topics.split(", ")) {
      if (!topic) continue;
      const key = topic.toLowerCase();
      const group = groups.get(key) ?? { total: 0, spellings: new Map<string, number>() };
      group.total += 1;
      group.spellings.set(topic, (group.spellings.get(topic) ?? 0) + 1);
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map(({ spellings }) => [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0]);
}

export function getVideoById(id: string): UnifiedVideo | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM videos WHERE id = ?").get(id) as
    | VideoRow
    | undefined;
  return row ? rowToVideo(row) : undefined;
}

/** Every video published at or after `since` (ms), newest first. */
export function videosPublishedSince(since: number): UnifiedVideo[] {
  const rows = getDb()
    .prepare("SELECT * FROM videos WHERE published_at >= ? ORDER BY published_at DESC")
    .all(since) as unknown as VideoRow[];
  return rows.map(rowToVideo);
}

export function relatedVideos(video: UnifiedVideo, limit = 12): UnifiedVideo[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM videos WHERE org_slug = ? AND id != ? ORDER BY published_at DESC LIMIT ?`
    )
    .all(video.orgSlug, video.id, limit) as unknown as VideoRow[];
  return rows.map(rowToVideo);
}

export function listChannelOptions(): OrgOption[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT DISTINCT org_slug as slug, org_name as name FROM videos WHERE org_slug != '' ORDER BY name"
    )
    .all() as unknown as OrgOption[];
  // node:sqlite rows are null-prototype objects, which RSC can't serialize
  // across the client-component boundary — copy into plain objects.
  return rows.map((r) => ({ slug: r.slug, name: r.name }));
}

export interface ChannelShelf {
  slug: string;
  name: string;
  total: number;
  /** Newest video's published_at (ms). */
  latest: number;
  videos: UnifiedVideo[];
}

/** Channels with their latest videos — the homepage's channel index.
 * Channels with only a handful of videos are skipped so a row is never a
 * lonely one-card strip. `order` picks the flagship conferences ("size") or
 * whoever published most recently ("recent"). */
export function channelShelves(
  shelves = 4,
  perShelf = 12,
  { minVideos = 12, order = "size" }: { minVideos?: number; order?: "size" | "recent" } = {}
): ChannelShelf[] {
  const db = getDb();
  const channels = db
    .prepare(
      `SELECT org_slug AS slug, org_name AS name, COUNT(*) AS total, MAX(published_at) AS latest
       FROM videos
       WHERE org_slug != ''
       GROUP BY org_slug
       HAVING SUM(cover_image IS NOT NULL) >= ?
       ORDER BY ${order === "recent" ? "latest" : "total"} DESC
       LIMIT ?`
    )
    .all(minVideos, shelves) as unknown as {
    slug: string;
    name: string;
    total: number;
    latest: number;
  }[];

  const latest = db.prepare(
    `SELECT * FROM videos WHERE org_slug = ? AND cover_image IS NOT NULL
     ORDER BY published_at DESC LIMIT ?`
  );

  return channels.map((c) => ({
    slug: c.slug,
    name: c.name,
    total: c.total,
    latest: c.latest,
    videos: (latest.all(c.slug, perShelf) as unknown as VideoRow[]).map(rowToVideo),
  }));
}

export function archiveStats(): { videos: number; channels: number; transcripts: number } {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) AS videos, COUNT(DISTINCT org_slug) AS channels, SUM(has_transcript) AS transcripts FROM videos"
    )
    .get() as unknown as { videos: number; channels: number; transcripts: number };
  return { videos: row.videos, channels: row.channels, transcripts: row.transcripts ?? 0 };
}

/** A channel's videos, newest first, for its "Videos" tab. */
export function channelVideos(slug: string, limit: number): { videos: UnifiedVideo[]; total: number } {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM videos WHERE org_slug = ? ORDER BY published_at DESC LIMIT ?`)
    .all(slug, limit) as unknown as VideoRow[];
  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM videos WHERE org_slug = ?`)
    .get(slug) as unknown as { total: number };
  return { videos: rows.map(rowToVideo), total };
}

export interface ChannelSummary {
  slug: string;
  name: string;
  videos: number;
  /** Newest video's published_at (ms). */
  latest: number;
}

/** Every channel with its archive size, biggest first. */
export function listChannelSummaries(): ChannelSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT org_slug AS slug, org_name AS name, COUNT(*) AS videos, MAX(published_at) AS latest
       FROM videos WHERE org_slug != '' GROUP BY org_slug ORDER BY videos DESC`
    )
    .all() as unknown as ChannelSummary[];
  return rows.map((r) => ({ slug: r.slug, name: r.name, videos: r.videos, latest: r.latest }));
}

export interface SitemapVideo {
  id: string;
  source: "streameth" | "youtube";
  title: string;
  description: string;
  orgName: string;
  orgSlug: string;
  eventName: string;
  speakers: string[];
  topics: string[];
  publishedAt: number;
  durationSeconds: number | null;
  coverImage: string | null;
  contentUrl: string | null;
}

export function countVideos(): number {
  const { total } = getDb().prepare("SELECT COUNT(*) AS total FROM videos").get() as unknown as {
    total: number;
  };
  return total;
}

/** One page of the catalog in a stable order (oldest first, then id), for
 * the chunked video sitemaps — skips the transcript column, which would be
 * hundreds of MB across the whole table. */
export function listVideosForSitemap(offset: number, limit: number): SitemapVideo[] {
  const rows = getDb()
    .prepare(
      `SELECT id, source, title, description, org_name, org_slug, event_name, speakers, topics,
              published_at, duration_seconds, cover_image, content_url
       FROM videos ORDER BY published_at ASC, id ASC LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as unknown as (Omit<VideoRow, "transcript" | "watch_url" | "event_id" | "download_url">)[];
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    title: r.title,
    description: r.description,
    orgName: r.org_name,
    orgSlug: r.org_slug,
    eventName: r.event_name,
    speakers: r.speakers ? r.speakers.split(", ").filter(Boolean) : [],
    topics: r.topics ? r.topics.split(", ").filter(Boolean) : [],
    publishedAt: r.published_at,
    durationSeconds: r.duration_seconds,
    coverImage: r.cover_image,
    contentUrl: r.content_url,
  }));
}
