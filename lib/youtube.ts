import "server-only";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { lazy } from "./lazy";
import type { YoutubeVideo } from "./directory";

export interface YoutubeVideoWithChannel extends YoutubeVideo {
  channelSlug: string;
}

export function getYoutubeVideosForChannel(slug: string): YoutubeVideo[] {
  const raw = readFileSync(
    join(process.cwd(), "data", "sources", "youtube-videos.json"),
    "utf-8"
  );
  const bySlug = JSON.parse(raw) as Record<string, YoutubeVideo[]>;
  return bySlug[slug] ?? [];
}

export interface InferredEventGroup {
  label: string;
  slug: string;
  videos: YoutubeVideo[];
}

export function slugifyGroupLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "event"
  );
}

interface ClassifiedGroup {
  label: string;
  videoIds: string[];
}

const getEventGroupClassification = lazy((): Record<string, ClassifiedGroup[]> => {
  const path = join(process.cwd(), "data", "sources", "youtube-event-groups.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, ClassifiedGroup[]>;
  } catch {
    return {};
  }
});

/**
 * Which real-world event a video belongs to isn't derivable from title
 * structure alone — uploaders don't follow a consistent "Event: Talk" or
 * "Talk | Event" pattern, and a name can appear anywhere in a title or not
 * at all. This is classified once per channel (an LLM reads each channel's
 * real titles and assigns real event names — see the classify-batch-*
 * agents that produced data/sources/youtube-event-groups.json) rather than
 * inferred at request time by a regex or word-frequency heuristic, which
 * proved unreliable (e.g. it mislabeled 14 "Protocol Berg v2: ..." videos as
 * "Storage" because "protocol"/"berg" appeared in literally every title and
 * got excluded as "too common to be a signal").
 */
export function groupVideosByInferredEvent(
  videos: YoutubeVideo[],
  channelSlug: string
): InferredEventGroup[] {
  const byId = new Map(videos.map((v) => [v.videoId, v]));
  const classified = getEventGroupClassification()[channelSlug];

  let groups: InferredEventGroup[];
  if (classified && classified.length > 0) {
    groups = classified
      .map((g) => {
        const groupVideos = g.videoIds
          .map((id) => byId.get(id))
          .filter((v): v is YoutubeVideo => Boolean(v))
          .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
        return { label: g.label, slug: slugifyGroupLabel(g.label), videos: groupVideos };
      })
      .filter((g) => g.videos.length > 0);
  } else if (videos.length <= 1) {
    groups = videos.map((v) => ({
      label: v.title || "Video",
      slug: slugifyGroupLabel(v.title || v.videoId),
      videos: [v],
    }));
  } else {
    // Not yet classified (e.g. a channel added after the classification
    // pass ran) — safe fallback so the page still works, not a claim about
    // event identity.
    groups = [{ label: "Recent uploads", slug: "recent-uploads", videos }];
  }

  const latestTime = (g: InferredEventGroup) =>
    Math.max(0, ...g.videos.map((v) => (v.publishedAt ? new Date(v.publishedAt).getTime() : 0)));
  groups.sort((a, b) => latestTime(b) - latestTime(a));

  const seen = new Map<string, number>();
  for (const g of groups) {
    const baseSlug = g.slug;
    const count = seen.get(baseSlug) ?? 0;
    if (count > 0) g.slug = `${baseSlug}-${count + 1}`;
    seen.set(baseSlug, count + 1);
  }

  return groups;
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bv\d+\b/g, "") // "Protocol Berg v2" vs "Protocol Berg"
    .replace(/[^a-z0-9]/g, "");
}

/**
 * An inferred YouTube group and a real StreamETH event can be the same
 * real-world conference (e.g. "Protocol Berg v2: ..." video titles vs. the
 * StreamETH event named "Protocol Berg") — match by normalized substring so
 * the org page can merge them into one tile instead of showing the same
 * event twice under different names.
 */
export function findMatchingEventName(
  groupLabel: string,
  eventNames: string[]
): string | undefined {
  const normGroup = normalizeForMatch(groupLabel);
  if (normGroup.length < 4) return undefined;
  return eventNames.find((name) => {
    const normEvent = normalizeForMatch(name);
    return (
      normEvent.length >= 4 &&
      (normGroup.includes(normEvent) || normEvent.includes(normGroup))
    );
  });
}

export function getInferredEventGroup(
  channelSlug: string,
  groupSlug: string
): InferredEventGroup | undefined {
  const groups = groupVideosByInferredEvent(getYoutubeVideosForChannel(channelSlug), channelSlug);
  return groups.find((g) => g.slug === groupSlug);
}
