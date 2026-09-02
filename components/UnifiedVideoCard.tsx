import Link from "next/link";
import type { UnifiedVideo } from "@/lib/videoDb";
import { formatDateShort, formatTimecode, initials } from "@/lib/format";
import CoverPlaceholder from "./CoverPlaceholder";

export default function UnifiedVideoCard({ video }: { video: UnifiedVideo }) {
  return (
    <Link href={video.watchUrl} className="group flex flex-col gap-2.5">
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-panel">
        {video.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.coverImage}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <CoverPlaceholder label={video.title} />
        )}
        {video.durationSeconds !== null && (
          <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-void/85 px-1.5 py-0.5 font-mono text-[10px] tabular text-ink">
            {formatTimecode(video.durationSeconds)}
          </span>
        )}
        {video.source === "youtube" && (
          <span className="absolute left-1.5 top-1.5 rounded-sm bg-void/85 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink-dim">
            YouTube
          </span>
        )}
        <span className="absolute inset-0 ring-1 ring-inset ring-white/5 transition-colors group-hover:ring-accent/40" />
      </div>
      <div className="flex gap-2.5">
        {video.orgName && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel text-[10px] font-medium text-ink-dim">
            {initials(video.orgName)}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-ink transition-colors group-hover:text-accent">
            {video.title}
          </h3>
          {video.orgName && <p className="truncate text-xs text-ink-dim">{video.orgName}</p>}
          <p className="truncate font-mono text-[11px] text-ink-faint">
            {video.eventName || (video.source === "youtube" ? "YouTube" : "")}
            {video.publishedAt ? ` · ${formatDateShort(video.publishedAt)}` : ""}
          </p>
          {video.speakers.length > 0 && (
            <p className="truncate font-mono text-[11px] text-ink-faint">
              {video.speakers.join(", ")}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
