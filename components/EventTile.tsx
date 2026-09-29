import Link from "next/link";
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
}: {
  href: string;
  cover?: string | null;
  title: string;
  count: number;
  channel?: string;
  when?: string;
  where?: string;
}) {
  return (
    <Link href={href} className="group flex flex-col gap-3 rounded-xl outline-offset-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-panel-raised">
        <CoverImage src={cover} label={title} />
        <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-px text-xs font-medium text-white">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M3 5.5h10v1.5H3zM3 9h10v1.5H3zM3 12.5h6V14H3zM12 11.5l5 3-5 3z" />
          </svg>
          {count.toLocaleString()} {count === 1 ? "talk" : "talks"}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="line-clamp-2 text-base font-semibold leading-[1.375rem] text-ink" title={title}>
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
