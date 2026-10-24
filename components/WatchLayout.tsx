import Link from "next/link";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import DescriptionBox from "@/components/DescriptionBox";
import TranscriptPanel from "@/components/TranscriptPanel";
import AskTalk from "@/components/AskTalk";
import { WATCH_ACTIONS_SLOT_ID } from "@/components/ActionButton";
import { accentStyle } from "@/lib/format";

/** The one watch-page shell every video-detail page renders through —
 * StreamETH-hosted sessions, standalone YouTube videos, and YouTube videos
 * browsed inside an inferred event group. Left: the player, the title,
 * where/when and the actions, then the session info card (speakers,
 * description, "Ask AI about this talk") and the searchable transcript.
 * Right, beside the player: more talks from the same event. `player` supplies its own
 * aspect-video chrome (see SessionPlayer / YoutubeSessionPlayer). */
export default function WatchLayout({
  accentColor,
  orgName,
  orgSlug,
  crumb,
  crumbHref,
  player,
  title,
  speakerNames,
  actions,
  metaLine,
  speakers,
  topics,
  description,
  transcript,
  relatedLabel,
  related,
  videoId,
  pinPlayer = true,
}: {
  accentColor?: string;
  orgName?: string;
  orgSlug?: string;
  /** Event (or group) the talk belongs to. */
  crumb?: string;
  crumbHref?: string;
  player: ReactNode;
  title: string;
  speakerNames?: string[];
  actions?: ReactNode;
  metaLine?: string;
  speakers?: ReactNode;
  topics?: ReactNode;
  description?: string;
  transcript?: string | null;
  relatedLabel: string;
  related: ReactNode;
  /** Archive id of the talk, for the "Ask AI about this talk" panel. */
  videoId?: string;
  /** On phones the player stays pinned under the top bar while the page
   * scrolls, so the transcript and Ask panel can be read while it plays.
   * Off for Shorts, whose tall player would cover the screen. */
  pinPlayer?: boolean;
}) {
  // Every transcript is rendered (it's in the server HTML for crawlers —
  // scripts/check-seo.mjs enforces this), but only a substantial one counts
  // as "something to read" for the Ask panel's wording.
  const readableTranscript = transcript?.trim() ? transcript : null;
  const substantialTranscript = Boolean(
    transcript && transcript.replace(/\[[^\]]*\]/g, "").trim().length >= 400
  );

  const hasRelated = !(Array.isArray(related) && related.length === 0) && related != null;
  const hasAbout = Boolean(description?.trim() || topics);
  const speakerCount = speakerNames?.length ?? 0;
  // Without a transcript, answers lean on the description and the rest of
  // the archive; the panel says so.
  const talkHasText = substantialTranscript || (description?.trim().length ?? 0) >= 200;

  return (
    <div
      style={accentStyle(accentColor) as CSSProperties | undefined}
      className={`mx-auto grid w-full grid-cols-1 gap-8 pb-16 sm:px-8 sm:pt-8 ${
        hasRelated ? "lg:grid-cols-[minmax(0,1fr)_400px]" : "max-w-[1200px]"
      }`}
    >
      <div className="flex min-w-0 flex-col">
        <div className={pinPlayer ? "sticky top-16 z-30 bg-black sm:static sm:bg-transparent" : undefined}>{player}</div>

        <div className="flex flex-col gap-3 px-4 pt-5 sm:px-0">
          <h1 className="headline text-[28px] text-ink sm:text-[36px]">{title}</h1>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-ink-dim">
              {crumb &&
                (crumbHref ? (
                  <Link href={crumbHref} className="font-medium text-ink hover:text-accent">
                    {crumb}
                  </Link>
                ) : (
                  <span className="font-medium text-ink">{crumb}</span>
                ))}
              {orgName && crumb !== orgName && (
                <>
                  {crumb && <span aria-hidden="true">·</span>}
                  {orgSlug ? (
                    <Link href={`/${orgSlug}`} className="hover:text-ink">
                      {orgName}
                    </Link>
                  ) : (
                    <span>{orgName}</span>
                  )}
                </>
              )}
              {metaLine && (
                <>
                  {(crumb || orgName) && <span aria-hidden="true">·</span>}
                  <span className="tabular">{metaLine}</span>
                </>
              )}
            </p>
            <div className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0">
              <div id={WATCH_ACTIONS_SLOT_ID} className="contents" />
              {actions}
            </div>
          </div>
        </div>

        {/* Session info: who's speaking, what it's about, and asking AI
            about it, under one hairline; the transcript follows. */}
        <div className="mt-5 flex flex-col gap-6 px-4 sm:px-0">
          {(speakers || hasAbout || videoId) && (
            <section className="flex flex-col gap-6 border-t border-line pt-5">
              {speakers && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-dim">
                    {speakerCount === 1 ? "Speaker" : "Speakers"}
                  </h2>
                  {speakers}
                </div>
              )}
              {hasAbout && (
                <div>
                  <DescriptionBox topics={topics} description={description} />
                </div>
              )}
              {videoId && (
                <div className="rounded-sm border border-line p-4">
                  <Suspense fallback={null}>
                    <AskTalk videoId={videoId} hasTranscript={substantialTranscript} talkHasText={talkHasText} />
                  </Suspense>
                </div>
              )}
            </section>
          )}

          {readableTranscript && (
            <div className="flex max-h-[520px] flex-col">
              <TranscriptPanel transcript={readableTranscript} />
            </div>
          )}
        </div>
      </div>

      {/* The sidebar, beside the player: more talks from the same event. */}
      {hasRelated && (
        <aside className="flex min-w-0 flex-col gap-3 px-4 sm:px-0">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-dim">{relatedLabel}</h2>
          <div className="flex flex-col gap-3">{related}</div>
        </aside>
      )}
    </div>
  );
}
