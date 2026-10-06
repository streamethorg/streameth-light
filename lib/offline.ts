"use client";

import { useSyncExternalStore } from "react";

// Must match the names in public/sw.js.
const PAGES_CACHE = "streameth-pages-v1";

export type CachedPage = { path: string; title: string };

// Routes that are cached for the service worker's own use but aren't worth
// listing as "available offline".
const HIDDEN_PATHS = new Set(["/offline"]);

/** Every page the service worker has saved, newest first, with the title
 * read out of the stored HTML so the list is readable. */
export async function listCachedPages(): Promise<CachedPage[]> {
  if (typeof caches === "undefined") return [];
  const cache = await caches.open(PAGES_CACHE);
  const requests = await cache.keys();
  const pages = await Promise.all(
    requests.map(async (req): Promise<CachedPage | null> => {
      const url = new URL(req.url);
      const path = url.pathname + url.search;
      if (HIDDEN_PATHS.has(url.pathname)) return null;
      const res = await cache.match(req);
      if (!res) return null;
      const html = await res.text();
      const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      return { path, title: match ? decodeEntities(match[1]) : path };
    })
  );
  return pages.filter((p): p is CachedPage => p !== null).reverse();
}

/** Drops saved pages so a signed-out device doesn't keep serving the
 * previous account's /saved list (or its header) from cache. */
export async function clearCachedPages(): Promise<void> {
  if (typeof caches === "undefined") return;
  await caches.delete(PAGES_CACHE);
}

function decodeEntities(text: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** True while the browser reports no network. SSR and hydration assume
 * online so the server markup never mismatches. */
export function useIsOffline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => !navigator.onLine,
    () => false
  );
}
