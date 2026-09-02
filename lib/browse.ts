import "server-only";
import { lazy } from "./lazy";
import MiniSearch from "minisearch";
import { getStore } from "./data";
import type { Session } from "./types";
import {
  type BrowseFilters,
  durationBucket,
  getSessionDurationSeconds,
} from "./browseParams";

export type { BrowseFilters, SortMode, DurationBucket } from "./browseParams";
export { EMPTY_FILTERS, getSessionDurationSeconds, durationBucket } from "./browseParams";

interface IndexedDoc {
  id: string;
  name: string;
  description: string;
  speakerText: string;
  topicText: string;
  orgName: string;
  eventName: string;
}

// Built once per server instance from the full session list — runs entirely
// during SSR, so query relevance/typo-tolerance is free of any client
// bundle cost regardless of how large data/sessions.json grows.
const getIndex = lazy((): MiniSearch<IndexedDoc> => {
  const { sessions, eventById, orgById } = getStore();

  const index = new MiniSearch<IndexedDoc>({
    idField: "id",
    fields: ["name", "description", "speakerText", "topicText", "orgName", "eventName"],
    storeFields: [],
    searchOptions: { prefix: true, fuzzy: 0.2, boost: { name: 3, speakerText: 2 } },
  });

  const docs: IndexedDoc[] = sessions.map((s) => {
    const event = eventById.get(s.eventId);
    const org = event ? orgById.get(event.organizationId) : undefined;
    return {
      id: s._id,
      name: s.name ?? "",
      description: [s.description, s.aiDescription].filter(Boolean).join(" "),
      speakerText: (s.speakers ?? [])
        .map((sp) => [sp.name, sp.company].filter(Boolean).join(" "))
        .join(" "),
      topicText: [
        ...(s.autoLabels ?? []),
        ...(Array.isArray(s.track) ? s.track : [s.track]),
        s.talkType,
      ]
        .filter(Boolean)
        .join(" "),
      orgName: org?.name ?? "",
      eventName: event?.name ?? "",
    };
  });

  index.addAll(docs);
  return index;
});

export function topAutoLabels(sessions: Session[], limit = 16): string[] {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    for (const label of s.autoLabels ?? []) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}

export function browseSessions(filters: BrowseFilters): Session[] {
  const { sessions } = getStore();

  const orgSet = new Set(filters.orgIds);
  const eventSet = new Set(filters.eventIds);
  const speaker = filters.speaker.trim().toLowerCase();
  const topic = filters.topic.trim().toLowerCase();
  const fromMs = filters.dateFrom ? new Date(filters.dateFrom).getTime() : undefined;
  const toMs = filters.dateTo ? new Date(filters.dateTo).getTime() + 24 * 60 * 60 * 1000 : undefined;

  const structural = sessions.filter((s) => {
    if (orgSet.size > 0 && !orgSet.has(s.organizationId)) return false;
    if (eventSet.size > 0 && !eventSet.has(s.eventId)) return false;
    if (speaker && !(s.speakers ?? []).some((sp) => sp.name?.toLowerCase() === speaker)) {
      return false;
    }
    if (topic && !(s.autoLabels ?? []).some((l) => l.toLowerCase() === topic)) {
      return false;
    }
    if (filters.duration) {
      const bucket = durationBucket(getSessionDurationSeconds(s));
      if (bucket !== filters.duration) return false;
    }
    if (fromMs !== undefined && s.start < fromMs) return false;
    if (toMs !== undefined && s.start >= toMs) return false;
    return true;
  });

  const q = filters.q.trim();
  if (!q) {
    return sortSessions(structural, filters.sort === "relevance" ? "newest" : filters.sort);
  }

  const allowedIds = new Set(structural.map((s) => s._id));
  const results = getIndex().search(q, {
    filter: (doc) => allowedIds.has(doc.id as string),
  });
  const byId = new Map(structural.map((s) => [s._id, s]));
  const ranked = results
    .map((r) => byId.get(r.id as string))
    .filter((s): s is Session => Boolean(s));

  if (filters.sort === "relevance" || !filters.sort) return ranked;
  return sortSessions(ranked, filters.sort);
}

function sortSessions(sessions: Session[], sort: BrowseFilters["sort"]): Session[] {
  const copy = [...sessions];
  switch (sort) {
    case "oldest":
      return copy.sort((a, b) => a.start - b.start);
    case "duration_desc":
      return copy.sort(
        (a, b) => (getSessionDurationSeconds(b) ?? 0) - (getSessionDurationSeconds(a) ?? 0)
      );
    case "duration_asc":
      return copy.sort(
        (a, b) => (getSessionDurationSeconds(a) ?? 0) - (getSessionDurationSeconds(b) ?? 0)
      );
    case "newest":
    case "relevance":
    default:
      return copy.sort((a, b) => b.start - a.start);
  }
}
