import "server-only";
import { readFileSync } from "fs";
import { join } from "path";
import { lazy } from "./lazy";

export interface DirectoryEntry {
  name: string;
  slug: string;
  location: string | null;
  website: string | null;
  youtubeChannel: string | null;
  youtubeConfidence: "high" | "medium" | "low" | "none";
  youtubeVideoCount: number;
  onStreamETH: boolean;
  sessionCount: number;
  sources: string[];
  miraSeriesSlug: string | null;
  miraEventCount: number;
}

export interface MiraEvent {
  id: string;
  kind: "main" | "side";
  name: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  organizer: string | null;
  tags: string[] | string | null;
  topics: string[];
  website: string | null;
  imageUrl: string | null;
  seriesSlug: string | null;
  seriesName: string | null;
}

export interface YoutubeVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string | null;
  description: string | null;
}

export const getDirectory = lazy((): DirectoryEntry[] => {
  const raw = readFileSync(join(process.cwd(), "data", "directory.json"), "utf-8");
  return (JSON.parse(raw) as { entries: DirectoryEntry[] }).entries;
});

export function getDirectoryEntry(slug: string): DirectoryEntry | undefined {
  return getDirectory().find((e) => e.slug === slug);
}

const getMiraEvents = lazy((): MiraEvent[] => {
  const raw = readFileSync(
    join(process.cwd(), "data", "sources", "mira-events.json"),
    "utf-8"
  );
  return (JSON.parse(raw) as { events: MiraEvent[] }).events;
});

export function getTrackedEvents(miraSeriesSlug: string | null): MiraEvent[] {
  if (!miraSeriesSlug) return [];
  const target = miraSeriesSlug.replace(/^\//, "");
  return getMiraEvents()
    .filter((e) => e.seriesSlug?.replace(/^\//, "") === target)
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}
