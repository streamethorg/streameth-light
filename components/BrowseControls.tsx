"use client";

import { usePathname, useRouter } from "next/navigation";
import FilterPanel from "@/components/FilterPanel";
import type { BrowseFilters } from "@/lib/browseParams";
import { paramsFromFilters } from "@/lib/browseParams";
import type { OrgOption } from "@/lib/videoDb";
import type { Event } from "@/lib/types";

export default function BrowseControls({
  filters,
  channels,
  events,
  orgIdBySlug,
  topics,
}: {
  filters: BrowseFilters;
  channels: OrgOption[];
  events: Event[];
  orgIdBySlug: Record<string, string>;
  topics: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(patch: Partial<BrowseFilters>) {
    const next = { ...filters, ...patch };
    router.push(`${pathname}?${paramsFromFilters(next).toString()}`, { scroll: false });
  }

  return (
    <FilterPanel
      filters={filters}
      channels={channels}
      events={events}
      orgIdBySlug={orgIdBySlug}
      topics={topics}
      hasQuery={Boolean(filters.q.trim())}
      onChange={handleChange}
    />
  );
}
