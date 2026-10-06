"use client";

import { useEffect } from "react";
import { useIsOffline } from "@/lib/offline";

/** Registers the service worker (production only — in dev it would serve
 * stale chunks over hot reloads) and shows a slim banner while offline. */
export default function OfflineSupport() {
  const offline = useIsOffline();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => console.error("Service worker registration failed", err));
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="sticky top-14 z-30 flex items-center justify-center gap-2 bg-stage px-4 py-2 text-center text-sm text-stage-ink"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path d="M3 3l18 18M8.5 16.4a5 5 0 017 0M5 12.9a10 10 0 015.1-2.7M19 12.9a10 10 0 00-2.4-1.6M2 9.3a15 15 0 014.4-2.6M22 9.3A15 15 0 0011.7 5" strokeLinecap="round" />
        <circle cx="12" cy="20" r="0.9" fill="currentColor" stroke="none" />
      </svg>
      You&apos;re offline — showing saved pages. Videos need a connection.
    </div>
  );
}
