// The season's events built from the committed data files, for scripts that
// run outside Next (the hourly live job, the story writer). Same inputs and
// same builder (lib/seasonCore.mjs) as lib/season.ts, so both agree on what
// is live.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildSeasonEvents } from "../lib/seasonCore.mjs";

const DATA_DIR = join(process.cwd(), "data");

function readJson(...parts) {
  const path = join(DATA_DIR, ...parts);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

// Read out of lib/curation.ts (plain node can't import the .ts file) rather
// than copied by hand like scripts/build-db.mjs's list, so it can't drift.
const HIDDEN_ORG_SLUGS = new Set(
  readFileSync(join(process.cwd(), "lib", "curation.ts"), "utf-8")
    .match(/HIDDEN_ORG_SLUGS[^[]*\[([^\]]*)\]/)?.[1]
    .match(/"([^"]+)"/g)
    ?.map((s) => s.slice(1, -1)) ?? []
);

export function loadSeasonEvents() {
  const directory = readJson("directory.json").entries.filter((e) => !HIDDEN_ORG_SLUGS.has(e.slug));
  const organizations = readJson("organizations.json") ?? [];
  const youtubeVideos = readJson("sources", "youtube-videos.json") ?? {};
  const schedules = readJson("sources", "event-schedules.json") ?? {};
  const mira = readJson("sources", "mira-events.json");
  const orgNameBySlug = new Map(organizations.map((o) => [o.slug, o.name]));
  const channels = directory
    .filter((e) => e.onStreamETH || (youtubeVideos[e.slug]?.length ?? 0) > 0)
    .map((e) => ({ name: orgNameBySlug.get(e.slug) ?? e.name, slug: e.slug }));
  return {
    events: buildSeasonEvents({
      miraEvents: mira?.events ?? [],
      channels,
      scheduledEventNames: new Set(Object.keys(schedules)),
    }),
    schedules,
    miraEvents: mira?.events ?? [],
  };
}
