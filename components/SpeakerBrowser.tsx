"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "@/components/Avatar";

export interface SpeakerCardData {
  name: string;
  slug: string;
  company?: string;
  photo?: string;
  talks: number;
}

// Cards rendered up front, and added each time the end of the grid scrolls
// into view. Rendering all ~1,300 at once made a 1.4MB page that phones
// took seconds to lay out; every speaker page is still in the sitemap.
const BATCH = 96;

export default function SpeakerBrowser({ speakers }: { speakers: SpeakerCardData[] }) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return speakers;
    return speakers.filter(
      (sp) =>
        sp.name.toLowerCase().includes(q) ||
        sp.company?.toLowerCase().includes(q)
    );
  }, [speakers, query]);

  const hasMore = shown < filtered.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => n + BATCH);
      },
      // Start on the next batch well before the reader reaches the end.
      { rootMargin: "1200px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, shown]);

  return (
    <div className="flex flex-col gap-8">
      <label className="flex h-9 w-full items-center gap-3 rounded-sm border border-line-strong bg-void px-3 focus-within:border-accent sm:max-w-md">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true">
          <circle cx="9" cy="9" r="6.5" />
          <path d="M18 18l-4-4" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(BATCH);
          }}
          placeholder="Find a speaker by name or company"
          aria-label="Find a speaker"
          className="h-full w-full bg-transparent text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {filtered.slice(0, shown).map((sp) => (
          <Link
            key={sp.slug}
            href={`/speakers/${sp.slug}`}
            className="group flex flex-col items-center gap-3 rounded-sm text-center outline-offset-4"
          >
            <span className="rounded-full p-1 ring-2 ring-transparent transition-[box-shadow,--tw-ring-color] group-hover:ring-accent">
              <Avatar name={sp.name} photo={sp.photo} className="h-24 w-24 text-xl" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="line-clamp-1 text-[15px] font-semibold text-ink group-hover:text-accent">
                {sp.name}
              </span>
              <span className="line-clamp-1 text-[13px] text-ink-faint">
                {sp.company || `${sp.talks} ${sp.talks === 1 ? "talk" : "talks"}`}
              </span>
            </span>
          </Link>
        ))}
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + BATCH)}
            className="h-9 rounded-sm border border-line-strong px-4 text-sm font-medium text-ink transition-colors hover:border-ink-faint"
          >
            Show more speakers
          </button>
        </div>
      )}
      {filtered.length === 0 && (
        <p className="border-t border-line py-12 text-center text-sm text-ink-dim">
          No speakers match &ldquo;{query}&rdquo;.
        </p>
      )}
    </div>
  );
}
