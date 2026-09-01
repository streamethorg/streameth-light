import Link from "next/link";
import { initials, tagColorFor } from "@/lib/format";
import type { DirectoryEntry } from "@/lib/directory";

function coverageLabel(entry: DirectoryEntry): string {
  if (entry.sessionCount > 0) {
    return `${entry.sessionCount} video${entry.sessionCount === 1 ? "" : "s"}`;
  }
  if (entry.youtubeVideoCount > 0) {
    return `${entry.youtubeVideoCount} on YouTube`;
  }
  if (entry.miraEventCount > 0) {
    return `${entry.miraEventCount} tracked event${entry.miraEventCount === 1 ? "" : "s"}`;
  }
  if (entry.youtubeChannel) return "on YouTube";
  return "no video yet";
}

export default function ChannelCard({
  entry,
  index,
}: {
  entry: DirectoryEntry;
  index: number;
}) {
  const hasContent =
    entry.sessionCount > 0 || entry.youtubeVideoCount > 0 || entry.miraEventCount > 0;
  const color = tagColorFor(entry.slug);
  const channelNo = String(index + 1).padStart(2, "0");

  return (
    <Link
      href={`/${entry.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-md border border-line bg-panel transition-colors hover:border-line hover:bg-panel-raised"
      style={{ "--tab-color": `var(--color-${color})` } as React.CSSProperties}
    >
      <span
        className="absolute inset-y-0 left-0 w-[3px] transition-[width] duration-150 group-hover:w-1"
        style={{ background: hasContent ? "var(--tab-color)" : "var(--color-line)" }}
      />

      <div className="flex items-start justify-between gap-2 px-5 pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          CH·{channelNo}
        </span>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm font-display text-xs font-bold"
          style={{
            color: hasContent ? "var(--tab-color)" : "var(--ink-faint)",
            background: "var(--panel-raised)",
          }}
        >
          {initials(entry.name)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-5 pb-4 pt-3">
        <h2 className="font-display text-sm font-bold leading-snug text-ink">
          {entry.name}
        </h2>
        {entry.location && (
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
            {entry.location}
          </p>
        )}
      </div>

      <p
        className="mt-auto border-t border-line px-5 py-2.5 font-mono text-[11px] tabular"
        style={{ color: hasContent ? "var(--tab-color)" : "var(--ink-faint)" }}
      >
        {coverageLabel(entry)}
      </p>
    </Link>
  );
}
