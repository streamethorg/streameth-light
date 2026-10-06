/* StreamETH offline support.
 *
 * - Pages (HTML navigations): network-first. Every page you open online is
 *   kept, so it opens again offline; a page you never opened falls back to
 *   /offline, which lists what is available.
 * - Build assets (/_next/static): cache-first — their URLs are content
 *   hashed, so a cached copy is never stale.
 * - Thumbnails: served from cache, refreshed in the background.
 * - Everything else (RSC payloads, /api, auth, video streams, YouTube) goes
 *   straight to the network. An RSC fetch that fails makes the Next.js router
 *   fall back to a full page load, which then comes back here as a
 *   navigation and gets the cached HTML.
 *
 * Cache names are shared with lib/offline.ts — keep them in sync. */

const VERSION = "v1";
const PAGES_CACHE = `streameth-pages-${VERSION}`;
const STATIC_CACHE = `streameth-static-${VERSION}`;
const IMAGES_CACHE = `streameth-images-${VERSION}`;
const KNOWN_CACHES = [PAGES_CACHE, STATIC_CACHE, IMAGES_CACHE];

const OFFLINE_URL = "/offline";
const PRECACHE_PAGES = ["/", OFFLINE_URL];

const MAX_PAGES = 60;
const MAX_STATIC = 400;
const MAX_IMAGES = 300;

// Pages that must never be served from cache: they set or depend on a fresh
// auth state (a stale copy would be wrong rather than merely old), or show
// account secrets like MCP access tokens that shouldn't sit on disk.
const NO_CACHE_PREFIXES = ["/auth/", "/signin", "/api/", "/settings", "/connect", "/oauth/"];

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("streameth-") && !KNOWN_CACHES.includes(name))
          .map((name) => caches.delete(name))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

// Caches the home page and the offline page, plus the build assets they
// reference, so /offline renders even if the first visit was the last time
// the device was online.
async function precache() {
  const pages = await caches.open(PAGES_CACHE);
  const statics = await caches.open(STATIC_CACHE);
  await Promise.all(
    PRECACHE_PAGES.map(async (path) => {
      try {
        const res = await fetch(path, { credentials: "same-origin", cache: "no-store" });
        if (!res.ok) return;
        const html = await res.clone().text();
        await pages.put(path, res);
        const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? []);
        await Promise.all(
          [...assets].map(async (asset) => {
            if (await statics.match(asset)) return;
            try {
              const assetRes = await fetch(asset);
              if (assetRes.ok) await statics.put(asset, assetRes);
            } catch {
              // One missing chunk shouldn't abort install; it gets cached on
              // first use instead.
            }
          })
        );
      } catch {
        // Offline during install — the runtime handlers fill the cache later.
      }
    })
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    if (url.origin !== self.location.origin) return;
    if (NO_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p))) return;
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, MAX_STATIC));
    return;
  }

  if (request.destination === "image" && !url.pathname.startsWith("/_next/image")) {
    event.respondWith(staleWhileRevalidate(event, IMAGES_CACHE, MAX_IMAGES));
  }
});

// Keyed by path + query without the hash, so /videos?q=x and /videos?q=y
// are separate entries but tracking fragments don't fork the cache.
function pageKey(url) {
  const u = new URL(url);
  u.hash = "";
  return u.toString();
}

async function handleNavigation(event) {
  const { request } = event;
  const cache = await caches.open(PAGES_CACHE);
  const key = pageKey(request.url);

  try {
    const res = (await event.preloadResponse) || (await fetch(request));
    if (res.ok && !res.redirected && res.type === "basic" && isHtml(res)) {
      const copy = res.clone();
      event.waitUntil(putTrimmed(cache, key, copy, MAX_PAGES));
    }
    return res;
  } catch {
    const cached = await cache.match(key);
    if (cached) return cached;
    const offline = await cache.match(new URL(OFFLINE_URL, self.location.origin).toString());
    if (offline) return offline;
    return new Response("You're offline and this page hasn't been saved yet.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) await putTrimmed(cache, request, res.clone(), max);
  return res;
}

async function staleWhileRevalidate(event, cacheName, max) {
  const { request } = event;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (res) => {
      // Cross-origin thumbnails come back opaque (status 0) — keep them; a
      // broken one just falls back to the placeholder in CoverImage.
      if (res.ok || res.type === "opaque") await putTrimmed(cache, request, res.clone(), max);
      return res;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  const res = await network;
  return res ?? Response.error();
}

function isHtml(res) {
  return (res.headers.get("Content-Type") || "").includes("text/html");
}

// Cache.keys() returns entries in insertion order, so deleting before
// re-putting moves an entry to the end and trimming from the front drops the
// least recently refreshed ones.
async function putTrimmed(cache, key, res, max) {
  await cache.delete(key);
  await cache.put(key, res);
  const keys = await cache.keys();
  const excess = keys.length - max;
  if (excess > 0) {
    await Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)));
  }
}
