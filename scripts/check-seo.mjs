// Fails the build when a video wouldn't be indexed properly. Runs after
// `next build` (postbuild) against what the build actually produced:
//   - every prerendered watch page has a title, meta description, canonical
//     URL, og:image, and VideoObject JSON-LD with the fields Google requires
//     (name, description, thumbnailUrl, a real uploadDate), plus the full
//     transcript in the HTML when the video has one;
//   - the video sitemaps list every video in data/streameth.db exactly once,
//     each with a title, description, thumbnail and a content or player URL;
//   - robots.txt points at every sitemap.
// YouTube watch pages render on demand rather than at build time, so they're
// covered here through the sitemaps and by the same code path as the
// prerendered StreamETH pages.
import { DatabaseSync } from "node:sqlite";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const APP_DIR = join(process.cwd(), ".next", "server", "app");
const WATCH_DIR = join(APP_DIR, "watch");
const SITEMAP_DIR = join(WATCH_DIR, "sitemap");
const DB_PATH = join(process.cwd(), "data", "streameth.db");
// Anything before this is a broken timestamp (a 1970 date), not a real upload.
const MIN_UPLOAD_DATE = Date.UTC(2000, 0, 1);
const MAX_LISTED_FAILURES = 25;

const failures = [];
const fail = (where, problem) => failures.push(`${where}: ${problem}`);

if (!existsSync(WATCH_DIR) || !existsSync(DB_PATH)) {
  console.error("check-seo: run `pnpm build` first (missing .next/server/app/watch or data/streameth.db)");
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const videos = db.prepare("SELECT id, source, has_transcript FROM videos").all();
const videoById = new Map(videos.map((v) => [v.id, v]));
const transcriptStart = db.prepare("SELECT substr(transcript, 1, 200) AS head FROM videos WHERE id = ?");

function decodeEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function metaContent(html, attr, name) {
  const match = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));
  return match ? decodeEntities(match[1]) : undefined;
}

function jsonLdBlocks(html) {
  const blocks = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    try {
      const data = JSON.parse(match[1]);
      blocks.push(...(Array.isArray(data) ? data : [data]));
    } catch {
      blocks.push({ "@type": "__invalid__" });
    }
  }
  return blocks;
}

// --- Prerendered watch pages ---------------------------------------------
const pageFiles = readdirSync(WATCH_DIR).filter((f) => f.endsWith(".html"));
for (const file of pageFiles) {
  const id = file.slice(0, -".html".length);
  const where = `/watch/${id}`;
  const html = readFileSync(join(WATCH_DIR, file), "utf-8");

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim();
  if (!title) fail(where, "missing <title>");
  if (!metaContent(html, "name", "description")) fail(where, "missing meta description");
  if (!html.includes(`<link rel="canonical" href="`) || !html.match(new RegExp(`rel="canonical" href="[^"]*/watch/${id}"`))) {
    fail(where, "missing or wrong canonical URL");
  }
  if (!metaContent(html, "property", "og:image")) fail(where, "missing og:image");

  const blocks = jsonLdBlocks(html);
  if (blocks.some((b) => b["@type"] === "__invalid__")) fail(where, "invalid JSON-LD");
  const video = blocks.find((b) => b["@type"] === "VideoObject");
  if (!video) {
    fail(where, "missing VideoObject JSON-LD");
  } else {
    if (!video.name) fail(where, "VideoObject has no name");
    if (!video.description) fail(where, "VideoObject has no description");
    if (!Array.isArray(video.thumbnailUrl) || !video.thumbnailUrl[0]) fail(where, "VideoObject has no thumbnailUrl");
    const uploaded = Date.parse(video.uploadDate ?? "");
    if (!Number.isFinite(uploaded) || uploaded < MIN_UPLOAD_DATE) {
      fail(where, `VideoObject uploadDate is missing or invalid (${video.uploadDate ?? "none"})`);
    }
    if (!video.contentUrl && !video.embedUrl) fail(where, "VideoObject has neither contentUrl nor embedUrl");
  }
  if (!blocks.some((b) => b["@type"] === "BreadcrumbList")) fail(where, "missing BreadcrumbList JSON-LD");

  const row = videoById.get(id);
  if (!row) {
    fail(where, "prerendered but not in data/streameth.db (sitemap and page data disagree)");
  } else if (row.has_transcript) {
    // Compare on the first words, whitespace-normalized, since React escapes
    // the text node.
    const head = (transcriptStart.get(id)?.head ?? "").replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ");
    const text = decodeEntities(html.replace(/<!-- -->/g, "")).replace(/\s+/g, " ");
    if (head && !text.includes(head)) fail(where, "transcript is not in the server-rendered HTML");
  }
}

