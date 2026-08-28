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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          placeholder="Search title, description, speaker..."
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 sm:max-w-sm"
        />
        <select
          value={eventFilter}
          onChange={(e) => {
            setEventFilter(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-500 sm:max-w-xs"
        >
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e._id} value={e._id}>
              {e.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500 sm:ml-auto">
          {filtered.length} video{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-neutral-500">
          No videos match your search.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((s) => (
            <VideoCard key={s._id} session={s} event={eventById.get(s.eventId)} />
          ))}
        </div>
      )}

      {visible < filtered.length && (
        <button
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="mx-auto rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
        >
          Load more
        </button>
      )}
    </div>
  );
}
