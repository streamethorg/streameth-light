import "server-only";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { lazy } from "./lazy";
import { getDirectory, listMiraEvents, type MiraEvent } from "./directory";
import {
  getOrganization,
  getOrganizationById,
  listAllEvents,
  listEventsForOrg,
  listSessionsForEvent,
  usableImage,
} from "./data";
import {
  findMatchingEventName,
  getYoutubeVideosForChannel,
  groupVideosByInferredEvent,
  type InferredEventGroup,
} from "./youtube";
import {
  channelVideosBetween,
  countFormatsBetween,
  getVideosByIds,
  liveStreamForChannel,
  type UnifiedVideo,
  type VideoFormat,
} from "./videoDb";
import {
  buildSeasonEvents,
  COVERAGE_TAIL_DAYS,
  eventDayNumber,
  eventStatus,
  eventWindow,
  inCoverage,
  type EventStatus,
} from "./seasonCore.mjs";

export type { EventStatus };

const DAY = 24 * 60 * 60 * 1000;

// The season: events from this far back (their coverage and recaps are still
// news) to this far ahead (worth a "coming up" line).
const SEASON_BACK_DAYS = 120;
const SEASON_AHEAD_DAYS = 90;

/** One scheduled talk, from data/sources/event-schedules.json
 * (scripts/pull-event-schedules.py). Times are UTC ms. */
export interface ScheduledSession {
  id: string;
  title: string;
  type: string;
  track: string;
  start: number;
  end: number;
  room: string;
  speakers: string[];
  youtubeId: string | null;
  doNotRecord: boolean;
}

export interface ScheduleSpeaker {
  avatar: string | null;
  bio: string | null;
  twitter: string | null;
}

interface EventSchedule {
  channel: string;
  rooms: string[];
  sessions: ScheduledSession[];
  /** By speaker name; absent in schedules pulled before it was added. */
  speakers?: Record<string, ScheduleSpeaker>;
}

/** One event of the season, from Mira's calendar, tied to the channel that
 * covers it when there is one. */
export interface SeasonEvent {
  /** "mira:<id>" */
  key: string;
  /** URL slug within its channel: /<channel>/<slug>. */
  slug: string;
  name: string;
  /** "YYYY-MM-DD" */
  start: string;
  end: string;
  city: string | null;
  country: string | null;
  website: string | null;
  description: string | null;
  /** Mira's cover image for the event, when it has one. */
  imageUrl: string | null;
  /** UTC ms span of the event's local days. */
  from: number;
  to: number;
  /** IANA zone of the event's country, when known. */
  timeZone: string | null;
  channelSlug: string | null;
  channelName: string | null;
  /** The event's coverage page, /<channel>/<slug>, when a channel covers it. */
  href: string | null;
  /** The covering channel's page. */
  channelHref: string | null;
  seriesSlug: string | null;
  hasSchedule: boolean;
  /** Archive events — an older StreamETH event or a YouTube event group,
   * not on the calendar — list their recordings by video id. Calendar
   * events don't: theirs are the channel's uploads around the event. */
  videoIds?: string[];
}

interface Channel {
  name: string;
  slug: string;
}

/** Channels that have something to show: YouTube uploads or StreamETH
 * sessions. */
const getCoveredChannels = lazy((): Channel[] =>
  getDirectory()
    .filter((e) => e.onStreamETH || getYoutubeVideosForChannel(e.slug).length > 0)
    .map((e) => ({ name: getOrganization(e.slug)?.name ?? e.name, slug: e.slug }))
);

const getSchedules = lazy((): Record<string, EventSchedule> => {
  const path = join(process.cwd(), "data", "sources", "event-schedules.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, EventSchedule>;
  } catch {
    return {};
  }
});

const getAllSeasonEvents = lazy((): SeasonEvent[] =>
  buildSeasonEvents({
    miraEvents: listMiraEvents(),
    channels: getCoveredChannels(),
    scheduledEventNames: new Set(Object.keys(getSchedules())),
  })
);

/** The time a page is rendered for. Server components render once per
 * request, so reading the clock there is fine — it's kept out of component
 * bodies so the status logic has one place that decides "now". In
 * development, `?now=2026-11-04T08:00:00Z` previews another moment (e.g.
 * an event's live state before it starts). */
