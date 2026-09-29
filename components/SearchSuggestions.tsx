import Link from "next/link";
import CoverImage from "./CoverImage";
import { formatTimecode } from "@/lib/format";
import type { Suggestion } from "@/lib/useSearchSuggestions";

export default function SearchSuggestions({
  results,
  onSelect,
}: {
  results: Suggestion[];
  onSelect: () => void;
}) {
  if (results.length === 0) return null;

  return (
    <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl bg-panel p-1.5 text-left shadow-2xl ring-1 ring-black/5">
      {results.map((r) => (
        <Link
          key={r.id}
          href={r.watchUrl}
          onClick={onSelect}
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-panel-raised focus-visible:bg-panel-raised"
        >
          <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-stage">
            <CoverImage src={r.coverImage} label={r.title} />
            {r.durationSeconds !== null && (
              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 py-px text-[9px] font-semibold tabular text-white">
                {formatTimecode(r.durationSeconds)}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="line-clamp-1 text-sm font-medium text-ink">{r.title}</p>
            {r.orgName && (
              <p className="truncate text-xs text-ink-faint">{r.orgName}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
