// Event status and event → channel matching, kept free of Next/server
// imports so the app (lib/season.ts), the hourly live job
// (scripts/live-channels.mjs) and the story writer (scripts/write-stories.mjs)
// all decide "is this event live" the same way.

const DAY = 24 * 60 * 60 * 1000;

/**
 * Whether a recording uploaded at `at` (ms) belongs to an event's coverage:
 * from the day before it starts (teasers, the first stream) until
 * COVERAGE_TAIL_DAYS after it ends (recordings trickle in for weeks).
 *
 * @param {{ from: number, to: number }} window
 * @param {number} at
 */
export function inCoverage(window, at) {
  return at >= window.from - DAY && at < window.to + COVERAGE_TAIL_DAYS * DAY;
}

/** An event that ended within this many days still leads the homepage as
 * "Latest". */
export const RECENT_DAYS = 14;
/** Recordings keep trickling in for weeks after an event; uploads this long
 * after it ends still count as its coverage. */
export const COVERAGE_TAIL_DAYS = 30;

// Mira gives an event's dates without a time zone, as a country name with a
// flag emoji ("India 🇮🇳"). A representative zone per country is close
// enough to say whether day 1 has started — without one, Devcon Mumbai's
// first morning reads "upcoming" until 05:30 IST.
const COUNTRY_TIME_ZONES = {
  usa: "America/New_York",
  "united states": "America/New_York",
  canada: "America/Toronto",
  mexico: "America/Mexico_City",
  brazil: "America/Sao_Paulo",
  argentina: "America/Argentina/Buenos_Aires",
  honduras: "America/Tegucigalpa",
  "curaçao": "America/Curacao",
  uk: "Europe/London",
  "united kingdom": "Europe/London",
  portugal: "Europe/Lisbon",
  spain: "Europe/Madrid",
  france: "Europe/Paris",
  germany: "Europe/Berlin",
  netherlands: "Europe/Amsterdam",
  switzerland: "Europe/Zurich",
  italy: "Europe/Rome",
  austria: "Europe/Vienna",
  denmark: "Europe/Copenhagen",
  poland: "Europe/Warsaw",
  "czech republic": "Europe/Prague",
  serbia: "Europe/Belgrade",
  romania: "Europe/Bucharest",
  bulgaria: "Europe/Sofia",
  cyprus: "Asia/Nicosia",
  turkey: "Europe/Istanbul",
  israel: "Asia/Jerusalem",
  uae: "Asia/Dubai",
  "saudi arabia": "Asia/Riyadh",
  pakistan: "Asia/Karachi",
  india: "Asia/Kolkata",
  thailand: "Asia/Bangkok",
  malaysia: "Asia/Kuala_Lumpur",
  singapore: "Asia/Singapore",
  "hong kong": "Asia/Hong_Kong",
  china: "Asia/Shanghai",
  taiwan: "Asia/Taipei",
  korea: "Asia/Seoul",
  "south korea": "Asia/Seoul",
  japan: "Asia/Tokyo",
  australia: "Australia/Sydney",
  madagascar: "Indian/Antananarivo",
};

/**
 * @param {string | null | undefined} country Mira's country, e.g. "India 🇮🇳"
 * @returns {string | null} IANA zone, or null if unknown
 */
export function timeZoneForCountry(country) {
  if (!country) return null;
  const key = country
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    .trim()
    .toLowerCase();
  return COUNTRY_TIME_ZONES[key] ?? null;
}

/** Offset of `timeZone` from UTC at `at` (ms), in ms. */
function zoneOffset(timeZone, at) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - at;
}

/**
 * The UTC instants an event's local calendar days cover: from local midnight
 * of the first day to local midnight after the last. Unknown zone pads by
 * 12 hours each side, so an event never reads "upcoming" while it's on.
 *
 * @param {string} start "YYYY-MM-DD" (a full ISO string is cut to its date)
 * @param {string | null | undefined} end same; missing means a one-day event
 * @param {string | null} timeZone
 * @returns {{ from: number, to: number }}
 */
export function eventWindow(start, end, timeZone) {
  const startDay = Date.parse(`${start.slice(0, 10)}T00:00:00Z`);
  const endDayRaw = end ? Date.parse(`${end.slice(0, 10)}T00:00:00Z`) : startDay;
  const endDay = Number.isFinite(endDayRaw) && endDayRaw >= startDay ? endDayRaw : startDay;
  if (!timeZone) return { from: startDay - DAY / 2, to: endDay + DAY + DAY / 2 };
  return {
    from: startDay - zoneOffset(timeZone, startDay),
    to: endDay + DAY - zoneOffset(timeZone, endDay + DAY),
  };
}

/** @typedef {"live" | "upcoming" | "recent" | "past"} EventStatus */

/**
 * @param {{ from: number, to: number }} window from eventWindow
 * @param {number} now ms
 * @returns {EventStatus}
 */
export function eventStatus(window, now) {
  if (now < window.from) return "upcoming";
  if (now < window.to) return "live";
  if (now < window.to + RECENT_DAYS * DAY) return "recent";
  return "past";
}

/**
 * Which local day of the event `at` falls on, 1-based; 0 before it starts.
 *
 * @param {{ from: number, to: number }} window
 * @param {number} at ms
 */
