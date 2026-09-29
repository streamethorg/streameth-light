import "server-only";
import { readFileSync } from "fs";
import { join } from "path";
import { lazy } from "./lazy";
import type { Event, Organization, Session, Speaker, Stage } from "./types";

function load<T>(file: string): T {
  const raw = readFileSync(join(process.cwd(), "data", file), "utf-8");
  return JSON.parse(raw) as T;
}

// The legacy lp-playback.com short-link domain itself is dead (DNS/redirect
// no longer resolves), but the underlying Livepeer asset usually still
// exists — resolved via scripts/resolve-livepeer-playback.py against
// Livepeer's public playback-info API (https://livepeer.studio/api/playback)
// and cached here by playbackId. Only sessions with neither a working direct
// URL nor a resolved playbackId are genuinely unplayable.
const DEAD_VIDEO_HOSTS = new Set(["lp-playback.com"]);

function isDeadVideoHost(url: string): boolean {
  try {
    return DEAD_VIDEO_HOSTS.has(new URL(url).hostname);
  } catch {
    return true;
  }
}

const getResolvedPlaybackUrls = lazy((): Record<string, string | null> => {
  try {
    return load<Record<string, string | null>>("sources/livepeer-resolved.json");
  } catch {
    return {};
  }
});

function resolvedUrlForSession(s: Session): string | undefined {
  if (!s.playbackId) return undefined;
  return getResolvedPlaybackUrls()[s.playbackId] ?? undefined;
}

// The dead DigitalOcean Spaces bucket (see cleanImageUrl below) took every
// session coverImage with it. For sessions with a Livepeer playbackId,
// resolve-livepeer-thumbnails.py recovers a real thumbnail — either a
// direct Livepeer-generated image or the first frame of its "Thumbnails"
// VTT track — via Livepeer's public playback-info API, cached here by
// playbackId.
const getResolvedThumbnails = lazy((): Record<string, string | null> => {
  try {
    return load<Record<string, string | null>>("sources/livepeer-thumbnails.json");
  } catch {
    return {};
  }
});

function resolvedThumbnailForSession(s: Session): string | undefined {
  if (!s.playbackId) return undefined;
  return getResolvedThumbnails()[s.playbackId] ?? undefined;
}

// A direct progressive MP4 URL per playbackId (see
// scripts/resolve-livepeer-downloads.py) — what actually makes a "Download"
// button possible, since an .m3u8 HLS playlist isn't a single file.
const getResolvedDownloads = lazy((): Record<string, string | null> => {
  try {
    return load<Record<string, string | null>>("sources/livepeer-downloads.json");
  } catch {
    return {};
  }
});

export function getDownloadUrl(session: Session): string | undefined {
  const videoUrl = session.videoUrl || session.playback?.videoUrl;
  if (videoUrl && !isDeadVideoHost(videoUrl) && videoUrl.endsWith(".mp4")) {
    return videoUrl;
  }
  if (!session.playbackId) return undefined;
  return getResolvedDownloads()[session.playbackId] ?? undefined;
}

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
function isPlaceholderSpeakerName(name: string | undefined): boolean {
  const n = (name ?? "").trim();
  return /\bteam$/i.test(n) || /^streameth$/i.test(n);
}

function isJunkTitle(title: string | undefined): boolean {
  const t = (title ?? "").trim();
  return TEST_TITLE_RE.test(t) || RAW_FILENAME_RE.test(t);
}

// A real title that just kept its file extension (e.g. "Fund Tokenization.mp4")
// — strip it so the display title reads like every other session's.
function cleanTitle(title: string | undefined): string {
  return (title ?? "").trim().replace(/\.(mp4|mov|mkv|m4v)$/i, "");
}

// `published: "private"` sessions are internal review copies, failed/pending
// processing clips, or unlisted draft segments — often sharing the exact
// same generic talk title as a real public session (e.g. Devcon 7 SEA has
// 1,667 private sessions vs. 459 public ones), which made every real talk
// look duplicated once both showed up as browsable tiles.
const HAS_VIDEO = (s: Session) => {
  if (s.published === "private") return false;
  if (isJunkTitle(s.name)) return false;
  const videoUrl = s.videoUrl || s.playback?.videoUrl;
  if (videoUrl && !isDeadVideoHost(videoUrl)) return true;
  return Boolean(resolvedUrlForSession(s));
};

// The old StreamETH DigitalOcean Spaces buckets (both the CDN alias, which no
// longer has DNS, and the origin bucket, which now 404s/NoSuchBucket) have
// been decommissioned — every logo/banner/thumbnail hosted there is gone for
// good. Strip those URLs so the UI falls back to its placeholder treatment
// instead of rendering a broken image.
function cleanImageUrl<T extends string | undefined>(url: T): T {
  if (!url || /digitaloceanspaces\.com/i.test(url)) {
    return undefined as T;
  }
  return url;
}

