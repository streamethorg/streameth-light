"use client";

import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";
import CoverImage from "./CoverImage";
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
  const shownSources = (
    status === "done" && citedSources.length > 0 ? dedupeByVideo(citedSources) : dedupeByVideo(sources)
  ).filter((s) => s.videoId !== currentVideoId);

  if (status === "signin") return <SignInToAsk question={state.asked} />;

  return (
    <>
      {status === "searching" && !answer && (
        <p className="flex items-center gap-2 text-sm text-ink-dim">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
          {compact ? "Reading the talk…" : "Searching transcripts…"}
        </p>
      )}

      {answer && (
        <div
          className={`flex flex-col gap-3 text-ink ${compact ? "text-sm leading-6" : "max-w-[72ch] text-[15px] leading-7"}`}
        >
          <Markdown text={answer} sources={sourceByN} currentVideoId={currentVideoId} />
          {status === "answering" && (
            <span className="inline-block h-4 w-1.5 animate-pulse bg-accent" aria-hidden="true" />
          )}
        </div>
      )}

      {status === "error" && (
        <p className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{error}</p>
      )}

      {shownSources.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-ink">Sources</h3>
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
    <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-panel-raised/50 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">Sign in to ask</p>
        <p className="text-sm text-ink-dim">
          AI answers are free for signed-in users. Sign in with your wallet and we&apos;ll ask your question right away.
        </p>
      </div>
      <Link
        href={href}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
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

function SourceCard({ source, citations }: { source: AskSource; citations: number[] }) {
  return (
    <Link
      href={source.watchUrl}
      className="group flex gap-3 rounded-lg border border-line p-2 transition-colors hover:border-accent/40"
    >
      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-panel-raised">
        <CoverImage src={source.coverImage} label={source.title} />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-1.5 text-xs text-ink-faint">
          {citations.map((n) => (
            <span key={n} className="rounded bg-accent/10 px-1 font-semibold text-accent">
              {n}
            </span>
          ))}
          <span className="truncate">{[source.event || source.channel, source.date].filter(Boolean).join(" · ")}</span>
        </p>
        <p className="line-clamp-2 text-sm font-semibold leading-5 text-ink group-hover:text-accent">{source.title}</p>
        {source.speakers.length > 0 && (
          <p className="truncate text-xs font-medium text-ink-dim">{source.speakers.join(", ")}</p>
        )}
      </div>
    </Link>
  );
}

/** Just enough markdown for answers: paragraphs, "- " bullets, **bold**,
 * and [n] citations rendered as links to the cited talk. */
function Markdown({
  text,
  sources,
  currentVideoId,
}: {
  text: string;
  sources: Map<number, AskSource>;
  currentVideoId?: string;
}) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-faint">
        {list.map((item, i) => (
          <li key={i}>
            <Inline text={item} sources={sources} currentVideoId={currentVideoId} />
          </li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flushList();
    if (!line) continue;
    blocks.push(
      <p key={`p-${blocks.length}`}>
        <Inline text={line.replace(/^#+\s*/, "")} sources={sources} currentVideoId={currentVideoId} />
      </p>
    );
  }
  flushList();
  return <>{blocks}</>;
}

/** Some models write grouped citations ("[2, 3]"); split them into
 * "[2][3]" so each becomes its own link. */
function splitGroupedCitations(text: string): string {
  return text.replace(/\[(\d+(?:\s*,\s*\d+)+)\]/g, (_, list: string) =>
    list
      .split(",")
      .map((n) => `[${n.trim()}]`)
      .join("")
  );
}

function Inline({
  text,
  sources,
  currentVideoId,
}: {
  text: string;
  sources: Map<number, AskSource>;
  currentVideoId?: string;
}) {
  const parts = splitGroupedCitations(text).split(/(\*\*[^*]+\*\*|\[\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        if (bold) return <strong key={i} className="font-semibold">{bold[1]}</strong>;
        const cite = part.match(/^\[(\d+)\]$/);
        if (cite) {
          const source = sources.get(Number(cite[1]));
          if (!source) return <Fragment key={i}>{part}</Fragment>;
          // A passage of the talk being watched: show the quote on hover
          // rather than linking to the page we're already on.
          if (source.videoId === currentVideoId) {
            return (
              <span
                key={i}
                title={source.excerpt}
                className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px cursor-help items-center justify-center rounded bg-accent/10 px-1 align-middle text-[11px] font-semibold text-accent"
              >
                {cite[1]}
              </span>
            );
          }
          return (
            <Link
              key={i}
              href={source.watchUrl}
              title={`${source.title}${source.speakers.length ? ` — ${source.speakers.join(", ")}` : ""}`}
              className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded bg-accent/10 px-1 align-middle text-[11px] font-semibold text-accent no-underline hover:bg-accent hover:text-accent-ink"
            >
              {cite[1]}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
