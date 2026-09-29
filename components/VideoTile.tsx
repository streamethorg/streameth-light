import Link from "next/link";
import CoverImage from "./CoverImage";

/** Shared chrome for a video tile: cover with duration, then title, who
 * spoke, and where/when. VideoCard, UnifiedVideoCard, YoutubeVideoCard and
 * the saved list all normalize into this so the card markup lives once.
 * `lead` is the oversized first tile of an editorial grid. */
export default function VideoTile({
  href,
  coverImage,
  coverLabel,
  durationLabel,
  title,
  speakers,
  source,
  date,
  external = false,
  lead = false,
}: {
  href: string;
  coverImage?: string | null;
  coverLabel: string;
  durationLabel?: string;
  title: string;
  /** Speaker names, already joined. */
  speakers?: string;
  /** Where it was recorded: the event, or the channel when there's no event. */
  source?: string;
  date?: string;
  /** Opens off-site (youtube.com) in a new tab instead of an in-app route. */
  external?: boolean;
  lead?: boolean;
}) {
  const body = (
    <>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-stage">
        <CoverImage
          src={coverImage}
          label={coverLabel}
          loading={lead ? "eager" : "lazy"}
          className="transition duration-300 ease-out group-hover:scale-[1.02]"
        />
        {durationLabel && (
          <span className="tabular absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {durationLabel}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h3
          className={`line-clamp-2 font-semibold text-ink decoration-accent decoration-2 underline-offset-[5px] group-hover:underline ${
            lead
              ? "text-2xl leading-tight tracking-[-0.025em] sm:text-[1.75rem]"
              : "text-[15px] leading-snug tracking-[-0.01em]"
          }`}
        >
          {title}
        </h3>
        {speakers && (
          <p className={`truncate text-ink-dim ${lead ? "text-base" : "text-[13px]"}`}>{speakers}</p>
        )}
        {(source || date) && (
          <p className={`flex min-w-0 gap-2.5 text-ink-faint ${lead ? "text-sm" : "text-[13px]"}`}>
            {source && <span className="truncate">{source}</span>}
            {date && <span className="tabular shrink-0">{date}</span>}
          </p>
        )}
      </div>
    </>
  );

  const className = `group flex flex-col rounded-lg outline-offset-4 ${lead ? "gap-4" : "gap-3"}`;
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
