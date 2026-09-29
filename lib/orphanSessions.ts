import "server-only";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { lazy, memoize1 } from "./lazy";
import { getStore } from "./data";
import type { Session } from "./types";
import { slugifyGroupLabel } from "./youtube";

export interface InferredSessionGroup {
  label: string;
  slug: string;
  sessions: Session[];
}

const CLUSTER_GAP_DAYS = 10;
const LEADING_SEGMENT_RE = /^([^:]{3,60}):\s*/;
// Matches a leading token like "ETHBerlin04" or "Devcon7" — letters followed
// by digits, glued together as one word (no space before the number).
const LEADING_CODE_WORD_RE = /^([A-Za-z]+\d+)\b/;

function majorityKey(counts: Map<string, number>, total: number): string | null {
  for (const [key, count] of counts) {
    if (count >= Math.ceil(total / 2) && count > 1) return key;
  }
  return null;
}

function commonPrefix(sessions: Session[]): string | null {
  const colonCounts = new Map<string, number>();
  const codeWordCounts = new Map<string, number>();
  for (const s of sessions) {
    const colon = s.name?.match(LEADING_SEGMENT_RE);
    if (colon) {
      const key = colon[1].trim();
      colonCounts.set(key, (colonCounts.get(key) ?? 0) + 1);
    }
    const codeWord = s.name?.match(LEADING_CODE_WORD_RE);
    if (codeWord) {
      codeWordCounts.set(codeWord[1], (codeWordCounts.get(codeWord[1]) ?? 0) + 1);
    }
  }
  return (
    majorityKey(colonCounts, sessions.length) ??
    majorityKey(codeWordCounts, sessions.length)
  );
}

interface ClassifiedGroup {
  label: string;
  sessionIds: string[];
}

const getSessionGroupClassification = lazy((): Record<string, ClassifiedGroup[]> => {
  const path = join(process.cwd(), "data", "sources", "session-event-groups.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, ClassifiedGroup[]>;
  } catch {
    return {};
  }
});

function formatDateRange(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: withYear ? "numeric" : undefined,
    });
  if (start.toDateString() === end.toDateString()) return fmt(start, true);
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${fmt(start, !sameYear)} – ${fmt(end, true)}`;
}

/**
 * Sessions whose eventId points at a document that no longer exists in the
 * events collection (a real, recurring gap in the source DB — see
 * scripts/remote-export.mjs) have no real event to group under. Which
 * real-world event they belong to is classified once per org (an LLM reads
 * each org's session titles and assigns real event names — see the
 * classify-batch-* agents that produced
 * data/sources/session-event-groups.json), same approach as the YouTube
 * grouping in ./youtube. When an org hasn't been classified yet, fall back to
 * clustering by start-time proximity and common title prefix so the page
 * still works, not as a claim about event identity.
 */
// A handful of sessions carry a tiny non-zero `start` (e.g. 25827) that's a
// relative clip offset in milliseconds, not an absolute date — treat
// anything before Ethereum's own 2015 launch as not a real timestamp.
const MIN_VALID_START = new Date("2015-01-01").getTime();

function clusterByHeuristic(
  sessions: Session[],
  orgName: string
): InferredSessionGroup[] {
  const dated = sessions.filter((s) => s.start >= MIN_VALID_START);
  const undated = sessions.filter((s) => s.start < MIN_VALID_START);

  const sorted = [...dated].sort((a, b) => a.start - b.start);
  const clusters: Session[][] = [];
  let current: Session[] = [];
  let prevTime: number | null = null;

  for (const s of sorted) {
    if (prevTime !== null && (s.start - prevTime) / 86_400_000 > CLUSTER_GAP_DAYS) {
      clusters.push(current);
      current = [];
    }
    current.push(s);
    prevTime = s.start;
  }
  if (current.length > 0) clusters.push(current);

  const groups: InferredSessionGroup[] = clusters.map((cluster) => {
    const label =
      commonPrefix(cluster) ??
      formatDateRange(cluster[0].start, cluster[cluster.length - 1].start);
    return {
      label,
      slug: slugifyGroupLabel(label),
      sessions: [...cluster].reverse(),
    };
  });
  groups.reverse();

  if (undated.length > 0) {
    const label = commonPrefix(undated) ?? `${orgName} sessions`;
    groups.push({ label, slug: slugifyGroupLabel(label), sessions: undated });
  }

  const seen = new Map<string, number>();
  for (const g of groups) {
    const base = g.slug;
    const count = seen.get(base) ?? 0;
    if (count > 0) g.slug = `${base}-${count + 1}`;
    seen.set(base, count + 1);
  }

  return groups;
}

/**
 * Classification only covers the session IDs that existed at the time an org
 * was classified — a later re-export (e.g. widening the DB filter to include
 * `published: "private"` sessions) can add orphan sessions the classification
 * has never seen. Those must still show up somewhere, clustered by the
 * heuristic, rather than silently vanishing because they're absent from a
 * stale classification list.
 */
export function groupSessionsByInferredEvent(
  sessions: Session[],
  orgSlug: string,
  orgName: string
): InferredSessionGroup[] {
  const classified = getSessionGroupClassification()[orgSlug];

  let groups: InferredSessionGroup[];
  if (classified && classified.length > 0) {
    const byId = new Map(sessions.map((s) => [s._id, s]));
    const classifiedIds = new Set<string>();
    const classifiedGroups: InferredSessionGroup[] = classified
      .map((g) => {
        const groupSessions = g.sessionIds
          .map((id) => byId.get(id))
          .filter((s): s is Session => Boolean(s))
          .sort((a, b) => b.start - a.start);
        for (const s of groupSessions) classifiedIds.add(s._id);
        return { label: g.label, slug: slugifyGroupLabel(g.label), sessions: groupSessions };
      })
      .filter((g) => g.sessions.length > 0);

    const leftover = sessions.filter((s) => !classifiedIds.has(s._id));
    const leftoverGroups = leftover.length > 0 ? clusterByHeuristic(leftover, orgName) : [];

    groups = [...classifiedGroups, ...leftoverGroups];
  } else {
    groups = clusterByHeuristic(sessions, orgName);
  }

  const latestTime = (g: InferredSessionGroup) =>
    Math.max(0, ...g.sessions.map((s) => s.start));
  groups.sort((a, b) => latestTime(b) - latestTime(a));

  const seen = new Map<string, number>();
  for (const g of groups) {
    const base = g.slug;
    const count = seen.get(base) ?? 0;
    if (count > 0) g.slug = `${base}-${count + 1}`;
    seen.set(base, count + 1);
  }

  return groups;
}

export const getOrphanSessionsForOrg = memoize1((orgId: string): Session[] => {
  // getStore().sessions is already filtered to sessions with a real,
  // public video (see HAS_VIDEO in lib/data.ts) — private/failed/pending
  // clips never reach here.
  const { sessions, eventById } = getStore();
  return sessions.filter(
    (s) => s.organizationId === orgId && !eventById.has(s.eventId)
  );
});

export function getInferredSessionGroup(
  orgId: string,
  orgSlug: string,
  orgName: string,
  groupSlug: string
): InferredSessionGroup | undefined {
  const groups = groupSessionsByInferredEvent(
    getOrphanSessionsForOrg(orgId),
    orgSlug,
    orgName
  );
  return groups.find((g) => g.slug === groupSlug);
}
