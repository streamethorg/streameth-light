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
  eventName: string;
  publishedAt: number;
  durationSeconds: number | null;
  coverImage: string | null;
  watchUrl: string;
  speakers: string[];
  topics: string[];
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
}

function rowToVideo(row: VideoRow): UnifiedVideo {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    description: row.description,
    orgName: row.org_name,
    orgSlug: row.org_slug,
    eventName: row.event_name,
    publishedAt: row.published_at,
    durationSeconds: row.duration_seconds,
    coverImage: row.cover_image,
    watchUrl: row.watch_url,
    speakers: row.speakers ? row.speakers.split(", ").filter(Boolean) : [],
    topics: row.topics ? row.topics.split(", ").filter(Boolean) : [],
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
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const topic of row.topics.split(", ")) {
      if (!topic) continue;
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic]) => topic);
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
