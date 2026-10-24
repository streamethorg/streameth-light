import Link from "next/link";
import type { ReactNode } from "react";
import CoverImage from "./CoverImage";

export type VideoTileLayout = "grid" | "card" | "row" | "compact";

/** A talk, the way a conference program lists one: who's speaking first,
 * then the title, then where/when.
 * - `grid`: thumbnail on top, text below; a small-thumbnail row on phones
 * - `card`: thumbnail on top at every width, for swipeable carousels
 * - `row`: search-result row — big thumbnail left, details and snippet right
 * - `compact`: small thumbnail left, for side columns
 * The thumbnail, title and channel are separate links, so the channel name
 * goes to the channel rather than the video. */
export default function VideoTile({
  href,
  coverImage,
  coverLabel,
  durationLabel,
  title,
  channel,
  speakers,
  event,
  date,
  description,
  external = false,
  layout = "grid",
}: {
  href: string;
  coverImage?: string | null;
  coverLabel: string;
  durationLabel?: string;
  title: string;
  channel?: { name: string; href?: string };
  /** Speaker names, already joined. */
  speakers?: string;
  /** Event the talk was recorded at, when it differs from the channel. */
  event?: string;
  date?: string;
  description?: string;
  /** Opens off-site (youtube.com) in a new tab instead of an in-app route. */
  external?: boolean;
  layout?: VideoTileLayout;
}) {
  const videoLink = (className: string, children: ReactNode, tabIndex?: number) =>
    external ? (
      <a href={href} target="_blank" rel="noreferrer" className={className} tabIndex={tabIndex}>
        {children}
      </a>
    ) : (
      <Link href={href} className={className} tabIndex={tabIndex}>
        {children}
      </Link>
    );

  const thumbSize =
    layout === "compact"
      ? "w-40 rounded-sm sm:w-[168px]"
      : layout === "row"
        ? "w-full rounded-sm sm:w-[320px]"
        : layout === "card"
          ? "w-full rounded-sm"
          : "w-[42%] rounded-sm sm:w-full";
  const thumb = videoLink(
    `relative block aspect-video shrink-0 overflow-hidden bg-panel-raised ${thumbSize}`,
    <>
      <CoverImage src={coverImage} label={coverLabel} />
      {durationLabel && (
        <span className="tabular absolute bottom-1.5 right-1.5 rounded-sm bg-black/70 px-1 py-px text-[11px] font-medium text-white">
          {durationLabel}
        </span>
      )}
    </>,
    -1
  );

  const titleSize =
    layout === "row"
      ? "text-[19px] leading-6"
      : layout === "compact"
        ? "text-[15px] leading-5"
        : layout === "card"
          ? "text-[16px] leading-[1.35rem]"
          : "text-[15px] leading-5 sm:text-[16px] sm:leading-[1.35rem]";
  const titleEl = videoLink(
    "rounded-sm text-ink transition-colors hover:text-ink-dim",
    <h3 className={`line-clamp-2 font-semibold ${titleSize}`} title={title}>
      {title}
    </h3>
  );

  const speakerSize = layout === "compact" ? "text-xs" : "text-[13px]";
  const speakerEl = speakers ? (
    <p className={`truncate font-medium text-ink-dim ${speakerSize}`} title={speakers}>
      {speakers}
    </p>
  ) : null;

  const channelEl = channel ? (
    channel.href ? (
      <Link href={channel.href} className="rounded-sm hover:text-ink">
        {channel.name}
      </Link>
    ) : (
      <span>{channel.name}</span>
    )
  ) : null;

  // Where, then when: the event (or the channel when no event is known),
  // then the date. One line, dot-separated.
  const where = event && event !== channel?.name ? <span>{event}</span> : channelEl;
  const metaParts = [where, date ? <span className="tabular">{date}</span> : null].filter(Boolean);
  const metaSize = layout === "compact" ? "text-xs" : "text-[13px]";
  const metaEl =
    metaParts.length > 0 ? (
      <p className={`truncate text-ink-faint ${metaSize}`}>
        {metaParts.map((part, i) => (
          <span key={i}>
            {i > 0 && <span aria-hidden="true"> · </span>}
            {part}
          </span>
        ))}
      </p>
    ) : null;

  // On phones a grid tile is a row (small thumbnail left), so a list of
  // talks doesn't take a full screen per talk.
  if (layout === "grid" || layout === "card") {
    const stack = layout === "card" ? "flex-col gap-2.5" : "gap-3 sm:flex-col sm:gap-2.5";
    return (
      <div className={`flex ${stack}`}>
        {thumb}
        <div className={`flex min-w-0 flex-col gap-0.5 ${layout === "card" ? "pr-2" : "sm:pr-2"}`}>
          {speakerEl}
          {titleEl}
          <div className="pt-0.5">{metaEl}</div>
        </div>
      </div>
    );
  }

  if (layout === "compact") {
    return (
      <div className="flex gap-3">
        {thumb}
        <div className="flex min-w-0 flex-col gap-0.5 py-0.5">
          {speakerEl}
          {titleEl}
          {metaEl}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-5">
      {thumb}
      <div className="flex min-w-0 flex-col gap-1 py-0.5">
        {speakerEl}
        {titleEl}
        {metaEl}
        {description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-ink-dim">{description}</p>
        )}
      </div>
    </div>
  );
}
