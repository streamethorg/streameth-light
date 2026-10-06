"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

const SENTENCES_PER_PARAGRAPH = 5;

function decodeEntities(text: string): string {
  return text
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Auto transcripts arrive as one unbroken block. Break them into short
 * paragraphs: at ">>" speaker changes (YouTube's marker), and otherwise
 * every few sentences. */
function toParagraphs(transcript: string): string[] {
  const paragraphs: string[] = [];
  for (const turn of decodeEntities(transcript).split(/\s*>>\s*/)) {
    const sentences = turn.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [];
    for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARAGRAPH) {
      const paragraph = sentences.slice(i, i + SENTENCES_PER_PARAGRAPH).join(" ").trim();
      if (paragraph) paragraphs.push(paragraph);
    }
  }
  return paragraphs;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The talk's transcript beside the player, with find-in-transcript.
 * Arriving from a search (`?q=` on the watch URL) pre-fills the find box,
 * so the passage that matched is one click away. */
export default function TranscriptPanel({ transcript }: { transcript: string }) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [current, setCurrent] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const paragraphs = useMemo(() => toParagraphs(transcript), [transcript]);

  const needle = query.trim();
  const pattern = needle.length >= 2 ? new RegExp(`(${escapeRegExp(needle)})`, "gi") : null;

  let matchIndex = 0;
  const rendered = paragraphs.map((p, i) => {
    if (!pattern) return <p key={i}>{p}</p>;
    const parts: ReactNode[] = p.split(pattern).map((part, j) => {
      if (j % 2 === 0) return part;
      const index = matchIndex++;
      return (
        <mark
          key={j}
          data-match={index}
          className={`rounded-sm px-px ${index === current ? "bg-accent text-accent-ink" : "bg-accent/15 text-ink"}`}
        >
          {part}
        </mark>
      );
    });
    return <p key={i}>{parts}</p>;
  });
  const total = matchIndex;

  // Scrolls only the transcript box (not the page) to centre a match.
  function scrollToMatch(index: number, behavior: ScrollBehavior) {
    const body = bodyRef.current;
    const mark = body?.querySelector<HTMLElement>(`[data-match="${index}"]`);
    if (!body || !mark) return;
    const top = mark.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
    body.scrollTo({ top: top - body.clientHeight / 2, behavior });
  }

  function goTo(index: number) {
    if (total === 0) return;
    const next = (index + total) % total;
    setCurrent(next);
    scrollToMatch(next, "smooth");
  }

  // Arriving with ?q=: bring the first match into view.
  useEffect(() => {
    scrollToMatch(0, "auto");
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line">
      <div className="flex items-center gap-2 px-4 pb-1 pt-3">
        <h2 className="text-sm font-semibold text-ink">Transcript</h2>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            goTo(current + 1);
          }}
          className="ml-auto flex min-w-0 items-center gap-1"
        >
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrent(0);
            }}
            aria-label="Find in transcript"
            placeholder="Find in transcript"
            className="h-8 w-40 min-w-0 rounded-md border border-line bg-void px-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          {pattern && (
            <>
              <span className="tabular w-12 text-center text-xs text-ink-faint">
                {total === 0 ? "0" : `${current + 1}/${total}`}
              </span>
              <button
                type="button"
                onClick={() => goTo(current - 1)}
                disabled={total === 0}
                aria-label="Previous match"
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-dim hover:bg-panel-raised disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="submit"
                disabled={total === 0}
                aria-label="Next match"
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-dim hover:bg-panel-raised disabled:opacity-40"
              >
                ↓
              </button>
            </>
          )}
        </form>
      </div>
      <div
        ref={bodyRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-3 text-sm leading-relaxed text-ink-dim [scrollbar-width:thin]"
      >
        {rendered}
      </div>
      <p className="px-4 pb-3 pt-2 text-[11px] text-ink-faint">
        Automatic transcript — names and jargon may be misspelled.
      </p>
    </div>
  );
}
