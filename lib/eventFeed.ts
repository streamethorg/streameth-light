import "server-only";
import { eventCoverage, getSchedule, statusOf, type ScheduledSession, type SeasonEvent } from "./season";
import { listStoriesForEvents, visibleOn, type Story } from "./stories";
import { listEmbedsForEvents, type Embed } from "./embeds";
import type { UnifiedVideo } from "./videoDb";

const DAY = 24 * 60 * 60 * 1000;

export type FeedItem =
  | { kind: "story"; at: number; story: Story }
  | { kind: "embed"; at: number; embed: Embed }
  | { kind: "session"; at: number; session: ScheduledSession }
  | { kind: "video"; at: number; video: UnifiedVideo; dayOnly: boolean };

/** The event's live feed, newest first: stories as they're published,
 * media reporters add by link, talks as they start on stage (from the
 * schedule), and recordings as they're uploaded. YouTube listings often
 * only carry the upload day, not the time; those items are marked
 * `dayOnly`. */
export async function eventFeed(event: SeasonEvent, now: number, limit = 120): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  for (const story of await listStoriesForEvents([event.key], 50)) {
    if (!visibleOn(story.reporter?.trust, "event")) continue;
    items.push({ kind: "story", at: Date.parse(story.writtenAt), story });
  }

  for (const embed of await listEmbedsForEvents([event.key], 100)) {
    if (!visibleOn(embed.reporter.trust, "event")) continue;
    items.push({ kind: "embed", at: Date.parse(embed.createdAt), embed });
  }

  if (statusOf(event, now) !== "upcoming") {
    for (const session of getSchedule(event)?.sessions ?? []) {
      if (session.start <= now) items.push({ kind: "session", at: session.start, session });
    }
  }

  for (const video of eventCoverage(event, 500)) {
    if (video.liveStatus === "is_upcoming" || video.publishedAt > now) continue;
    items.push({ kind: "video", at: video.publishedAt, video, dayOnly: video.publishedAt % DAY === 0 });
  }

  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}
