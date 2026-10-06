import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
