import Link from "next/link";
import type { ReactNode } from "react";
import CoverImage from "./CoverImage";

/** An event: cover (or the newest talk's thumbnail) with a talk-count
 * badge, then name, channel, and when/where — laid out like a YouTube
 * playlist card. Shared by every event listing so they look like one thing. */
export default function EventTile({
  href,
  cover,
  title,
  count,
  channel,
  when,
  where,
  badge,
}: {
  href: string;
  cover?: string | null;
  title: string;
  /** Recordings so far; the badge is left off at zero (an upcoming event). */
  count: number;
  channel?: string;
  when?: string;
  where?: string;
  /** Shown over the cover's top-left corner, e.g. a Live or Coming up chip. */
  badge?: ReactNode;
}) {
  return (
    <Link href={href} className="group flex flex-col gap-3 outline-offset-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-panel-raised">
        <CoverImage src={cover} label={title} />
        {badge && <span className="absolute left-2 top-2">{badge}</span>}
        {count > 0 && (
          <span className="tabular absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-sm bg-black/70 px-1.5 py-px text-[11px] font-medium text-white">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              <path d="M3 5.5h10v1.5H3zM3 9h10v1.5H3zM3 12.5h6V14H3zM12 11.5l5 3-5 3z" />
            </svg>
            {count.toLocaleString()} {count === 1 ? "talk" : "talks"}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="line-clamp-2 text-[18px] font-semibold leading-6 text-ink transition-colors group-hover:text-ink-dim" title={title}>
          {title}
        </h3>
        <div className="flex min-w-0 flex-col text-sm text-ink-dim">
          {channel && <span className="truncate">{channel}</span>}
          {(when || where) && (
            <span className="tabular truncate">{[when, where].filter(Boolean).join(" • ")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
