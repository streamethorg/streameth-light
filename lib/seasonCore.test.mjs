import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eventDayNumber,
  eventStatus,
  eventWindow,
  matchChannel,
  buildSeasonEvents,
  timeZoneForCountry,
} from "./seasonCore.mjs";

const devcon = eventWindow("2026-11-03", "2026-11-06", timeZoneForCountry("India 🇮🇳"));

test("Mira country names map to a time zone, flag emoji and all", () => {
  assert.equal(timeZoneForCountry("India 🇮🇳"), "Asia/Kolkata");
  assert.equal(timeZoneForCountry("USA 🇺🇸"), "America/New_York");
  assert.equal(timeZoneForCountry("Atlantis"), null);
  assert.equal(timeZoneForCountry(null), null);
});

test("Devcon Mumbai is live from local midnight on day 1, not UTC midnight", () => {
  // 02:00 IST on Nov 3 = 20:30 UTC on Nov 2.
  assert.equal(eventStatus(devcon, Date.parse("2026-11-02T20:30:00Z")), "live");
  // 23:00 IST on Nov 2 is still the day before.
  assert.equal(eventStatus(devcon, Date.parse("2026-11-02T17:30:00Z")), "upcoming");
});

test("live through the last local day, then recent for 14 days, then past", () => {
  // 23:59 IST Nov 6.
  assert.equal(eventStatus(devcon, Date.parse("2026-11-06T18:29:00Z")), "live");
  // 00:01 IST Nov 7.
  assert.equal(eventStatus(devcon, Date.parse("2026-11-06T18:31:00Z")), "recent");
  assert.equal(eventStatus(devcon, Date.parse("2026-11-20T00:00:00Z")), "recent");
  assert.equal(eventStatus(devcon, Date.parse("2026-11-22T00:00:00Z")), "past");
});

test("a missing end date is a one-day event", () => {
  const w = eventWindow("2026-12-01", null, "Europe/London");
  assert.equal(eventStatus(w, Date.parse("2026-12-01T12:00:00Z")), "live");
  assert.equal(eventStatus(w, Date.parse("2026-12-02T00:30:00Z")), "recent");
});

test("an end date before the start is treated as a one-day event", () => {
  const w = eventWindow("2026-12-05", "2026-12-01", "Europe/London");
  assert.equal(w.to - w.from, 24 * 60 * 60 * 1000);
});

test("unknown zone pads 12 hours each side", () => {
  const w = eventWindow("2026-12-01", "2026-12-01", null);
  assert.equal(eventStatus(w, Date.parse("2026-11-30T13:00:00Z")), "live");
  assert.equal(eventStatus(w, Date.parse("2026-12-02T11:00:00Z")), "live");
});

test("event day numbers follow local days", () => {
  assert.equal(eventDayNumber(devcon, Date.parse("2026-11-02T10:00:00Z")), 0);
  assert.equal(eventDayNumber(devcon, Date.parse("2026-11-03T04:30:00Z")), 1);
  assert.equal(eventDayNumber(devcon, Date.parse("2026-11-04T19:00:00Z")), 3);
});

test("DST change inside an event keeps the window to whole local days", () => {
  // US clocks go back on 2026-11-01.
  const w = eventWindow("2026-10-31", "2026-11-01", "America/New_York");
  assert.equal(w.from, Date.parse("2026-10-31T04:00:00Z"));
  assert.equal(w.to, Date.parse("2026-11-02T05:00:00Z"));
});

const channels = [
  { name: "Devcon", slug: "devcon" },
  { name: "ETHGlobal", slug: "ethglobal" },
  { name: "ETH", slug: "eth" },
  { name: "EthCC", slug: "ethcc" },
  { name: "Edge City", slug: "edge_city" },
];

test("events match the channel their name starts with, longest first", () => {
  assert.equal(matchChannel("Devcon 8", channels)?.slug, "devcon");
  assert.equal(matchChannel("ETHGlobal Mumbai", channels)?.slug, "ethglobal");
  assert.equal(matchChannel("EthCC [10]", channels)?.slug, "ethcc");
  // "ETH" is under the 4-character minimum, so it never matches.
  assert.equal(matchChannel("ETHSofia", channels), undefined);
  // Prefix only: "Devcon" inside a name doesn't count.
  assert.equal(matchChannel("Road to Devcon", channels), undefined);
});

test("a pinned Mira event joins its channel even when the name doesn't match", () => {
  const channels = [{ name: "MERGE Madrid Events", slug: "merge-madrid-events" }];
  const miraEvents = [{ id: "recM", kind: "main", name: "MERGE Madrid ", startTime: "2026-10-27",
    endTime: "2026-10-29", city: "Madrid", country: "Spain", website: null, description: null,
    seriesSlug: "MERGEMadridEvents2026", tags: ["Conference"] }];
  const args = { miraEvents, channels, scheduledEventNames: new Set() };
  assert.equal(buildSeasonEvents(args).length, 0);
  const [e] = buildSeasonEvents({ ...args, channelOverrides: { recM: "merge-madrid-events" } });
  assert.equal(e.key, "mira:recM");
  assert.equal(e.href, "/merge-madrid-events/merge-madrid");
});
