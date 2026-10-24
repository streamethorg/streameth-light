import Link from "next/link";
import CoverImage from "./CoverImage";
import type { AskSource } from "@/lib/ask";

/** A cited talk: cover, which citation numbers point at it, event and date,
 * title and speakers. */
export default function SourceCard({ source, citations }: { source: AskSource; citations: number[] }) {
  return (
    <Link
      href={source.watchUrl}
      className="group flex gap-4 border-t border-line pt-3 transition-colors"
    >
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-sm border border-line bg-panel-raised">
        <CoverImage src={source.coverImage} label={source.title} />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-1.5 text-xs text-ink-faint">
          {citations.map((n) => (
            <span key={n} className="font-semibold tabular-nums text-ink-dim">
              {n}
            </span>
          ))}
          <span className="truncate tabular-nums">{[source.event || source.channel, source.date].filter(Boolean).join(" · ")}</span>
        </p>
        <p className="line-clamp-2 text-[17px] font-semibold leading-[1.3rem] tracking-[-0.01em] text-ink transition-colors group-hover:text-ink-dim">
          {source.title}
        </p>
        {source.speakers.length > 0 && (
          <p className="truncate text-xs font-medium text-ink-dim">{source.speakers.join(", ")}</p>
        )}
      </div>
    </Link>
  );
}
