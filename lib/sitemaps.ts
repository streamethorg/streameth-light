import "server-only";
import { countVideos } from "./videoDb";

/** Videos per sitemap file. Google allows 50,000 URLs / 50MB per file, but
 * every entry here carries a full <video:video> block, so smaller files
 * keep each one fast to generate and fetch. */
export const VIDEOS_PER_SITEMAP = 5000;

export function videoSitemapIds(): number[] {
  return Array.from({ length: Math.max(1, Math.ceil(countVideos() / VIDEOS_PER_SITEMAP)) }, (_, i) => i);
}

/** Every sitemap URL, for robots.txt — Next.js doesn't generate a sitemap
 * index for generateSitemaps(), so robots.txt lists each file. */
export function sitemapPaths(): string[] {
  return ["/sitemap.xml", ...videoSitemapIds().map((id) => `/watch/sitemap/${id}.xml`)];
}
