import Link from "next/link";
import type { ReactNode } from "react";
import Avatar from "./Avatar";
import CoverImage from "./CoverImage";

export type VideoTileLayout = "grid" | "row" | "compact";

/** A video, the way YouTube lays one out:
 * - `grid`: thumbnail on top, then channel avatar beside title/channel/meta
 * - `row`: search-result row — big thumbnail left, details and snippet right
 * - `compact`: small thumbnail left, for the watch page's "Up next" column
 * The thumbnail, title and channel are separate links (as on YouTube), so
 * the channel avatar/name go to the channel rather than the video. */
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
      ? "w-40 rounded-lg sm:w-[168px]"
      : layout === "row"
        ? "w-full rounded-xl sm:w-[360px]"
        : "w-full rounded-xl";
  const thumb = videoLink(
    `relative block aspect-video shrink-0 overflow-hidden bg-panel-raised ${thumbSize}`,
    <>
      <CoverImage src={coverImage} label={coverLabel} />
      {durationLabel && (
        <span className="tabular absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1 py-px text-xs font-medium text-white">
          {durationLabel}
        </span>
      )}
    </>,
    -1
  );

  const titleSize =
    layout === "row"
      ? "text-lg leading-6"
      : layout === "compact"
        ? "text-sm leading-5"
        : "text-base leading-[1.375rem]";
  const titleEl = videoLink(
    "rounded-sm text-ink",
    <h3 className={`line-clamp-2 font-semibold ${titleSize}`} title={title}>
      {title}
    </h3>
  );

  const channelName = channel ? (
    channel.href ? (
      <Link href={channel.href} className="truncate rounded-sm hover:text-ink">
        {channel.name}
      </Link>
    ) : (
      <span className="truncate">{channel.name}</span>
    )
  ) : null;

  const metaLine = [event && event !== channel?.name ? event : "", date ?? ""].filter(Boolean).join(" • ");
  const metaSize = layout === "compact" ? "text-xs" : "text-sm";

  if (layout === "grid") {
    return (
      <div className="flex flex-col gap-3">
        {thumb}
        <div className="flex gap-3 pr-2">
          {channel &&
            (channel.href ? (
              <Link href={channel.href} tabIndex={-1} className="shrink-0" aria-hidden="true">
                <Avatar name={channel.name} channel className="h-9 w-9 text-xs" />
              </Link>
            ) : (
              <Avatar name={channel.name} channel className="h-9 w-9 text-xs" />
            ))}
          <div className="flex min-w-0 flex-col gap-1">
            {titleEl}
            <div className={`flex min-w-0 flex-col ${metaSize} text-ink-dim`}>
              {channelName}
              {speakers && <span className="truncate">{speakers}</span>}
              {metaLine && <span className="tabular truncate">{metaLine}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (layout === "compact") {
    return (
      <div className="flex gap-2">
        {thumb}
        <div className="flex min-w-0 flex-col gap-1 py-0.5">
          {titleEl}
          <div className={`flex min-w-0 flex-col ${metaSize} text-ink-dim`}>
            {channelName}
            {metaLine && <span className="tabular truncate">{metaLine}</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      {thumb}
      <div className="flex min-w-0 flex-col gap-1.5 py-0.5">
        {titleEl}
        {metaLine && <p className="tabular text-xs text-ink-dim">{metaLine}</p>}
        {channel && (
          <div className="flex items-center gap-2 py-1.5 text-xs text-ink-dim">
            <Avatar name={channel.name} channel className="h-6 w-6 text-[9px]" />
            {channelName}
          </div>
        )}
        {speakers && <p className="truncate text-xs text-ink-dim">{speakers}</p>}
        {description && (
          <p className="line-clamp-2 text-xs leading-5 text-ink-dim">{description}</p>
        )}
      </div>
    </div>
  );
}
