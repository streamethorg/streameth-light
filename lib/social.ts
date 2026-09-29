import type { Metadata } from "next";

export const SITE_NAME = "StreamETH";

// Builds a page's `openGraph`/`twitter` metadata. Next.js doesn't deep-merge
// `openGraph`/`twitter` objects between a layout and a page — a page that
// sets either one replaces the parent's wholesale — so every generateMetadata
// that wants social cards needs to set title/description/images itself
// rather than relying on inheriting them from app/layout.tsx.
export function buildMetadata({
  title,
  description,
  image,
}: {
  title: string;
  description?: string;
  image?: string;
}): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
      ...(image ? { images: [{ url: image, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
