import "server-only";
import { lazy } from "./lazy";
import {
  getOrganization,
  getOrganizationById,
  listAllEvents,
  listEventsForOrg,
  listSessionsForEvent,
  usableImage,
} from "./data";
import { getDirectory, getDirectoryEntry } from "./directory";
import {
  findMatchingEventName,
  getYoutubeVideosForChannel,
  groupVideosByInferredEvent,
} from "./youtube";

/** One event across both sources — a StreamETH event, or an event inferred
 * from a channel's YouTube uploads — normalized for listing. */
export interface EventSummary {
  key: string;
  name: string;
  href: string;
  channelName: string;
  channelHref: string;
  cover: string | null;
  talkCount: number;
  /** Newest talk (YouTube groups) or event start (StreamETH), ms. */
  latest: number;
  location?: string;
}

// Groups under this size are usually a one-off upload or a teaser, not an
// event with a program worth surfacing as "new".
const MIN_TALKS = 3;
// The unclassified-channel fallback in groupVideosByInferredEvent — a
// catch-all bucket, not an event.
const FALLBACK_LABEL = "Recent uploads";

const getAllEventSummaries = lazy((): EventSummary[] => {
  const summaries: EventSummary[] = [];

  for (const event of listAllEvents()) {
    const org = getOrganizationById(event.organizationId);
    if (!org) continue;
    const sessions = listSessionsForEvent(event._id);
    if (sessions.length < MIN_TALKS) continue;
    const start = new Date(event.start).getTime();
    summaries.push({
      key: `streameth:${event._id}`,
      name: event.name,
      href: `/${org.slug}/${event.slug}`,
      channelName: org.name,
      channelHref: `/${org.slug}`,
      cover:
        usableImage(event.eventCover) ??
        usableImage(event.banner) ??
        sessions.find((s) => s.coverImage)?.coverImage ??
        null,
      talkCount: sessions.length,
      latest: Number.isFinite(start) ? start : 0,
      location: event.location,
    });
  }

  for (const entry of getDirectory()) {
    const videos = getYoutubeVideosForChannel(entry.slug);
    if (videos.length === 0) continue;
    const org = getOrganization(entry.slug);
    const channelName = org?.name ?? getDirectoryEntry(entry.slug)?.name ?? entry.name;
    // Same rule as the channel page: a YouTube group that matches one of the
    // org's StreamETH events is that event, already listed above.
    const streamethEventNames = org ? listEventsForOrg(org._id).map((e) => e.name) : [];
    for (const group of groupVideosByInferredEvent(videos, entry.slug)) {
      if (group.label === FALLBACK_LABEL || group.videos.length < MIN_TALKS) continue;
      if (findMatchingEventName(group.label, streamethEventNames)) continue;
      const newest = group.videos[0];
      summaries.push({
        key: `youtube:${entry.slug}:${group.slug}`,
        name: group.label,
        href: `/${entry.slug}/y/${group.slug}`,
        channelName,
        channelHref: `/${entry.slug}`,
        cover: group.videos.find((v) => v.thumbnail)?.thumbnail ?? null,
        talkCount: group.videos.length,
        latest: newest.publishedAt ? new Date(newest.publishedAt).getTime() : 0,
      });
    }
  }

  // Channels that share one YouTube account (e.g. ETHGlobal and its Pragma
  // series) produce the same event twice — keep the first (newest) copy.
  const seen = new Set<string>();
  return summaries
    .sort((a, b) => b.latest - a.latest)
    .filter((e) => {
      const key = e.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
});

/** Events with the most recently published talks first. */
export function listRecentEvents(limit?: number): EventSummary[] {
  const all = getAllEventSummaries();
  return limit === undefined ? all : all.slice(0, limit);
}
