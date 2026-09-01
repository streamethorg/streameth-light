"use client";

import { useMemo, useState } from "react";
import ChannelCard from "./ChannelCard";
import type { DirectoryEntry } from "@/lib/directory";

export default function ChannelBrowser({ directory }: { directory: DirectoryEntry[] }) {
  const [query, setQuery] = useState("");

  const active = useMemo(
    () =>
      directory
        .filter((e) => e.sessionCount > 0 || e.youtubeVideoCount > 0 || e.miraEventCount > 0)
        .sort((a, b) => b.sessionCount + b.youtubeVideoCount - (a.sessionCount + a.youtubeVideoCount)),
    [directory]
  );
  const tracked = useMemo(
    () =>
      directory
        .filter((e) => !(e.sessionCount > 0 || e.youtubeVideoCount > 0 || e.miraEventCount > 0))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [directory]
  );

  const q = query.trim().toLowerCase();
  const filteredActive = q
    ? active.filter((e) => e.name.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q))
    : active;
  const filteredTracked = q
    ? tracked.filter((e) => e.name.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q))
    : tracked;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">
          Channels
        </h2>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name or location…"
          className="w-40 rounded-sm border border-line bg-panel px-2.5 py-1 font-mono text-xs text-ink placeholder:text-ink-faint focus:border-accent/50 focus:outline-none sm:w-64"
        />
      </div>

      {filteredActive.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            {filteredActive.length} with video archive
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filteredActive.map((entry, i) => (
              <ChannelCard key={entry.slug} entry={entry} index={i} />
            ))}
          </div>
        </div>
      )}

      {filteredTracked.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            {filteredTracked.length} more tracked — no video yet
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {filteredTracked.map((entry) => (
              <a
                key={entry.slug}
                href={`/${entry.slug}`}
                className="font-mono text-xs text-ink-faint transition-colors hover:text-ink-dim"
              >
                {entry.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {filteredActive.length === 0 && filteredTracked.length === 0 && (
        <p className="py-8 text-center font-mono text-xs text-ink-faint">
          No channels match &quot;{query}&quot;.
        </p>
      )}
    </div>
  );
}
