import type { Metadata } from "next";

export const SITE_NAME = "StreamETH";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

// Builds a page's `openGraph`/`twitter` metadata. Next.js doesn't deep-merge
// `openGraph`/`twitter` objects between a layout and a page — a page that
// sets either one replaces the parent's wholesale — so every generateMetadata
// that wants social cards needs to set title/description/images itself
// rather than relying on inheriting them from app/layout.tsx.
export function buildMetadata({
  title,
  description,
  image,
  path,
  type = "website",
  alternateMarkdown,
}: {
  title: string;
  description?: string;
  image?: string;
  /** The page's own path — becomes its canonical URL and og:url, so query
   * string variants (filters, pagination, ?v=) don't compete as duplicates. */
  path?: string;
  type?: "website" | "video.other" | "profile";
  /** A plain-markdown copy of the page for AI crawlers (see /watch/[id].md). */
  alternateMarkdown?: string;
}): Metadata {
  return {
    title,
    description,
    ...(path
      ? {
          alternates: {
            canonical: path,
            ...(alternateMarkdown ? { types: { "text/markdown": alternateMarkdown } } : {}),
          },
        }
      : {}),
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type,
      ...(path ? { url: path } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
