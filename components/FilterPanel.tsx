"use client";

import { useState } from "react";
import type { Event } from "@/lib/types";
import type { OrgOption } from "@/lib/videoDb";
import type { BrowseFilters, DurationBucket, SortMode } from "@/lib/browseParams";

const DURATION_LABELS: Record<DurationBucket, string> = {
  short: "Under 4 min",
  medium: "4–20 min",
  long: "Over 20 min",
};

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "duration_desc", label: "Longest" },
  { value: "duration_asc", label: "Shortest" },
];

export default function FilterPanel({
  filters,
  channels,
  events,
  orgIdBySlug,
  topics,
  hasQuery,
  onChange,
}: {
  filters: BrowseFilters;
  channels: OrgOption[];
  events: Event[];
  orgIdBySlug: Record<string, string>;
  topics: string[];
  hasQuery: boolean;
  onChange: (patch: Partial<BrowseFilters>) => void;
}) {
  const hasAdvanced = Boolean(
    filters.orgIds.length ||
      filters.eventIds.length ||
      filters.duration ||
      filters.dateFrom ||
      filters.dateTo ||
      (filters.sort !== "relevance" && hasQuery)
  );
  const [open, setOpen] = useState(hasAdvanced);
  const selectedOrgIds = filters.orgIds.map((slug) => orgIdBySlug[slug]).filter(Boolean);
  const eventOptions =
    selectedOrgIds.length > 0
      ? events.filter((e) => selectedOrgIds.includes(e.organizationId))
      : events;

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex items-center gap-3 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
            open ? "bg-stage text-stage-ink" : "bg-panel-raised text-ink hover:bg-panel-hover"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
            <path d="M4 7h10m4 0h2M4 17h4m4 0h8" strokeLinecap="round" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="10" cy="17" r="2" />
          </svg>
          Filters
        </button>
        {topics.length > 0 && <span className="h-6 w-px shrink-0 bg-line" aria-hidden="true" />}
        {topics.map((topic) => {
          const active = filters.topic.toLowerCase() === topic.toLowerCase();
          return (
            <button
              key={topic}
              type="button"
              onClick={() => onChange({ topic: active ? "" : topic })}
              aria-pressed={active}
              className={`flex h-8 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors ${
                active ? "bg-stage text-stage-ink" : "bg-panel-raised text-ink hover:bg-panel-hover"
              }`}
            >
              {topic}
            </button>
          );
        })}
      </div>

      {open && (
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          <select
            value={filters.orgIds[0] ?? ""}
            onChange={(e) => onChange({ orgIds: e.target.value ? [e.target.value] : [], eventIds: [] })}
            className="h-8 max-w-[16rem] shrink-0 cursor-pointer rounded-lg bg-panel-raised pl-3 pr-2 text-sm font-medium text-ink transition-colors hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">All channels</option>
            {channels.map((channel) => (
              <option key={channel.slug} value={channel.slug}>
                {channel.name}
              </option>
            ))}
          </select>
  
          <select
            value={filters.eventIds[0] ?? ""}
            onChange={(e) => onChange({ eventIds: e.target.value ? [e.target.value] : [] })}
            className="h-8 max-w-[16rem] shrink-0 cursor-pointer rounded-lg bg-panel-raised pl-3 pr-2 text-sm font-medium text-ink transition-colors hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">All events</option>
            {eventOptions.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name}
              </option>
            ))}
          </select>
  
          <select
            value={filters.duration}
            onChange={(e) => onChange({ duration: e.target.value as DurationBucket | "" })}
            className="h-8 max-w-[16rem] shrink-0 cursor-pointer rounded-lg bg-panel-raised pl-3 pr-2 text-sm font-medium text-ink transition-colors hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">Any length</option>
            {(Object.keys(DURATION_LABELS) as DurationBucket[]).map((bucket) => (
              <option key={bucket} value={bucket}>
                {DURATION_LABELS[bucket]}
              </option>
            ))}
          </select>
  
          <label className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-panel-raised px-3 text-sm font-medium text-ink-dim focus-within:ring-2 focus-within:ring-accent">
            From
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onChange({ dateFrom: e.target.value })}
              className="bg-transparent text-ink focus:outline-none [color-scheme:light]"
            />
          </label>
          <label className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-panel-raised px-3 text-sm font-medium text-ink-dim focus-within:ring-2 focus-within:ring-accent">
            To
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onChange({ dateTo: e.target.value })}
              className="bg-transparent text-ink focus:outline-none [color-scheme:light]"
            />
          </label>
  
          <select
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value as SortMode })}
            disabled={!hasQuery && filters.sort === "relevance"}
            className="h-8 shrink-0 cursor-pointer rounded-lg bg-panel-raised pl-3 pr-2 text-sm font-medium text-ink transition-colors hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-60 sm:ml-auto"
          >
            {SORT_OPTIONS.filter((o) => o.value !== "relevance" || hasQuery).map((o) => (
              <option key={o.value} value={o.value}>
                Sort: {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <ActiveFilterChips filters={filters} channels={channels} events={events} onChange={onChange} />
    </div>
  );
}

function ActiveFilterChips({
  filters,
  channels,
  events,
  onChange,
}: {
  filters: BrowseFilters;
  channels: OrgOption[];
  events: Event[];
  onChange: (patch: Partial<BrowseFilters>) => void;
}) {
  const chips: { label: string; clear: () => void }[] = [];

  for (const slug of filters.orgIds) {
    const channel = channels.find((c) => c.slug === slug);
    if (channel) {
      chips.push({
        label: channel.name,
        clear: () => onChange({ orgIds: filters.orgIds.filter((s) => s !== slug) }),
      });
    }
  }
  for (const eventId of filters.eventIds) {
    const event = events.find((e) => e._id === eventId);
    if (event) {
      chips.push({
        label: event.name,
        clear: () => onChange({ eventIds: filters.eventIds.filter((id) => id !== eventId) }),
      });
    }
  }
  if (filters.speaker) {
    chips.push({ label: `Speaker: ${filters.speaker}`, clear: () => onChange({ speaker: "" }) });
  }
  if (filters.topic) {
    chips.push({ label: `Topic: ${filters.topic}`, clear: () => onChange({ topic: "" }) });
  }
  if (filters.duration) {
    chips.push({ label: DURATION_LABELS[filters.duration], clear: () => onChange({ duration: "" }) });
  }
  if (filters.dateFrom || filters.dateTo) {
    chips.push({
      label: `${filters.dateFrom || "…"} → ${filters.dateTo || "…"}`,
      clear: () => onChange({ dateFrom: "", dateTo: "" }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip, i) => (
        <button
          key={`${chip.label}-${i}`}
          type="button"
          onClick={chip.clear}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-stage pl-3 pr-2 text-sm font-medium text-stage-ink transition-colors hover:bg-stage-raised"
        >
          {chip.label}
          <span aria-hidden className="text-base leading-none">×</span>
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            orgIds: [],
            eventIds: [],
            speaker: "",
            topic: "",
            duration: "",
            dateFrom: "",
            dateTo: "",
          })
        }
        className="px-1 text-[13px] font-medium text-ink-faint underline-offset-2 hover:text-ink hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
