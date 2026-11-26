import type { NextConfig } from "next";
import reuploadRedirects from "./data/youtube-reupload-redirects.json";

const nextConfig: NextConfig = {
  // lib/data.ts reads data files by name, so file tracing bundles all of
  // data/ into every server function. These are only inputs to
  // scripts/build-db.mjs (their content is in data/streameth.db); leaving
  // them out keeps functions under Vercel's 250 MB limit.
  outputFileTracingExcludes: {
    "*": [
      "./data/transcripts.json",
      "./data/sources/youtube-transcripts.json",
      // The sharded backfill dataset (scripts/transcript_shards.py) — same
      // reason as its legacy single-file predecessor above, just bigger
      // (~270MB across the 10 shards). Its content lives in Supabase
      // (lib/transcriptChunks.ts) now, read over the network, not bundled.
      "./data/sources/youtube-transcripts/**",
      "./data/sources/youtube-metadata.json",
      "./data/sources/youtube-speakers.json",
      "./data/sources/mira-ethdenver-2025.json",
    ],
  },
  async redirects() {
    return [
      // Pages from the old site that Google still shows as "streameth"
      // sitelinks but now 404: /blog/the-future-of-live-streaming-in-web3
      // (49 impressions) and /data-request (46). The archive's editorial
      // lives in /stories now; the data-request form has no successor.
      { source: "/blog", destination: "/stories", permanent: true },
      { source: "/blog/:slug*", destination: "/stories", permanent: true },
      { source: "/data-request", destination: "/", permanent: true },
      // Talks the uploader replaced with a re-upload under a new YouTube ID
      // (Devcon 8: the EF re-uploaded ~114 sessions in Nov 2026). Old
      // /watch/yt-<old> links were already shared, so send them to the
      // official upload. Map: old ID -> new ID.
      ...Object.entries(reuploadRedirects as Record<string, string>).flatMap(([from, to]) => [
        { source: `/watch/yt-${from}`, destination: `/watch/yt-${to}`, permanent: true },
        { source: `/watch/yt-${from}.md`, destination: `/watch/yt-${to}.md`, permanent: true },
      ]),
    ];
  },
  async rewrites() {
    return {
      // /watch/<id>.md → the markdown copy of a watch page for AI crawlers
      // (app/watch/[id]/md/route.ts). Before the filesystem check, so it
      // isn't swallowed by the /watch/[id] page as an id ending in ".md".
      beforeFiles: [{ source: "/watch/:id.md", destination: "/watch/:id/md" }],
    };
  },
  async headers() {
    return [
      {
        // The browser must always re-check the service worker, or a fix to
        // it could sit behind a cached copy for up to a day.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
