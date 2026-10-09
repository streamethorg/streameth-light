import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/social";
import { absoluteUrl } from "@/lib/seo";
import { sitemapPaths } from "@/lib/sitemaps";

// Signed-in and utility pages: nothing there for a search engine.
const PRIVATE_PATHS = ["/api/", "/saved", "/settings", "/signin", "/connect", "/oauth/", "/auth/", "/offline"];

// AI search and answer engines, named explicitly so the archive can be cited
// in AI answers even if a host or CDN default ever starts blocking them.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "DuckAssistBot",
  "meta-externalagent",
  "MistralAI-User",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: sitemapPaths().map(absoluteUrl),
    host: SITE_URL,
  };
}
