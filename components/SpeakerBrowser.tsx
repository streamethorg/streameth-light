"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import type { Speaker } from "@/lib/people";

export default function SpeakerBrowser({ speakers }: { speakers: Speaker[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return speakers;
    return speakers.filter(
      (sp) =>
        sp.name.toLowerCase().includes(q) ||
        sp.company?.toLowerCase().includes(q)
    );
  }, [speakers, query]);

  return (
    <div className="flex flex-col gap-8">
      <label className="flex h-12 w-full items-center gap-3 rounded-full bg-panel px-5 shadow-sm ring-1 ring-line focus-within:ring-2 focus-within:ring-accent sm:max-w-md">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true">
          <circle cx="9" cy="9" r="6.5" />
          <path d="M18 18l-4-4" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a speaker by name or company"
          aria-label="Find a speaker"
          className="w-full bg-transparent text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {filtered.map((sp) => (
          <Link
            key={sp.slug}
            href={`/speakers/${sp.slug}`}
            className="group flex flex-col items-center gap-3 rounded-xl text-center outline-offset-4"
          >
            <span className="rounded-full p-1 ring-2 ring-transparent transition-[box-shadow,--tw-ring-color] group-hover:ring-accent">
              <Avatar name={sp.name} photo={sp.photo} className="h-24 w-24 text-xl" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="line-clamp-1 text-[15px] font-semibold text-ink group-hover:text-accent">
                {sp.name}
              </span>
              <span className="line-clamp-1 text-[13px] text-ink-faint">
                {sp.company || `${sp.sessionIds.length} ${sp.sessionIds.length === 1 ? "talk" : "talks"}`}
              </span>
            </span>
          </Link>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="rounded-2xl bg-panel py-12 text-center text-sm text-ink-dim ring-1 ring-line">
          No speakers match &ldquo;{query}&rdquo;.
        </p>
      )}
    </div>
  );
}
