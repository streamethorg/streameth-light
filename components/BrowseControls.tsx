"use client";

import { usePathname, useRouter } from "next/navigation";
import FilterPanel from "@/components/FilterPanel";
import type { BrowseFilters } from "@/lib/browseParams";
import { paramsFromFilters } from "@/lib/browseParams";
import type { Event, Organization } from "@/lib/types";

export default function BrowseControls({
  filters,
  organizations,
  events,
  topics,
}: {
  filters: BrowseFilters;
  organizations: Organization[];
  events: Event[];
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
      organizations={organizations}
      events={events}
      topics={topics}
      hasQuery={Boolean(filters.q.trim())}
      onChange={handleChange}
    />
  );
}
