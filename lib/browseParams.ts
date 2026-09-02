import type { Session } from "./types";

export type SortMode = "relevance" | "newest" | "oldest" | "duration_desc" | "duration_asc";
export type DurationBucket = "short" | "medium" | "long";

export interface BrowseFilters {
  q: string;
  /** Organization `_id`s (not slugs) to restrict results to. */
  orgIds: string[];
  /** Event `_id`s to restrict results to. */
  eventIds: string[];
  speaker: string;
  topic: string;
  duration: DurationBucket | "";
  dateFrom: string;
  dateTo: string;
  sort: SortMode;
}

export const EMPTY_FILTERS: BrowseFilters = {
  q: "",
  orgIds: [],
  eventIds: [],
  speaker: "",
  topic: "",
  duration: "",
  dateFrom: "",
  dateTo: "",
  sort: "newest",
};

const SORT_MODES: SortMode[] = ["relevance", "newest", "oldest", "duration_desc", "duration_asc"];
const DURATION_BUCKETS: DurationBucket[] = ["short", "medium", "long"];

export function getSessionDurationSeconds(session: Session): number | undefined {
  if (session.playback?.duration) return session.playback.duration;
  if (session.start && session.end && session.end > session.start) {
    return (session.end - session.start) / 1000;
  }
  return undefined;
}

export function durationBucket(seconds: number | undefined): DurationBucket | undefined {
  if (seconds === undefined) return undefined;
  if (seconds < 4 * 60) return "short";
  if (seconds <= 20 * 60) return "medium";
  return "long";
}

export function filtersFromParams(params: URLSearchParams): BrowseFilters {
  const orgIds = params.get("org")?.split(",").filter(Boolean) ?? [];
  const eventIds = params.get("event")?.split(",").filter(Boolean) ?? [];
  const sortParam = params.get("sort");
  const durationParam = params.get("duration");
  const q = params.get("q") ?? "";
  return {
    ...EMPTY_FILTERS,
    q,
    orgIds,
    eventIds,
    speaker: params.get("speaker") ?? "",
    topic: params.get("topic") ?? "",
    duration: DURATION_BUCKETS.includes(durationParam as DurationBucket)
      ? (durationParam as DurationBucket)
      : "",
    dateFrom: params.get("from") ?? "",
    dateTo: params.get("to") ?? "",
    sort: SORT_MODES.includes(sortParam as SortMode)
      ? (sortParam as SortMode)
      : q
      ? "relevance"
      : "newest",
  };
}

export function paramsFromFilters(filters: BrowseFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.orgIds.length) params.set("org", filters.orgIds.join(","));
  if (filters.eventIds.length) params.set("event", filters.eventIds.join(","));
  if (filters.speaker) params.set("speaker", filters.speaker);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.duration) params.set("duration", filters.duration);
  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo) params.set("to", filters.dateTo);
  if (filters.sort && filters.sort !== (filters.q ? "relevance" : "newest")) {
    params.set("sort", filters.sort);
  }
  return params;
}