// --- Video sitemaps --------------------------------------------------------
const listed = new Map();
const sitemapFiles = existsSync(SITEMAP_DIR)
  ? readdirSync(SITEMAP_DIR).filter((f) => f.endsWith(".xml.body")).sort((a, b) => parseInt(a) - parseInt(b))
  : [];
if (sitemapFiles.length === 0) fail("/watch/sitemap", "no video sitemaps were generated");

for (const file of sitemapFiles) {
  const where = `/watch/sitemap/${file.replace(/\.body$/, "")}`;
  const xml = readFileSync(join(SITEMAP_DIR, file), "utf-8");
  // A missing value printed by Next.js as a tag value or attribute, e.g.
  // <video:uploader undefined> — not the word inside a description.
  if (/>undefined<|="undefined"|\sundefined>/.test(xml)) fail(where, 'contains a literal "undefined" value');
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/i.test(xml)) fail(where, "contains an unescaped &");
  for (const entry of xml.split("<url>").slice(1)) {
    const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
    const id = loc?.match(/\/watch\/([^/<]+)$/)?.[1];
    if (!id) {
      fail(where, `entry without a watch URL: ${entry.slice(0, 80)}`);
      continue;
    }
    listed.set(id, (listed.get(id) ?? 0) + 1);
    for (const tag of ["video:title", "video:description", "video:thumbnail_loc"]) {
      if (!new RegExp(`<${tag}>[^<]+</${tag}>`).test(entry)) fail(`${where} ${id}`, `missing <${tag}>`);
    }
    if (!/<video:(content|player)_loc>[^<]+</.test(entry)) fail(`${where} ${id}`, "missing content_loc / player_loc");
  }
}

for (const v of videos) {
  const count = listed.get(v.id) ?? 0;
  if (count === 0) fail(`/watch/${v.id}`, "not in any video sitemap");
  if (count > 1) fail(`/watch/${v.id}`, `listed ${count} times across video sitemaps`);
}
for (const id of listed.keys()) {
  if (!videoById.has(id)) fail(`/watch/${id}`, "in a video sitemap but not in data/streameth.db");
}

// --- robots.txt --------------------------------------------------------------
const robotsPath = join(APP_DIR, "robots.txt.body");
if (!existsSync(robotsPath)) {
  fail("/robots.txt", "not generated");
} else {
  const robots = readFileSync(robotsPath, "utf-8");
  for (const path of ["/sitemap.xml", ...sitemapFiles.map((f) => `/watch/sitemap/${f.replace(/\.body$/, "")}`)]) {
    if (!robots.includes(`${path}\n`) && !robots.endsWith(path)) fail("/robots.txt", `doesn't list ${path}`);
  }
}

if (failures.length > 0) {
  console.error(`check-seo: ${failures.length} problem(s) found`);
  for (const line of failures.slice(0, MAX_LISTED_FAILURES)) console.error(`  - ${line}`);
  if (failures.length > MAX_LISTED_FAILURES) console.error(`  …and ${failures.length - MAX_LISTED_FAILURES} more`);
  process.exit(1);
}

console.log(
  `check-seo: ok — ${pageFiles.length} prerendered watch pages, ${listed.size} videos across ${sitemapFiles.length} video sitemaps`
);
