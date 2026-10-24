"use client";

import Link from "next/link";
import { useState } from "react";
import SourceCard from "./SourceCard";
import CitedMarkdown, { splitGroupedCitations } from "./CitedMarkdown";
import type { AskSource } from "@/lib/ask";
import type { AskState } from "@/lib/useAsk";

/** The streamed part of an ask: progress, the answer with [n] citation
 * links, errors, and the cited talks as source cards. Shared by the home
 * page's Ask box and the watch page's "Ask about this talk" panel. */
export default function AskAnswer({
  state,
  compact = false,
  currentVideoId,
}: {
  state: AskState;
  compact?: boolean;
  /** The talk being watched — not repeated as a source card. */
  currentVideoId?: string;
}) {
  const { status, answer, sources, error } = state;
  const cited = new Set([...splitGroupedCitations(answer).matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const sourceByN = new Map(sources.map((s) => [s.n, s]));
  // Once done, show only the talks the answer cites, in citation order.
  const citedSources = [...cited].map((n) => sourceByN.get(n)).filter((s): s is AskSource => Boolean(s));
  // While answering, show what's been found so far; once done, only the
  // talks the answer actually cites (none if it cites nothing — the search
  // hits alone are often unrelated).
  const shownSources = (status === "done" ? dedupeByVideo(citedSources) : dedupeByVideo(sources)).filter(
    (s) => s.videoId !== currentVideoId
  );

  if (status === "signin") return <SignInToAsk question={state.asked} />;

  return (
    <>
      {status === "searching" && !answer && (
        <p className="flex items-center gap-2 text-sm text-ink-dim">
          <span className="h-2 w-2 animate-pulse rounded-full bg-ink-faint" aria-hidden="true" />
          {compact ? "Reading the talk…" : "Searching transcripts…"}
        </p>
      )}

      {answer && (
        <div
          className={`flex flex-col gap-3 text-ink ${compact ? "text-sm leading-6" : "max-w-[72ch] text-[15px] leading-7"}`}
        >
          <CitedMarkdown text={answer} sources={sourceByN} currentVideoId={currentVideoId} />
          {status === "answering" && (
            <span className="inline-block h-4 w-1.5 animate-pulse bg-ink-faint" aria-hidden="true" />
          )}
        </div>
      )}

      {status === "error" && (
        <p className="rounded-sm border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{error}</p>
      )}

      {shownSources.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink-dim">Sources</h3>
          <div className={`grid grid-cols-1 gap-3 ${compact ? "" : "md:grid-cols-2"}`}>
            {shownSources.map((s) => (
              <SourceCard key={s.n} source={s} citations={citationsFor(s.videoId, sources, cited)} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** Shown instead of an answer when the visitor isn't signed in. Signing in
 * returns to this page with the question in `?ask=`, which asks it. */
function SignInToAsk({ question }: { question: string }) {
  const [href] = useState(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("ask", question);
    return `/signin?next=${encodeURIComponent(url.pathname + url.search)}`;
  });
  return (
    <div className="flex flex-col items-start gap-3 rounded-sm border border-line-strong p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">Sign in to ask</p>
        <p className="text-sm text-ink-dim">
          AI answers are free for signed-in users. Sign in with your email or Google and we&apos;ll ask your question right away.
        </p>
      </div>
      <Link
        href={href}
        className="flex h-9 items-center rounded-sm bg-accent px-4 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
      >
        Sign in
      </Link>
    </div>
  );
}

function dedupeByVideo(list: AskSource[]): AskSource[] {
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.videoId) ? false : (seen.add(s.videoId), true)));
}

function citationsFor(videoId: string, sources: AskSource[], cited: Set<number>): number[] {
  return sources.filter((s) => s.videoId === videoId && cited.has(s.n)).map((s) => s.n);
}