export function requestTime(override?: string | string[]): number {
  if (process.env.NODE_ENV === "development" && typeof override === "string") {
    const at = Date.parse(override);
    if (Number.isFinite(at)) return at;
  }
  return Date.now();
}

export function statusOf(event: SeasonEvent, now = Date.now()): EventStatus {
  const status = eventStatus(event, now);
  // An archive event's dates come from its uploads, which can run to today:
  // it's never on air or still to come.
  if (event.videoIds && (status === "live" || status === "upcoming")) return "recent";
  return status;
}

/** The season's events, soonest first: from SEASON_BACK_DAYS ago to
 * SEASON_AHEAD_DAYS ahead. */
export function listSeasonEvents(now = Date.now()): SeasonEvent[] {
  const from = now - SEASON_BACK_DAYS * DAY;
  const to = now + SEASON_AHEAD_DAYS * DAY;
  return getAllSeasonEvents().filter((e) => e.to >= from && e.from <= to);
}

// The unclassified-channel catch-all in groupVideosByInferredEvent — a
// bucket of uploads, not an event.
const FALLBACK_GROUP = "Recent uploads";
// How long before an edition its channel may upload trailers and
// announcements under the edition's name.
const RUN_UP_DAYS = 180;
// Fewer uploads than this in a YouTube group: a one-off, not an event.
const MIN_GROUP_VIDEOS = 3;

function archiveEvent(fields: {
  key: string;
  slug: string;
  name: string;
  start: string;
  end: string;
  city: string | null;
  description: string | null;
  imageUrl: string | null;
  channelSlug: string;
  channelName: string;
  videoIds: string[];
}): SeasonEvent {
  const { from, to } = eventWindow(fields.start, fields.end, null);
  return {
    ...fields,
    country: null,
    website: null,
    from,
    to,
    timeZone: null,
    href: `/${fields.channelSlug}/${fields.slug}`,
    channelHref: `/${fields.channelSlug}`,
    seriesSlug: null,
    hasSchedule: false,
  };
}

/** "YYYY-MM-DD" of a date string, or null when it doesn't parse. */
function isoDay(raw: string | undefined | null): string | null {
  const at = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(at) ? new Date(at).toISOString().slice(0, 10) : null;
}

function groupDays(group: InferredEventGroup): { start: string; end: string; times: number[] } | null {
  const times = group.videos.map((v) => Date.parse(v.publishedAt)).filter(Number.isFinite).sort((a, b) => a - b);
  if (times.length === 0) return null;
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  return { start: day(times[0]), end: day(times[times.length - 1]), times };
}

/** Every past event in the archive that isn't on the calendar, as a
 * coverage page: StreamETH-hosted events (with the YouTube group that's the
 * same event) and YouTube event groups. A group mostly uploaded during a
 * calendar edition's coverage window is that edition. `groupHref` maps
 * "<channel>/<group slug>" to the page that now covers the group. */
