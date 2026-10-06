"use client";

import { useEffect, useState } from "react";
import { listCachedPages, type CachedPage } from "@/lib/offline";

/** The pages this device has saved. Plain <a> rather than <Link>: offline,
 * a client-side navigation needs an RSC fetch that would fail, while a full
 * load is answered from the service worker's cache. */
export default function OfflinePageList() {
  const [pages, setPages] = useState<CachedPage[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    listCachedPages()
      .then(setPages)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <p className="text-sm text-ink-dim">Couldn&apos;t read the pages saved on this device.</p>;
  }

  if (pages === null) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-panel-raised" />
        ))}
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <p className="text-sm text-ink-dim">
        Nothing saved yet. Pages you open while online are kept here for next time.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl ring-1 ring-line">
      {pages.map((page) => (
        <li key={page.path}>
          <a href={page.path} className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-panel-raised">
            <span className="truncate text-sm font-medium text-ink">{page.title}</span>
            <span className="truncate text-xs text-ink-faint">{page.path}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
