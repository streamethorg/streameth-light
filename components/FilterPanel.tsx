"use client";

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
  const selectedOrgIds = filters.orgIds.map((slug) => orgIdBySlug[slug]).filter(Boolean);
  const eventOptions =
    selectedOrgIds.length > 0
      ? events.filter((e) => selectedOrgIds.includes(e.organizationId))
      : events;

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        <select
          value={filters.orgIds[0] ?? ""}
          onChange={(e) => onChange({ orgIds: e.target.value ? [e.target.value] : [], eventIds: [] })}
          className="h-10 max-w-[16rem] shrink-0 cursor-pointer rounded-full bg-panel pl-4 pr-3 text-sm font-medium text-ink shadow-sm ring-1 ring-line transition-colors hover:ring-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
          className="h-10 max-w-[16rem] shrink-0 cursor-pointer rounded-full bg-panel pl-4 pr-3 text-sm font-medium text-ink shadow-sm ring-1 ring-line transition-colors hover:ring-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
          className="h-10 max-w-[16rem] shrink-0 cursor-pointer rounded-full bg-panel pl-4 pr-3 text-sm font-medium text-ink shadow-sm ring-1 ring-line transition-colors hover:ring-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="">Any length</option>
          {(Object.keys(DURATION_LABELS) as DurationBucket[]).map((bucket) => (
            <option key={bucket} value={bucket}>
              {DURATION_LABELS[bucket]}
            </option>
          ))}
        </select>

        <label className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-panel px-4 text-sm font-medium text-ink-faint shadow-sm ring-1 ring-line focus-within:ring-2 focus-within:ring-accent">
          From
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            className="bg-transparent text-ink focus:outline-none [color-scheme:light]"
          />
        </label>
        <label className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-panel px-4 text-sm font-medium text-ink-faint shadow-sm ring-1 ring-line focus-within:ring-2 focus-within:ring-accent">
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
          className="h-10 shrink-0 cursor-pointer rounded-full bg-stage pl-4 pr-4 text-sm font-semibold text-stage-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-60 sm:ml-auto"
        >
          {SORT_OPTIONS.filter((o) => o.value !== "relevance" || hasQuery).map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </select>
      </div>

      {topics.length > 0 && (
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          <span className="mr-1 shrink-0 text-sm font-medium text-ink-faint">Topics</span>
          {topics.map((topic) => {
            const active = filters.topic.toLowerCase() === topic.toLowerCase();
            return (
              <button
                key={topic}
                type="button"
                onClick={() => onChange({ topic: active ? "" : topic })}
                aria-pressed={active}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-accent text-accent-ink"
                    : "bg-panel-raised text-ink-dim hover:bg-accent/10 hover:text-accent"
                }`}
              >
                {topic}
              </button>
            );
          })}
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
          className="flex items-center gap-1.5 rounded-full bg-accent/10 py-1 pl-3 pr-2 text-[13px] font-medium text-accent transition-colors hover:bg-accent hover:text-accent-ink"
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