const getArchive = lazy(
  (): { events: SeasonEvent[]; groupHref: Map<string, string>; editionCover: Map<string, string> } => {
  const calendar = getAllSeasonEvents();
  const events: SeasonEvent[] = [];
  const groupHref = new Map<string, string>();
  const editionCover = new Map<string, string>();
  const taken = new Set(calendar.flatMap((e) => (e.href ? [e.href] : [])));
  const groupsByChannel = new Map(
    getDirectory().map((entry) => [
      entry.slug,
      groupVideosByInferredEvent(getYoutubeVideosForChannel(entry.slug), entry.slug).filter(
        (g) => g.label !== FALLBACK_GROUP
      ),
    ])
  );

  for (const event of listAllEvents()) {
    const org = getOrganizationById(event.organizationId);
    if (!org) continue;
    const slug = event.slug;
    if (taken.has(`/${org.slug}/${slug}`)) continue;
    const group = groupsByChannel.get(org.slug)?.find((g) => findMatchingEventName(g.label, [event.name]) === event.name);
    const videoIds = [
      ...listSessionsForEvent(event._id).map((s) => s._id),
      ...(group?.videos.map((v) => `yt-${v.videoId}`) ?? []),
    ];
    const days = group ? groupDays(group) : null;
    const start = isoDay(event.start) ?? days?.start;
    if (!start) continue;
    const end = isoDay(event.end) ?? days?.end ?? start;
    const archived = archiveEvent({
      key: `streameth:${event._id}`,
      slug,
      name: event.name,
      start,
      end: end < start ? start : end,
      city: event.location || null,
      description: event.description?.trim() || null,
      imageUrl: usableImage(event.eventCover) ?? usableImage(event.banner) ?? null,
      channelSlug: org.slug,
      channelName: org.name,
      videoIds,
    });
    taken.add(archived.href!);
    events.push(archived);
    if (group) groupHref.set(`${org.slug}/${group.slug}`, archived.href!);
  }

  for (const entry of getDirectory()) {
    const org = getOrganization(entry.slug);
    const channelName = org?.name ?? entry.name;
    const streamethNames = org ? listEventsForOrg(org._id).map((e) => e.name) : [];
    const editions = calendar.filter((e) => e.channelSlug === entry.slug && e.href);
    for (const group of groupsByChannel.get(entry.slug) ?? []) {
      const key = `${entry.slug}/${group.slug}`;
      if (groupHref.has(key) || findMatchingEventName(group.label, streamethNames)) continue;
      const days = groupDays(group);
      if (!days) continue;
      // Mostly uploaded during an edition's coverage window — or named after
      // it and uploaded in the run-up (trailers, speaker announcements).
      const mostlyWithin = (from: number, to: number) =>
        days.times.filter((t) => t >= from && t < to).length * 2 > days.times.length;
      const edition =
        editions.find((e) => mostlyWithin(coverageSpan(e).from, coverageSpan(e).to)) ??
        editions.find(
          (e) =>
            findMatchingEventName(group.label, [e.name]) &&
            mostlyWithin(e.from - RUN_UP_DAYS * DAY, coverageSpan(e).to)
        );
      if (edition) {
        groupHref.set(key, edition.href!);
        const thumb = group.videos.find((v) => v.thumbnail)?.thumbnail;
        if (thumb && !editionCover.has(edition.key)) editionCover.set(edition.key, thumb);
        continue;
      }
      // A one-off upload or two isn't an event; it keeps its old page.
      if (group.videos.length < MIN_GROUP_VIDEOS) continue;
      const slug = taken.has(`/${entry.slug}/${group.slug}`) ? `${group.slug}-videos` : group.slug;
      const archived = archiveEvent({
        key: `youtube:${key}`,
        slug,
        name: group.label,
        start: days.start,
        end: days.end,
        city: null,
        description: null,
        imageUrl: null,
        channelSlug: entry.slug,
        channelName,
        videoIds: group.videos.map((v) => `yt-${v.videoId}`),
      });
      taken.add(archived.href!);
      events.push(archived);
      groupHref.set(key, archived.href!);
    }
  }

  return { events, groupHref, editionCover };
});

/** Calendar events and archive events: everything with a coverage page. */
function allCoverageEvents(): SeasonEvent[] {
  return [...getAllSeasonEvents(), ...getArchive().events];
}

/** Every event with a coverage page — calendar and archive — most recent
 * first (by end date; upcoming ones first of all). For pickers. */
export function listCoverageEvents(): SeasonEvent[] {
  return allCoverageEvents()
    .filter((e) => e.href)
    .sort((a, b) => b.to - a.to);
}

/** The coverage page that a channel's YouTube event group (the old
 * /<channel>/y/<group> page) now lives at. */
export function youtubeGroupHref(channelSlug: string, groupSlug: string): string | undefined {
  return getArchive().groupHref.get(`${channelSlug}/${groupSlug}`);
}

export function getSeasonEvent(key: string): SeasonEvent | undefined {
  return allCoverageEvents().find((e) => e.key === key);
}

/** The same channel's most recent earlier event that has recordings —
 * what an upcoming event's page shows while there's nothing new yet. */
