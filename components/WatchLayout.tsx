import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import TranscriptPanel from "@/components/TranscriptPanel";
import Avatar from "@/components/Avatar";
import SectionHeader from "@/components/SectionHeader";
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
    <div style={accentStyle(accentColor) as CSSProperties | undefined} className="flex flex-1 flex-col">
      <section className="bg-stage text-stage-ink">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-6 pt-5 sm:px-6 sm:pb-8">
          {orgName && orgSlug && (
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stage-dim">
              <Link
                href={`/${orgSlug}`}
                className="flex items-center gap-2 rounded-md font-semibold text-stage-ink transition-colors hover:text-peach"
              >
                <Avatar name={orgName} shape="square" className="h-6 w-6 text-[9px]" />
                {orgName}
              </Link>
              {crumb && (
                <>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3.5 w-3.5 opacity-60" aria-hidden="true">
                    <path d="M7.5 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{crumb}</span>
                </>
              )}
            </nav>
          )}

          {player}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="display max-w-4xl text-[clamp(1.75rem,3.4vw,2.75rem)] leading-[1.05] text-ink">
              {title}
            </h1>
            {metaLine && <p className="tabular text-sm font-medium text-ink-faint">{metaLine}</p>}
          </div>
          {(actions || transcript) && (
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              {transcript && <TranscriptPanel text={transcript} />}
            </div>
          )}
          {topics}
          {description && (
            <p className="max-w-[70ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-dim">
              {description}
            </p>
          )}
        </div>

        {speakers && (
          <div className="flex flex-col gap-4">
            <SectionHeader title="Speakers" />
            {speakers}
          </div>
        )}

        <div className="flex flex-col gap-5">
          <SectionHeader title={relatedLabel} href={orgSlug ? `/${orgSlug}` : undefined} linkLabel="Open channel" />
          <div className="grid grid-cols-1 gap-x-5 gap-y-10 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {related}
          </div>
        </div>
      </div>
    </div>
  );
}
