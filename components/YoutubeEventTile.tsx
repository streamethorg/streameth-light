import Link from "next/link";
import type { InferredEventGroup } from "@/lib/youtube";
import { formatDateShort } from "@/lib/format";
import CoverPlaceholder from "./CoverPlaceholder";

export default function YoutubeEventTile({
  orgSlug,
  group,
}: {
  orgSlug: string;
  group: InferredEventGroup;
}) {
  const latest = group.videos[0];

  return (
    <Link
      href={`/${orgSlug}/y/${group.slug}`}
      className="group flex flex-col overflow-hidden rounded-md border border-line bg-panel transition-colors hover:border-accent/50"
    >
      <div className="relative aspect-[2/1] w-full overflow-hidden bg-panel-raised">
        {latest.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={latest.thumbnail}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <CoverPlaceholder label={group.label} />
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-void/85 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink">
          YouTube
        </span>
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <h2 className="font-display text-sm font-bold leading-snug text-ink group-hover:text-accent">
          {group.label}
        </h2>
        {latest.publishedAt && (
          <p className="font-mono text-[11px] text-ink-faint">
            {formatDateShort(latest.publishedAt)}
          </p>
        )}
        <p className="font-mono text-[11px] tabular text-ink-dim">
          {String(group.videos.length).padStart(2, "0")} video
          {group.videos.length === 1 ? "" : "s"}
        </p>
      </div>
    </Link>
  );
}