export function previousEdition(event: SeasonEvent): SeasonEvent | undefined {
  if (!event.channelSlug) return undefined;
  return allCoverageEvents()
    .filter((e) => e.channelSlug === event.channelSlug && e.to <= event.from)
    .sort((a, b) => b.to - a.to)
    .find(hasCoverage);
}

/** The event at /<channelSlug>/<eventSlug>. */
export function getSeasonEventByPath(channelSlug: string, eventSlug: string): SeasonEvent | undefined {
  return allCoverageEvents().find((e) => e.channelSlug === channelSlug && e.slug === eventSlug);
}

/** Live events worth a full block: ones with recordings or a talk
 * schedule to show. A month-long residency with nothing recorded is still
 * "on", but there's no coverage to lead with. */
function hasLiveCoverage(event: SeasonEvent): boolean {
  return event.hasSchedule || hasCoverage(event);
}

/** What leads the homepage. `featured`: live events with coverage, or —
 * when none has any — the most recently finished covered event and the
 * next covered one. `alsoLive`: events on now with nothing to show yet. */
export function liveAndLatest(
  now = Date.now(),
  limit = 3
): { featured: SeasonEvent[]; alsoLive: SeasonEvent[] } {
  const season = listSeasonEvents(now);
  const live = season.filter((e) => statusOf(e, now) === "live");
  const featuredLive = live.filter(hasLiveCoverage);
  const alsoLive = live.filter((e) => !featuredLive.includes(e));
  if (featuredLive.length > 0) return { featured: featuredLive.slice(0, limit), alsoLive };
  const covered = season.filter((e) => e.channelSlug);
  const latest = covered.filter((e) => e.to <= now && hasCoverage(e)).sort((a, b) => b.to - a.to)[0];
  const next = covered.find((e) => e.from > now);
  return { featured: [latest, next].filter((e): e is SeasonEvent => Boolean(e)), alsoLive };
}

/** Events starting after `now`, soonest first. */
export function upcomingEvents(now = Date.now(), limit = 8): SeasonEvent[] {
  return listSeasonEvents(now)
    .filter((e) => e.from > now)
    .slice(0, limit);
}

/** The next event with a coverage page, else the next event at all. */
export function featuredUpcoming(now = Date.now()): SeasonEvent | undefined {
  const coming = listSeasonEvents(now).filter((e) => e.from > now);
  return coming.find((e) => e.href) ?? coming[0];
}

/** Finished events with a coverage page and recordings, most recent first:
 * calendar events only, or archive events too. Checks recordings
 * newest-first and stops at `limit`, since the archive goes back years. */
export function pastCoverage(now = Date.now(), limit = 4, include: "calendar" | "all" = "all"): SeasonEvent[] {
  const finished = (include === "calendar" ? getAllSeasonEvents() : allCoverageEvents())
    .filter((e) => e.href && (e.videoIds ? statusOf(e, now) !== "upcoming" : e.to <= now))
    .sort((a, b) => b.to - a.to);
  const out: SeasonEvent[] = [];
  for (const e of finished) {
    if (out.length >= limit) break;
    if (hasCoverage(e)) out.push(e);
  }
  return out;
}

/** The event's own image, else a thumbnail from uploads under its name
 * (trailers before it starts), else its newest recording's cover. Never
 * another edition's: a past event's picture on an upcoming one misleads. */
export function eventCover(event: SeasonEvent): string | null {
  return (
    event.imageUrl ??
    getArchive().editionCover.get(event.key) ??
    eventCoverage(event, 10).find((v) => v.coverImage)?.coverImage ??
    null
  );
}

/** Every edition of a channel on the calendar, past and future, newest
 * first — the channel page's list. */
export function allEventsForChannel(slug: string): SeasonEvent[] {
  return getAllSeasonEvents()
    .filter((e) => e.channelSlug === slug)
    .sort((a, b) => b.from - a.from);
}

/** Whether a recording falls inside an edition's coverage window. */
export function inCoverageWindow(event: SeasonEvent, publishedAt: number): boolean {
  return inCoverage(event, publishedAt);
}

