// Prints the channel slugs worth re-pulling right now, comma-separated: the
// channels of events that are live, start within a day, or ended within a
// day. Empty output means nothing is on, and the hourly live job stops there.
//
//   node scripts/live-channels.mjs                 # now
//   node scripts/live-channels.mjs 2026-11-04T08:00:00Z
import { loadSeasonEvents } from "./seasonData.mjs";

const DAY = 24 * 60 * 60 * 1000;
const now = process.argv[2] ? Date.parse(process.argv[2]) : Date.now();
if (!Number.isFinite(now)) {
  console.error(`Not a date: ${process.argv[2]}`);
  process.exit(1);
}

const { events } = loadSeasonEvents();
const slugs = new Set(
  events
    .filter((e) => e.channelSlug && e.from - DAY <= now && now < e.to + DAY)
    .map((e) => e.channelSlug)
);
process.stdout.write([...slugs].join(","));
