import Link from "next/link";
import Avatar from "./Avatar";
import CoverPlaceholder from "./CoverPlaceholder";

/** Shared visual chrome for a video grid tile — cover image, duration/source
 * badges, org avatar, title, and meta lines. VideoCard and UnifiedVideoCard
 * both normalize their data shape into this so the card markup lives once. */
export default function VideoTile({
  href,
  coverImage,
  coverLabel,
  durationLabel,
  sourceBadge,
  orgName,
  title,
  metaLine,
  extraLine,
}: {
  href: string;
  coverImage?: string | null;
  coverLabel: string;
  durationLabel?: string;
  sourceBadge?: string;
  orgName?: string | null;
  title: string;
  metaLine?: string;
  extraLine?: string;
}) {
  return (
    <Link href={href} className="group flex flex-col gap-2.5">
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-panel shadow-none transition-shadow duration-200 group-hover:shadow-md">
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <CoverPlaceholder label={coverLabel} />
        )}
        {durationLabel && (
          <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-black/80 px-1.5 py-0.5 font-mono text-[10px] tabular text-white">
            {durationLabel}
          </span>
        )}
        {sourceBadge && (
          <span className="absolute left-1.5 top-1.5 rounded-sm bg-black/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white">
            {sourceBadge}
          </span>
        )}
        <span className="absolute inset-0 ring-1 ring-inset ring-white/5 transition-colors group-hover:ring-accent/40" />
      </div>
      <div className="flex gap-2.5">
        {orgName && <Avatar name={orgName} className="mt-0.5 h-8 w-8 text-[10px]" />}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-ink transition-colors group-hover:text-accent">
            {title}
          </h3>
          {orgName && <p className="truncate text-xs text-ink-dim">{orgName}</p>}
          {metaLine && (
            <p className="truncate font-mono text-[11px] text-ink-faint">{metaLine}</p>
          )}
          {extraLine && (
            <p className="truncate font-mono text-[11px] text-ink-faint">{extraLine}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
