"use client";

import { useEffect, useState } from "react";
import StreamethLogo from "./StreamethLogo";
import AskAnswer from "./AskAnswer";
import { useAsk } from "@/lib/useAsk";

const EXAMPLES = [
  "Why do based rollups need preconfirmations?",
  "How did EIP-4844 change rollup fees?",
  "What are the risks of restaking?",
  "What is chain abstraction?",
];

/** "Ask the archive": a question box whose answer is written by an AI model
 * from talk transcripts, streamed in with numbered citations that link to
 * the talks. The question is mirrored into `?ask=` so answers can be
 * shared; opening such a link asks it again. */
export default function AskBox({ initialQuestion = "" }: { initialQuestion?: string }) {
  const [input, setInput] = useState(initialQuestion);
  const { state, ask: run, clear: reset } = useAsk();
  const { status, asked, searches } = state;

  function ask(question: string) {
    const q = question.trim();
    if (q.length < 3) return;
    setInput(q);
    const url = new URL(window.location.href);
    url.searchParams.set("ask", q);
    window.history.replaceState(null, "", url);
    void run(q);
  }

  // Shared links (`/?ask=…`) ask on arrival; the input and URL already
  // hold the question. (In dev, Strict Mode runs this twice; the hook
  // aborts the first request when the second starts.)
  useEffect(() => {
    if (initialQuestion) void run(initialQuestion);
  }, [initialQuestion, run]);

  function clear() {
    reset();
    setInput("");
    const url = new URL(window.location.href);
    url.searchParams.delete("ask");
    window.history.replaceState(null, "", url);
  }

  const busy = status === "searching" || status === "answering";

  return (
    <div className="flex w-full flex-col gap-8">
      {/* Idle, the hero fills the first screen minus a strip at the bottom
          where the "New" section starts; once asked, it moves to the top
          and the answer flows under it. */}
      <div
        className={`flex flex-col items-center gap-6 ${
          asked
            ? "pt-6"
            : "min-h-[calc(100svh-57px-12rem)] justify-center lg:min-h-[calc(100svh-57px-16rem)]"
        }`}
      >
        {!asked && (
          <div className="flex items-center gap-2.5">
            <StreamethLogo className="h-8 w-auto" />
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">StreamETH</h1>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="w-full max-w-2xl"
        >
          <div className="flex w-full items-center gap-3 rounded-full border border-line bg-panel py-2 pl-5 pr-2 shadow-sm transition-shadow focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgb(100_38_239/0.15)]">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5 shrink-0 text-ink-faint" aria-hidden="true">
              <circle cx="9" cy="9" r="6.5" />
              <path d="M18 18l-4-4" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus={!initialQuestion}
              maxLength={500}
              aria-label="Ask a question"
              placeholder="Ask anything about Ethereum talks…"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || input.trim().length < 3}
              className="flex h-9 shrink-0 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink transition-opacity disabled:opacity-40"
            >
              {busy ? "Working…" : "Ask"}
            </button>
          </div>
        </form>
        {!asked && (
          <>
            <p className="text-center text-xs text-ink-faint">
              Answers are written by AI from talk transcripts, with links to the talks.
            </p>
            <div className="flex max-w-2xl flex-wrap justify-center gap-2">
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  className="rounded-full border border-line px-3 py-1 text-[13px] text-ink-dim transition-colors hover:border-accent/40 hover:text-ink"
                >
                  {q}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {asked && (
        <section aria-live="polite" className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
              {searches.length > 0 ? (
                <>
                  <span>Searched</span>
                  {searches.map((s, i) => (
                    <span key={i} className="rounded bg-panel-raised px-1.5 py-0.5 text-ink-dim">
                      {s}
                    </span>
                  ))}
                </>
              ) : status !== "signin" ? (
                <span>Reading the archive…</span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={clear}
              className="-mt-1 shrink-0 rounded-md px-2 py-1 text-sm text-ink-dim hover:bg-panel-raised hover:text-ink"
            >
              Clear
            </button>
          </div>

          <AskAnswer state={state} />
        </section>
      )}
    </div>
  );
}

