import "server-only";
import {
  eventCoverage,
  listSeasonEvents,
  statusOf,
  type SeasonEvent,
} from "./season";
import { listStoriesForEvents, type Story } from "./stories";
import type { UnifiedVideo } from "./videoDb";

const DAY = 24 * 60 * 60 * 1000;

/** Below this many transcribed talks a day report reads thin; the coverage
 * page shows the uploads instead. */
export const MIN_TALKS_FOR_DAY_REPORT = 4;
/** Previews are written in the week before an event. */
export const PREVIEW_WINDOW_DAYS = 7;

/** The event key a day report carries alongside the event's own key. */
export function dayKey(eventKey: string, day: number): string {
  return `${eventKey}:day-${day}`;
}

export function eventDayCount(event: SeasonEvent): number {
  return Math.max(1, Math.round((event.to - event.from) / DAY));
}

/** An event's coverage by local day: day n holds the videos published
 * during that day of the event. Uploads after the event are left out — they
 * belong to the recap. */
export function coverageByDay(event: SeasonEvent): { day: number; videos: UnifiedVideo[] }[] {
  const videos = eventCoverage(event);
  const days = eventDayCount(event);
  return Array.from({ length: days }, (_, i) => {
    const from = event.from + i * DAY;
    const to = from + DAY;
    return { day: i + 1, videos: videos.filter((v) => v.publishedAt >= from && v.publishedAt < to) };
  });
}

export interface CoverageGap {
  eventKey: string;
  eventName: string;
  kind: "day" | "recap" | "preview";
  /** Day reports only. */
  day?: number;
  /** The event keys the story should carry. */
  eventKeys: string[];
  /** Transcribed talks to write from (empty for previews, which use the
   * schedule and earlier talks by the same speakers). */
  videoIds: string[];
  why: string;
}

function hasStory(stories: Story[], kind: Story["kind"], key: string): boolean {
  return stories.some((s) => s.kind === kind && s.eventKeys.includes(key));
}

/** What's newsworthy but not yet written up: day reports for event days with
 * enough transcribed talks, recaps for events that ended, previews for
 * events starting within a week. The assignment desk for reporters. */
export async function coverageGaps(now = Date.now()): Promise<CoverageGap[]> {
  const events = listSeasonEvents(now).filter((e) => e.channelSlug);
  const gaps: CoverageGap[] = [];
  for (const event of events) {
    const status = statusOf(event, now);
    const stories = await listStoriesForEvents([event.key], 100);

    if (status === "upcoming") {
      if (event.from - now <= PREVIEW_WINDOW_DAYS * DAY && !hasStory(stories, "preview", event.key)) {
        gaps.push({
          eventKey: event.key,
          eventName: event.name,
          kind: "preview",
          eventKeys: [event.key],
          videoIds: [],
          why: `Starts ${new Date(event.from).toISOString().slice(0, 10)}; no preview yet.`,
        });
      }
      continue;
    }

    if (status === "live" || status === "recent") {
      for (const { day, videos } of coverageByDay(event)) {
        const transcribed = videos.filter((v) => v.hasTranscript && v.format !== "short");
        const key = dayKey(event.key, day);
        if (transcribed.length < MIN_TALKS_FOR_DAY_REPORT || hasStory(stories, "day", key)) continue;
        gaps.push({
          eventKey: event.key,
          eventName: event.name,
          kind: "day",
          day,
          eventKeys: [event.key, key],
          videoIds: transcribed.map((v) => v.id),
          why: `${transcribed.length} transcribed talks from day ${day}; no day report yet.`,
        });
      }
    }

    if (status === "recent" || status === "past") {
      const transcribed = eventCoverage(event).filter((v) => v.hasTranscript && v.format !== "short");
      if (transcribed.length >= MIN_TALKS_FOR_DAY_REPORT && !hasStory(stories, "recap", event.key)) {
        gaps.push({
          eventKey: event.key,
          eventName: event.name,
          kind: "recap",
          eventKeys: [event.key],
          videoIds: transcribed.map((v) => v.id),
          why: `Ended; ${transcribed.length} transcribed talks and no recap yet.`,
        });
      }
    }
  }
  return gaps;
}