export function eventDayNumber(window, at) {
  if (at < window.from) return 0;
  return Math.floor((at - window.from) / DAY) + 1;
}

/** @param {string | null | undefined} s */
export function normalizeName(s) {
  return (s ?? "")
    .toLowerCase()
    .replace(/\bv\d+\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * The channel an event belongs to: the one whose normalized name the event's
 * name starts with ("Devcon 8" → Devcon, "EthCC [10]" → EthCC, "ETHGlobal
 * Mumbai" → ETHGlobal), longest match first so "ETHGlobal" beats "ETH".
 * Prefix-only on purpose — a substring match tied "Edge City India" and
 * "Stable Summit IV" to whichever channel name happened to appear inside.
 *
 * @template {{ name: string, slug: string }} C
 * @param {string} eventName
 * @param {C[]} channels
 * @returns {C | undefined}
 */
export function matchChannel(eventName, channels) {
  const ne = normalizeName(eventName);
  let best;
  let bestLength = 0;
  for (const c of channels) {
    const nc = normalizeName(c.name);
    if (nc.length < 4 || nc.length <= bestLength) continue;
    if (ne.startsWith(nc)) {
      best = c;
      bestLength = nc.length;
    }
  }
  return best;
}

/**
 * @param {{ tags?: string[] | string | null }} e
 */
function isEthereumEvent(e) {
  const tags = Array.isArray(e.tags) ? e.tags : typeof e.tags === "string" ? [e.tags] : [];
  return tags.some((t) => /ethereum/i.test(t));
}

/** @param {string | null | undefined} country */
function stripFlags(country) {
  return country ? country.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "").trim() : null;
}

/**
 * @typedef {{
 *   key: string, slug: string, name: string, start: string, end: string,
 *   city: string | null, country: string | null, website: string | null,
 *   description: string | null, imageUrl: string | null,
 *   from: number, to: number, timeZone: string | null,
 *   channelSlug: string | null, channelName: string | null,
 *   href: string | null, channelHref: string | null,
 *   seriesSlug: string | null, hasSchedule: boolean,
 * }} SeasonEventRecord
 */

/**
 * Every main event on Mira's calendar that's either covered by one of our
 * channels or tagged Ethereum — the rest of Mira (fintech conferences,
 * banking summits) isn't this site's beat. One entry per name and start
 * date (Mira lists some events twice under different series). Soonest first.
 *
 * @param {{
 *   miraEvents: { id: string, kind: string, name: string, startTime: string | null,
 *     endTime: string | null, city: string | null, country: string | null,
 *     website: string | null, description: string | null, imageUrl?: string | null,
 *     seriesSlug: string | null,
 *     tags?: string[] | string | null }[],
 *   channels: { name: string, slug: string }[],
 *   scheduledEventNames: Set<string>,
 * }} input
 * @returns {SeasonEventRecord[]}
 */
export function buildSeasonEvents({ miraEvents, channels, scheduledEventNames }) {
  const seen = new Set();
  /** @type {SeasonEventRecord[]} */
  const events = [];
  for (const e of miraEvents) {
    if (e.kind !== "main" || !e.startTime) continue;
    const name = e.name.replace(/\s+/g, " ").trim();
    const channel = matchChannel(name, channels);
    if (!channel && !isEthereumEvent(e)) continue;
    const dedupeKey = `${normalizeName(name)}:${e.startTime.slice(0, 10)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const start = e.startTime.slice(0, 10);
    const end = (e.endTime ?? e.startTime).slice(0, 10);
    const timeZone = timeZoneForCountry(e.country);
    const { from, to } = eventWindow(start, end, timeZone);
    events.push({
      key: `mira:${e.id}`,
      slug: slugifyEventName(name),
      name,
      start,
      end,
      city: e.city,
      country: stripFlags(e.country),
      website: e.website,
      description: e.description?.trim() || null,
      imageUrl: e.imageUrl?.startsWith("https://") ? e.imageUrl : null,
      from,
      to,
      timeZone,
      channelSlug: channel?.slug ?? null,
      channelName: channel?.name ?? null,
      href: null,
      channelHref: channel ? `/${channel.slug}` : null,
      seriesSlug: e.seriesSlug,
      hasSchedule: scheduledEventNames.has(name),
    });
  }
  events.sort((a, b) => a.from - b.from);
  // Each covered event gets its own page at /<channel>/<event>. Editions
  // that share a name ("ETHGlobal Tokyo" every year) keep the plain slug for
  // the earliest one and add the year after, so a published link never
  // changes meaning when a later edition is added.
  const taken = new Set();
  for (const event of events) {
    if (!event.channelSlug) continue;
    let slug = event.slug;
    if (taken.has(`${event.channelSlug}/${slug}`)) slug = `${slug}-${event.start.slice(0, 4)}`;
    taken.add(`${event.channelSlug}/${slug}`);
    event.slug = slug;
    event.href = `/${event.channelSlug}/${slug}`;
  }
  return events;
}

/** URL slug for an event name: "EthCC [10]" → "ethcc-10". */
export function slugifyEventName(name) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "event"
  );
}