/** A channel's editions within the season (current and next first). */
export function seasonEventsForChannel(slug: string, now = Date.now()): SeasonEvent[] {
  return getAllSeasonEvents()
    .filter((e) => e.channelSlug === slug && e.to + COVERAGE_TAIL_DAYS * DAY >= now - SEASON_BACK_DAYS * DAY)
    .sort((a, b) => a.from - b.from);
}

/** The edition a channel's coverage page leads with: live now, else the next
 * one coming up, else the most recent. */
export function currentEditionForChannel(slug: string, now = Date.now()): SeasonEvent | undefined {
  const editions = seasonEventsForChannel(slug, now);
  return (
    editions.find((e) => statusOf(e, now) === "live") ??
    editions.find((e) => e.from > now) ??
    [...editions].reverse().find((e) => e.to <= now)
  );
}

function coverageSpan(event: SeasonEvent): { from: number; to: number } {
  // A day early: some channels post a teaser or the first stream the evening
  // before.
  return { from: event.from - DAY, to: event.to + COVERAGE_TAIL_DAYS * DAY };
}

/** The event's recordings so far, newest first: its channel's uploads from
 * the day before it starts until COVERAGE_TAIL_DAYS after it ends. */
export function eventCoverage(event: SeasonEvent, limit = 500): UnifiedVideo[] {
  if (event.videoIds) return archiveVideos(event).slice(0, limit);
  if (!event.channelSlug) return [];
  const { from, to } = coverageSpan(event);
  return channelVideosBetween([event.channelSlug], from, to, limit);
}

// Ids per query, well under SQLite's bound-parameter limit.
const ID_BATCH = 500;
const archiveVideoCache = new Map<string, UnifiedVideo[]>();

/** An archive event's recordings, newest first. */
function archiveVideos(event: SeasonEvent): UnifiedVideo[] {
  const cached = archiveVideoCache.get(event.key);
  if (cached) return cached;
  const ids = event.videoIds ?? [];
  const videos: UnifiedVideo[] = [];
  for (let i = 0; i < ids.length; i += ID_BATCH) videos.push(...getVideosByIds(ids.slice(i, i + ID_BATCH)));
  videos.sort((a, b) => b.publishedAt - a.publishedAt);
  archiveVideoCache.set(event.key, videos);
  return videos;
}

export function eventFormatCounts(event: SeasonEvent): Record<VideoFormat, number> {
  if (event.videoIds) {
    const counts: Record<VideoFormat, number> = { talk: 0, clip: 0, short: 0, stream: 0 };
    for (const v of archiveVideos(event)) counts[v.format] += 1;
    return counts;
  }
  const { from, to } = coverageSpan(event);
  return countFormatsBetween(event.channelSlug ? [event.channelSlug] : [], from, to);
}

function hasCoverage(event: SeasonEvent): boolean {
  const c = eventFormatCounts(event);
  return c.talk + c.clip + c.short + c.stream > 0;
}

/** The channel's stream that was on air at the last pull, if the event is
 * live. */
export function liveStreamFor(event: SeasonEvent, now = Date.now()): UnifiedVideo | undefined {
  if (!event.channelSlug || event.videoIds || statusOf(event, now) !== "live") return undefined;
  return liveStreamForChannel(event.channelSlug);
}

export function getSchedule(event: SeasonEvent): EventSchedule | undefined {
  return getSchedules()[event.name];
}

/** Talks on stage at `now`, one per room, by room name. */
export function nowOnStage(event: SeasonEvent, now = Date.now()): ScheduledSession[] {
  const schedule = getSchedule(event);
  if (!schedule) return [];
  return schedule.sessions.filter((s) => s.start <= now && now < s.end);
}

/** The next talks to start, soonest first. */
export function upNext(event: SeasonEvent, now = Date.now(), limit = 6): ScheduledSession[] {
  const schedule = getSchedule(event);
  if (!schedule) return [];
  return schedule.sessions.filter((s) => s.start > now).slice(0, limit);
}

