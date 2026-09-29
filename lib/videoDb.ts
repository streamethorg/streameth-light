import "server-only";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { lazy } from "./lazy";
import type { BrowseFilters, DurationBucket } from "./browseParams";
import { getOrgLogo } from "./data";

export interface UnifiedVideo {
  id: string;
  source: "streameth" | "youtube";
  title: string;
  description: string;
  orgName: string;
  orgSlug: string;
  orgLogo: string | null;
  eventName: string;
  publishedAt: number;
  durationSeconds: number | null;
  coverImage: string | null;
  watchUrl: string;
  speakers: string[];
  topics: string[];
  transcript: string | null;
  downloadUrl: string | null;
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
}

function rowToVideo(row: VideoRow): UnifiedVideo {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    description: row.description,
    orgName: row.org_name,
    orgSlug: row.org_slug,
    orgLogo: getOrgLogo(row.org_slug) ?? null,
    eventName: row.event_name,
    publishedAt: row.published_at,
    durationSeconds: row.duration_seconds,
    coverImage: row.cover_image,
    watchUrl: row.watch_url,
    speakers: row.speakers ? row.speakers.split(", ").filter(Boolean) : [],
    topics: row.topics ? row.topics.split(", ").filter(Boolean) : [],
    transcript: row.transcript,
    downloadUrl: row.download_url,
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

export function browseVideos(filters: BrowseFilters): UnifiedVideo[] {
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
         JOIN videos v ON v.id = videos_fts.id
         WHERE videos_fts MATCH ? ${where.length ? `AND ${where.join(" AND ")}` : ""}
         ORDER BY ${filters.sort === "newest" ? "v.published_at DESC" : filters.sort === "oldest" ? "v.published_at ASC" : "bm25(videos_fts)"}
         LIMIT ?`
      )
      .all(matchQuery(q), ...params, MAX_RESULTS) as unknown as VideoRow[];
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
    .all(...params, MAX_RESULTS) as unknown as VideoRow[];
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
  logo: string | null;
  total: number;
  videos: UnifiedVideo[];
}

/** The biggest channels (the flagship conferences), each with its latest
 * videos — the homepage's per-channel rows. Ordered by archive size rather
 * than recency so they don't repeat the "Just added" row above them. */
export function channelShelves(shelves = 4, perShelf = 12, minVideos = 12): ChannelShelf[] {
  const db = getDb();
  const channels = db
    .prepare(
      `SELECT org_slug AS slug, org_name AS name, COUNT(*) AS total
       FROM videos
       WHERE org_slug != ''
       GROUP BY org_slug
       HAVING SUM(cover_image IS NOT NULL) >= ?
       ORDER BY total DESC
       LIMIT ?`
    )
    .all(minVideos, shelves) as unknown as { slug: string; name: string; total: number }[];

  const latest = db.prepare(
    `SELECT * FROM videos WHERE org_slug = ? AND cover_image IS NOT NULL
     ORDER BY published_at DESC LIMIT ?`
  );

  return channels.map((c) => ({
    slug: c.slug,
    name: c.name,
    logo: getOrgLogo(c.slug) ?? null,
    total: c.total,
    videos: (latest.all(c.slug, perShelf) as unknown as VideoRow[]).map(rowToVideo),
  }));
}

export function archiveStats(): { videos: number; channels: number } {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS videos, COUNT(DISTINCT org_slug) AS channels FROM videos")
    .get() as unknown as { videos: number; channels: number };
  return { videos: row.videos, channels: row.channels };
}

/** Each channel's newest video cover, for channel tiles that would otherwise
 * have no imagery (the orgs' own logos are gone with the old CDN). */
export function latestCoverByChannel(): Map<string, string> {
  const db = getDb();
  const rows = db
    .prepare(
      // SQLite's bare-column rule: with MAX(), the other selected columns
      // come from the row holding that max — i.e. the newest video's cover.
      `SELECT org_slug AS slug, cover_image AS cover, MAX(published_at)
       FROM videos WHERE cover_image IS NOT NULL GROUP BY org_slug`
    )
    .all() as unknown as { slug: string; cover: string }[];
  return new Map(rows.map((row) => [row.slug, row.cover]));
}
