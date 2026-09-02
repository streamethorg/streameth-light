import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import TranscriptPanel from "@/components/TranscriptPanel";
import Avatar from "@/components/Avatar";
import { accentStyle } from "@/lib/format";

/** The one shell every video-detail page renders through — StreamETH-hosted
 * sessions, standalone YouTube videos, and YouTube videos browsed inside an
 * inferred event group all use this, so the underlying data source never
 * produces a visually different page (breadcrumb, player, title/meta,
 * description, related grid). Only the player and data lookup differ.
 * `player` must supply its own aspect-video/border/bg-black chrome (see
 * SessionPlayer/YoutubeSessionPlayer), since those also render a
 * "Listen (audio only)" control below the video box itself. */
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
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6"
    >
      {orgName && orgSlug && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-xs uppercase tracking-wide text-ink-faint">
          <Link href={`/${orgSlug}`} className="flex items-center gap-2 transition-colors hover:text-accent">
            <Avatar name={orgName} className="h-5 w-5 text-[9px] normal-case" />
            {orgName}
          </Link>
          {crumb && (
            <>
              <span>/</span>
              <span className="normal-case tracking-normal">{crumb}</span>
            </>
          )}
        </div>
      )}

      {player}

      <div className="flex flex-col gap-3 border-b border-line pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
            {title}
          </h1>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
        {metaLine && <p className="font-mono text-xs tabular text-ink-faint">{metaLine}</p>}
        {topics}
        {description && (
          <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-dim">
            {description}
          </p>
        )}
      </div>

      {speakers}

      {transcript && <TranscriptPanel text={transcript} />}

      <div className="flex flex-col gap-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-ink-dim">
          {relatedLabel}
        </h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {related}
        </div>
      </div>
    </div>
  );
}
