import { SITE_NAME, SITE_URL } from "./social";

// Shared helpers for everything search engines and AI crawlers read: page
// descriptions, absolute URLs, structured data (JSON-LD) and the sitemap.
// Kept free of data-layer imports so sitemap, robots, llms.txt and pages can
// all use it.

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** Generated 1280×720 thumbnail for a video with no cover image — Google
 * won't index a video without one (see app/watch/[id]/poster.png). */
export function posterPath(videoId: string): string {
  return `/watch/${encodeURIComponent(videoId)}/poster.png`;
}

export function videoThumbnail(video: { id: string; coverImage?: string | null }): string {
  return video.coverImage ? absoluteUrl(video.coverImage) : absoluteUrl(posterPath(video.id));
}

/** Next.js writes sitemap values into the XML verbatim, unescaped — a title
 * with "&" or "<" would make the whole sitemap invalid. */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** ISO 8601 duration ("PT1H2M3S"), the format schema.org expects. */
export function isoDuration(seconds: number): string {
  const total = Math.max(1, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}

/** Collapses whitespace and cuts at a word boundary, so a description never
 * ends mid-word. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–—-]+$/, "")}…`;
}

export function joinNames(names: string[], max = 3): string {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} and ${rest} more`;
  if (shown.length <= 1) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

export interface VideoSeoInput {
  id: string;
  title: string;
  description?: string | null;
  speakers: string[];
  eventName?: string | null;
  orgName?: string | null;
  topics: string[];
  publishedAt?: number | null;
}

// Placeholder text left in the source exports instead of a real description.
const JUNK_DESCRIPTION_RE = /^(no description|clip|test|few|video\+[a-z0-9]+)$/i;

/** The text, or undefined when it's empty or an export placeholder. */
export function usableDescription(text: string | null | undefined): string | undefined {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length < 20 || JUNK_DESCRIPTION_RE.test(clean)) return undefined;
  return clean;
}

/** "Talk by A and B at Devcon 7 (Ethereum Foundation), Nov 2024." — the
 * facts we always have, so a video with an empty or junk description still
 * gets a real, specific description instead of a duplicate generic one. */
function videoContext(video: VideoSeoInput): string {
  const speakers = video.speakers.length > 0 ? ` by ${joinNames(video.speakers)}` : "";
  const where = video.eventName
    ? ` at ${video.eventName}${video.orgName && video.orgName !== video.eventName ? ` (${video.orgName})` : ""}`
    : video.orgName
      ? ` from ${video.orgName}`
      : "";
  const when =
    video.publishedAt && video.publishedAt > 0
      ? `, ${new Date(video.publishedAt).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`
      : "";
  return `${speakers ? "Talk" : "Video"}${speakers}${where}${when}.`;
}

/** Meta description (~160 chars): the real description when there is one,
 * led by who/where so the snippet is useful even when cut short. */
export function videoMetaDescription(video: VideoSeoInput, max = 160): string {
  const description = usableDescription(video.description);
  const context = videoContext(video);
  if (!description) {
    const topics = video.topics.length > 0 ? ` Topics: ${video.topics.slice(0, 4).join(", ")}.` : "";
    return truncate(`${video.title} — ${context}${topics}`, max);
  }
  return truncate(`${context} ${description}`, max);
}

/** Long-form description for VideoObject JSON-LD and the video sitemap
 * (Google's limit is 2048 characters). */
export function videoLongDescription(video: VideoSeoInput, max = 2000): string {
  const description = usableDescription(video.description);
  const topics = video.topics.length > 0 ? ` Topics: ${video.topics.slice(0, 8).join(", ")}.` : "";
  return truncate(`${videoContext(video)}${description ? ` ${description}` : ""}${topics}`, max);
}

/** "Title — Speaker at Event". Skips whatever the title already says (YouTube
 * titles often embed the speaker or event already). */
export function videoPageTitle(video: VideoSeoInput): string {
  const lower = video.title.toLowerCase();
  const speakers = video.speakers.filter((name) => !lower.includes(name.toLowerCase()));
  const venue = video.eventName || video.orgName || "";
  const venuePart = venue && !lower.includes(venue.toLowerCase()) ? venue : "";
  const speakerPart = speakers.length > 0 ? joinNames(speakers, 2) : "";
  const suffix = [speakerPart, venuePart].filter(Boolean).join(" at ");
  return suffix ? `${video.title} — ${suffix}` : `${video.title} — ${SITE_NAME}`;
}

type JsonLdValue = string | number | boolean | null | undefined | JsonLd | JsonLdValue[];
export interface JsonLd {
  [key: string]: JsonLdValue;
}