export const getStore = lazy(() => {
  const organizations = load<Organization[]>("organizations.json")
    .filter((o) => o.slug)
    .map((o) => ({
      ...o,
      logo: cleanImageUrl(o.logo),
      banner: cleanImageUrl(o.banner),
    }));
  const events = load<Event[]>("events.json")
    .filter((e) => e.slug && !e.unlisted)
    .map((e) => ({
      ...e,
      logo: cleanImageUrl(e.logo),
      banner: cleanImageUrl(e.banner),
      eventCover: cleanImageUrl(e.eventCover),
    }));
  const stages = load<Stage[]>("stages.json");
  const speakers = load<Speaker[]>("speakers.json").map((sp) => ({
    ...sp,
    photo: cleanImageUrl(sp.photo),
  }));
  const sessions = load<Session[]>("sessions.json")
    .filter(HAS_VIDEO)
    .map(
      (s): Session => ({
        ...s,
        name: cleanTitle(s.name),
        coverImage: cleanImageUrl(s.coverImage) ?? resolvedThumbnailForSession(s),
        speakers: (s.speakers ?? [])
          .filter((sp) => !isPlaceholderSpeakerName(sp.name))
          .map((sp) => ({
            ...sp,
            photo: cleanImageUrl(sp.photo),
          })),
      })
    )
    .sort((a, b) => b.start - a.start);

  const orgById = new Map(organizations.map((o) => [o._id, o]));
  const orgBySlug = new Map(organizations.map((o) => [o.slug, o]));
  const eventById = new Map(events.map((e) => [e._id, e]));
  const eventBySlug = new Map(events.map((e) => [e.slug, e]));
  const stageById = new Map(stages.map((s) => [s._id, s]));
  const sessionById = new Map(sessions.map((s) => [s._id, s]));

  const eventsByOrg = new Map<string, Event[]>();
  for (const e of events) {
    const list = eventsByOrg.get(e.organizationId) ?? [];
    list.push(e);
    eventsByOrg.set(e.organizationId, list);
  }
  for (const list of eventsByOrg.values()) {
    list.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  }

  const sessionsByEvent = new Map<string, Session[]>();
  for (const s of sessions) {
    const list = sessionsByEvent.get(s.eventId) ?? [];
    list.push(s);
    sessionsByEvent.set(s.eventId, list);
  }

  const stagesByEvent = new Map<string, Stage[]>();
  for (const st of stages) {
    const list = stagesByEvent.get(st.eventId) ?? [];
    list.push(st);
    stagesByEvent.set(st.eventId, list);
  }
  for (const list of stagesByEvent.values()) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const speakersByEvent = new Map<string, Speaker[]>();
  for (const sp of speakers) {
    const list = speakersByEvent.get(sp.eventId) ?? [];
    list.push(sp);
    speakersByEvent.set(sp.eventId, list);
  }

  const sessionCountByOrg = new Map<string, number>();
  for (const s of sessions) {
    sessionCountByOrg.set(
      s.organizationId,
      (sessionCountByOrg.get(s.organizationId) ?? 0) + 1
    );
  }

  return {
    organizations,
    events,
    stages,
    speakers,
    sessions,
    orgById,
    orgBySlug,
    eventById,
    eventBySlug,
    stageById,
    sessionById,
    eventsByOrg,
    sessionsByEvent,
    stagesByEvent,
    speakersByEvent,
    sessionCountByOrg,
  };
});

export function listOrganizations(): Organization[] {
  return getStore().organizations;
}

export function listAllSessions(): Session[] {
  return getStore().sessions;
}

export function listAllEvents(): Event[] {
  return getStore().events;
}

export function getOrganization(slug: string): Organization | undefined {
  return getStore().orgBySlug.get(slug);
}

export function getOrgSessionCount(orgId: string): number {
  return getStore().sessionCountByOrg.get(orgId) ?? 0;
}

export function listEventsForOrg(orgId: string): Event[] {
  return getStore().eventsByOrg.get(orgId) ?? [];
}

export function getEvent(slug: string): Event | undefined {
  return getStore().eventBySlug.get(slug);
}

export function getEventById(eventId: string): Event | undefined {
  return getStore().eventById.get(eventId);
}

export function getOrgForEvent(event: Event | undefined): Organization | undefined {
  return event ? getStore().orgById.get(event.organizationId) : undefined;
}

export function getOrganizationById(orgId: string | undefined): Organization | undefined {
  return orgId ? getStore().orgById.get(orgId) : undefined;
}

/** A session's event record can be missing (orphaned sessions, per
 * lib/orphanSessions.ts) even though the session still carries its own
 * organizationId — falls back to that so the org is never silently dropped. */
export function getOrgForSession(
  session: Session,
  event: Event | undefined
): Organization | undefined {
  return getOrgForEvent(event) ?? getOrganizationById(session.organizationId);
}

export function listSessionsForEvent(eventId: string): Session[] {
  return getStore().sessionsByEvent.get(eventId) ?? [];
}

export function listStagesForEvent(eventId: string): Stage[] {
  return getStore().stagesByEvent.get(eventId) ?? [];
}

export function listSpeakersForEvent(eventId: string): Speaker[] {
  return getStore().speakersByEvent.get(eventId) ?? [];
}

export function getStage(stageId: string): Stage | undefined {
  return getStore().stageById.get(stageId);
}

export function getSession(sessionId: string): Session | undefined {
  return getStore().sessionById.get(sessionId);
}

export function getSessionVideoUrl(session: Session): string | undefined {
  return session.videoUrl || session.playback?.videoUrl;
}

export function buildPlaybackSrc(
  session: Session
): { src: string; type: "hls" | "mp4" } | undefined {
  const videoUrl = session.videoUrl || session.playback?.videoUrl;
  if (videoUrl && !isDeadVideoHost(videoUrl)) {
    return {
      src: videoUrl,
      type: videoUrl.endsWith(".m3u8") ? "hls" : "mp4",
    };
  }
  const resolved = resolvedUrlForSession(session);
  if (resolved) {
    return { src: resolved, type: "hls" };
  }
  if (videoUrl) {
    return { src: videoUrl, type: videoUrl.endsWith(".m3u8") ? "hls" : "mp4" };
  }
  return undefined;
}

export function relatedSessions(session: Session, limit = 8): Session[] {
  const all = listSessionsForEvent(session.eventId).filter(
    (s) => s._id !== session._id
  );
  return all.slice(0, limit);
}