/** Side events in the same Mira series (e.g. Devcon 8's), by start. */
export function sideEventsFor(event: SeasonEvent): MiraEvent[] {
  if (!event.seriesSlug) return [];
  const series = event.seriesSlug.replace(/^\//, "");
  return listMiraEvents()
    .filter((e) => e.kind === "side" && e.seriesSlug?.replace(/^\//, "") === series)
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

export function eventDay(event: SeasonEvent, at = Date.now()): number {
  return eventDayNumber(event, at);
}

/** "Nov 3–6, 2026" / "Oct 31 – Nov 2, 2026" / "Dec 1, 2026". */
export function formatEventDates(event: Pick<SeasonEvent, "start" | "end">): string {
  const start = new Date(`${event.start}T12:00:00Z`);
  const end = new Date(`${event.end}T12:00:00Z`);
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const day = (d: Date) => d.getUTCDate();
  const year = end.getUTCFullYear();
  if (event.start === event.end) return `${month(start)} ${day(start)}, ${year}`;
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${month(start)} ${day(start)}–${day(end)}, ${year}`;
  }
  return `${month(start)} ${day(start)} – ${month(end)} ${day(end)}, ${year}`;
}

/** "Starts in 10 days" / "Starts tomorrow" / "Day 2 of 4" / "Ended 3 days ago". */
export function statusLine(event: SeasonEvent, now = Date.now()): string {
  const status = statusOf(event, now);
  if (status === "live") {
    const total = Math.round((event.to - event.from) / DAY);
    return total > 1 ? `Day ${eventDay(event, now)} of ${total}` : "Today";
  }
  if (status === "upcoming") {
    const days = Math.ceil((event.from - now) / DAY);
    return days <= 1 ? "Starts tomorrow" : `Starts in ${days} days`;
  }
  const days = Math.floor((now - event.to) / DAY);
  return days < 1 ? "Ended today" : days === 1 ? "Ended yesterday" : `Ended ${days} days ago`;
}

const getChannelIds = lazy((): Record<string, string> => {
  const path = join(process.cwd(), "data", "sources", "youtube-channel-ids.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, string>;
  } catch {
    return {};
  }
});

/** The YouTube channel id (UC…) of a directory channel, when pulled. */
export function youtubeChannelId(slug: string): string | null {
  return getChannelIds()[slug] ?? null;
}

export interface EventSpeaker {
  name: string;
  avatar: string | null;
  bio: string | null;
  twitter: string | null;
  /** Their slots on this event's schedule, soonest first. */
  sessions: ScheduledSession[];
  /** Their recordings from this event. */
  videos: UnifiedVideo[];
}

/** Everyone speaking at the event: from its schedule (with photo, bio and
 * slots) and from the speakers matched on its recordings. Most sessions
 * first, then by name. */
export function eventSpeakers(event: SeasonEvent): EventSpeaker[] {
  const schedule = getSchedule(event);
  const byName = new Map<string, EventSpeaker>();
  const get = (name: string): EventSpeaker => {
    let speaker = byName.get(name);
    if (!speaker) {
      const profile = schedule?.speakers?.[name];
      speaker = {
        name,
        avatar: profile?.avatar ?? null,
        bio: profile?.bio ?? null,
        twitter: profile?.twitter ?? null,
        sessions: [],
        videos: [],
      };
      byName.set(name, speaker);
    }
    return speaker;
  };
  for (const session of schedule?.sessions ?? []) {
    for (const name of session.speakers) get(name).sessions.push(session);
  }
  for (const video of eventCoverage(event)) {
    for (const name of video.speakers) get(name).videos.push(video);
  }
  return [...byName.values()].sort(
    (a, b) => b.sessions.length + b.videos.length - (a.sessions.length + a.videos.length) || a.name.localeCompare(b.name)
  );
}

/** The event's schedule grouped by local day ("Tue, Nov 3"), each day's
 * sessions by start time. */
export function scheduleByDay(event: SeasonEvent): { label: string; sessions: ScheduledSession[] }[] {
  const schedule = getSchedule(event);
  if (!schedule) return [];
  const zone = event.timeZone ?? "UTC";
  const days = new Map<string, ScheduledSession[]>();
  for (const session of schedule.sessions) {
    const label = new Date(session.start).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: zone,
    });
    const list = days.get(label) ?? [];
    list.push(session);
    days.set(label, list);
  }
  return [...days.entries()].map(([label, sessions]) => ({ label, sessions }));
}
