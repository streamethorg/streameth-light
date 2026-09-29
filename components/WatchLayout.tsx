import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import Avatar from "@/components/Avatar";
import DescriptionBox from "@/components/DescriptionBox";
import { WATCH_ACTIONS_SLOT_ID } from "@/components/ActionButton";
import { accentStyle } from "@/lib/format";

/** The one watch-page shell every video-detail page renders through —
 * StreamETH-hosted sessions, standalone YouTube videos, and YouTube videos
 * browsed inside an inferred event group — laid out like YouTube's: player,
 * title, channel row with actions, grey description box and speakers on
 * the left; a compact "Up next" column on the right (below on mobile).
 * `player` supplies its own aspect-video chrome (see SessionPlayer /
 * YoutubeSessionPlayer), since those also render the Listen control. */
export default function WatchLayout({
  accentColor,
  orgName,
  orgSlug,
  crumb,
  player,
  title,
  actions,
  metaLine,
  speakers,
  topics,
  description,
  transcript,
  relatedLabel,
  related,
}: {
  accentColor?: string;
  orgName?: string;
  orgSlug?: string;
  crumb?: string;
  player: ReactNode;
  title: string;
  actions?: ReactNode;
  metaLine?: string;
  speakers?: ReactNode;
  topics?: ReactNode;
  description?: string;
  transcript?: string | null;
  relatedLabel: string;
  related: ReactNode;
}) {
  return (
    <div
      style={accentStyle(accentColor) as CSSProperties | undefined}
      className="mx-auto flex w-full max-w-[1760px] flex-col gap-6 px-0 pb-12 sm:px-6 sm:pt-6 lg:flex-row"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {player}

        <div className="flex flex-col gap-3 px-3 sm:px-0">
          <h1 className="text-xl font-bold leading-7 tracking-[-0.01em] text-ink">{title}</h1>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {orgName && (
              <div className="flex min-w-0 items-center gap-3">
                {orgSlug ? (
                  <Link href={`/${orgSlug}`} tabIndex={-1} aria-hidden="true">
                    <Avatar name={orgName} channel className="h-10 w-10 text-sm" />
                  </Link>
                ) : (
                  <Avatar name={orgName} channel className="h-10 w-10 text-sm" />
                )}
                <div className="flex min-w-0 flex-col">
                  {orgSlug ? (
                    <Link href={`/${orgSlug}`} className="truncate rounded-sm text-base font-semibold text-ink">
                      {orgName}
                    </Link>
                  ) : (
                    <span className="truncate text-base font-semibold text-ink">{orgName}</span>
                  )}
                  {crumb && <span className="truncate text-xs text-ink-dim">{crumb}</span>}
                </div>
              </div>
            )}
            <div className="-mx-3 flex w-[calc(100%+1.5rem)] items-center gap-2 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0">
              <div id={WATCH_ACTIONS_SLOT_ID} className="contents" />
              {actions}
            </div>
          </div>

          <DescriptionBox meta={metaLine} topics={topics} description={description} transcript={transcript} />

          {speakers && (
            <div className="flex flex-col gap-4 pt-4">
              <h2 className="text-xl font-bold text-ink">Speakers</h2>
              {speakers}
            </div>
          )}
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-3 px-3 sm:px-0 lg:w-[400px]">
        <h2 className="text-base font-semibold text-ink">{relatedLabel}</h2>
        <div className="flex flex-col gap-3">{related}</div>
      </aside>
    </div>
  );
}
