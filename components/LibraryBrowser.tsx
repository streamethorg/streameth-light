"use client";

import { useMemo, useState } from "react";
import VideoCard from "@/components/VideoCard";
import type { Session, Event } from "@/lib/types";

const PAGE_SIZE = 48;

export default function LibraryBrowser({
  sessions,
  events,
}: {
  sessions: Session[];
  events: Event[];
}) {
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const eventById = useMemo(() => new Map(events.map((e) => [e._id, e])), [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (eventFilter && s.eventId !== eventFilter) return false;
      if (!q) return true;
      const speakerMatch = (s.speakers ?? []).some((sp) =>
        sp.name?.toLowerCase().includes(q)
      );
      return (
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        speakerMatch
      );
    });
  }, [sessions, query, eventFilter]);

  const shown = filtered.slice(0, visible);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 border-b border-line pb-6 sm:flex-row sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          placeholder="Search title, description, speaker…"
          className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent/60 focus:outline-none sm:max-w-sm"
        />
        <select
          value={eventFilter}
          onChange={(e) => {
            setEventFilter(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none sm:max-w-xs"
        >
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e._id} value={e._id}>
              {e.name}
            </option>
          ))}
        </select>
        <span className="font-mono text-xs tabular text-ink-faint sm:ml-auto">
          {String(filtered.length).padStart(3, "0")} video
          {filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-center font-mono text-sm text-ink-faint">
          No videos match your search.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((s) => (
            <VideoCard key={s._id} session={s} event={eventById.get(s.eventId)} />
          ))}
        </div>
      )}

      {visible < filtered.length && (
        <button
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="mx-auto rounded-md border border-line px-4 py-2 font-mono text-xs uppercase tracking-wide text-ink-dim transition-colors hover:border-accent/50 hover:text-ink"
        >
          Load more
        </button>
      )}
    </div>
  );
}
