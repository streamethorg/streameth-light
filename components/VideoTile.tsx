import Link from "next/link";
import Avatar from "./Avatar";
import CoverImage from "./CoverImage";

/** Shared visual chrome for a video grid tile — cover image, duration,
 * channel logo, title, and meta lines. VideoCard and UnifiedVideoCard both
 * normalize their data shape into this so the card markup lives once. */
export default function VideoTile({
  href,
  coverImage,
  coverLabel,
  durationLabel,
  orgName,
  orgLogo,
  title,
  metaLine,
  extraLine,
  external = false,
}: {
  href: string;
  coverImage?: string | null;
  coverLabel: string;
  durationLabel?: string;
  orgName?: string | null;
  orgLogo?: string | null;
  title: string;
  metaLine?: string;
  extraLine?: string;
  /** Opens off-site (youtube.com) in a new tab instead of an in-app route. */
  external?: boolean;
}) {
  const body = (
    <>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-stage">
        <CoverImage
          src={coverImage}
          label={coverLabel}
          className="transition duration-300 ease-out group-hover:scale-[1.03] group-hover:brightness-[0.8]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-stage shadow-lg">
            <svg viewBox="0 0 20 20" fill="currentColor" className="ml-0.5 h-4 w-4">
              <path d="M6.3 3.2A1 1 0 004.8 4v12a1 1 0 001.5.87l10-6a1 1 0 000-1.74l-10-6z" />
            </svg>
          </span>
        </span>
        {durationLabel && (
          <span className="tabular absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            {durationLabel}
          </span>
        )}
        <span className="brand-gradient absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100" />
      </div>
      <div className="flex gap-3">
        {orgName && (
          <Avatar name={orgName} photo={orgLogo} shape="square" className="mt-0.5 h-8 w-8 text-[10px]" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink transition-colors group-hover:text-accent">
            {title}
          </h3>
          <div className="flex flex-col text-[13px] leading-5 text-ink-faint">
            {orgName && <p className="truncate font-medium text-ink-dim">{orgName}</p>}
            {metaLine && <p className="truncate">{metaLine}</p>}
            {extraLine && <p className="truncate">{extraLine}</p>}
          </div>
        </div>
      </div>
    </>
  );

  const className = "group flex flex-col gap-3 rounded-lg outline-offset-4";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}
