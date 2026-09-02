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
    <div className="flex flex-col gap-6">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by name or company…"
        className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent/60 focus:outline-none sm:max-w-sm"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {filtered.map((sp) => (
          <Link
            key={sp.slug}
            href={`/speakers/${sp.slug}`}
            className="group flex flex-col items-center gap-2 rounded-md border border-line bg-panel p-4 text-center transition-all duration-200 hover:border-accent/50 hover:shadow-md"
          >
            <span className="relative">
              <Avatar name={sp.name} photo={sp.photo} className="h-14 w-14 text-sm" />
              <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/5 transition-colors group-hover:ring-accent/40" />
            </span>
            <span className="line-clamp-1 text-xs font-medium text-ink group-hover:text-accent">
              {sp.name}
            </span>
            <span className="font-mono text-[10px] tabular text-ink-faint">
              {sp.sessionIds.length} talk{sp.sessionIds.length === 1 ? "" : "s"}
            </span>
          </Link>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="py-12 text-center font-mono text-sm text-ink-faint">
          No speakers match &quot;{query}&quot;.
        </p>
      )}
    </div>
  );
}