/** Drops undefined/null/empty values so the output only carries real data. */
function compact<T extends JsonLd>(obj: T): T {
  const out: JsonLd = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out as T;
}

export interface VideoJsonLdInput extends VideoSeoInput {
  source: "streameth" | "youtube";
  coverImage?: string | null;
  durationSeconds?: number | null;
  contentUrl?: string | null;
  /** Speaker name → profile path on this site, when one exists. */
  speakerPath?: (name: string) => string | undefined;
  orgPath?: string;
  /** The conference the talk was recorded at, when known. */
  event?: { name: string; path?: string; start?: string; end?: string; location?: string };
}

export function videoJsonLd(video: VideoJsonLdInput): JsonLd {
  const url = absoluteUrl(`/watch/${video.id}`);
  const youtubeId = video.source === "youtube" ? video.id.replace(/^yt-/, "") : undefined;
  return compact({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "@id": `${url}#video`,
    url,
    name: video.title,
    description: videoLongDescription(video),
    thumbnailUrl: [videoThumbnail(video)],
    uploadDate:
      video.publishedAt && video.publishedAt > 0 ? new Date(video.publishedAt).toISOString() : undefined,
    duration: video.durationSeconds ? isoDuration(video.durationSeconds) : undefined,
    contentUrl: video.contentUrl ?? undefined,
    embedUrl: youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : undefined,
    inLanguage: "en",
    keywords: video.topics.length > 0 ? video.topics.join(", ") : undefined,
    isAccessibleForFree: true,
    author: video.speakers.map((name) => {
      const path = video.speakerPath?.(name);
      return compact({ "@type": "Person", name, url: path ? absoluteUrl(path) : undefined });
    }),
    publisher: video.orgName
      ? compact({
          "@type": "Organization",
          name: video.orgName,
          url: video.orgPath ? absoluteUrl(video.orgPath) : undefined,
        })
      : undefined,
    recordedAt: video.event
      ? compact({
          "@type": "Event",
          name: video.event.name,
          url: video.event.path ? absoluteUrl(video.event.path) : undefined,
          startDate: video.event.start,
          endDate: video.event.end,
          location: video.event.location
            ? { "@type": "Place", name: video.event.location, address: video.event.location }
            : undefined,
        })
      : undefined,
  });
}

/** BreadcrumbList from (name, path) pairs; the last item is the current page. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Serialized for a <script type="application/ld+json"> tag. `<` is escaped
 * so a title containing "</script>" can't break out of the tag. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** ItemList of on-site URLs (e.g. an event's talks) — lets search engines
 * tie a summary page to the pages it lists. */
export function itemListJsonLd(name: string, paths: string[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: paths.length,
    itemListElement: paths.map((path, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(path) })),
  };
}

export function speakerJsonLd(speaker: {
  name: string;
  path: string;
  bio?: string;
  photo?: string;
  company?: string;
  twitter?: string;
}): JsonLd {
  const url = absoluteUrl(speaker.path);
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    mainEntity: compact({
      "@type": "Person",
      "@id": `${url}#person`,
      name: speaker.name,
      url,
      description: speaker.bio ? truncate(speaker.bio, 1000) : undefined,
      image: speaker.photo,
      worksFor: speaker.company ? { "@type": "Organization", name: speaker.company } : undefined,
      sameAs: speaker.twitter ? [`https://x.com/${speaker.twitter}`] : undefined,
    }),
  };
}

export function eventJsonLd(event: {
  name: string;
  path: string;
  description?: string;
  start?: string;
  end?: string;
  location?: string;
  image?: string;
  organizer?: { name: string; path: string };
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${absoluteUrl(event.path)}#event`,
    name: event.name,
    url: absoluteUrl(event.path),
    description: event.description ? truncate(event.description, 1000) : undefined,
    startDate: event.start,
    endDate: event.end,
    eventStatus: "https://schema.org/EventScheduled",
    location: event.location ? { "@type": "Place", name: event.location, address: event.location } : undefined,
    image: event.image ? [event.image] : undefined,
    organizer: event.organizer
      ? { "@type": "Organization", name: event.organizer.name, url: absoluteUrl(event.organizer.path) }
      : undefined,
  });
}

export function organizationJsonLd(org: {
  name: string;
  path: string;
  description?: string;
  logo?: string;
  location?: string;
  website?: string;
}): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${absoluteUrl(org.path)}#organization`,
    name: org.name,
    url: absoluteUrl(org.path),
    description: org.description ? truncate(org.description, 1000) : undefined,
    logo: org.logo,
    location: org.location,
    sameAs: org.website ? [org.website] : undefined,
  });
}
