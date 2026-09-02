import Link from "next/link";
import CoverPlaceholder from "./CoverPlaceholder";
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
    <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-md border border-line bg-panel shadow-lg">
      {results.map((r) => (
        <Link
          key={r.id}
          href={r.watchUrl}
          onClick={onSelect}
          className="flex items-center gap-3 px-3 py-2 hover:bg-panel-raised"
        >
          <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-sm bg-panel-raised">
            {r.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.coverImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <CoverPlaceholder label={r.title} />
            )}
            {r.durationSeconds !== null && (
              <span className="absolute bottom-0.5 right-0.5 rounded-sm bg-black/80 px-1 py-0.5 font-mono text-[9px] tabular text-white">
                {formatTimecode(r.durationSeconds)}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="line-clamp-1 text-sm text-ink">{r.title}</p>
            {r.orgName && (
              <p className="truncate text-xs text-ink-faint">{r.orgName}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
