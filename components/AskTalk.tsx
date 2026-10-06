"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AskAnswer from "./AskAnswer";
import { useAsk } from "@/lib/useAsk";

const SUGGESTIONS = ["Summarize this talk", "What are the key takeaways?", "What problem does this solve?"];
// With nothing from the talk itself, ask about its subject instead.
const NO_TEXT_SUGGESTIONS = ["What is this topic about?", "Find related talks", "Who else has spoken on this?"];

/** The watch page's "Ask AI" panel: questions about this talk, answered
 * from its transcript (falling back to the rest of the archive), with
 * citations. Shown on every talk; without a transcript it says where the
 * answers come from instead. */
export default function AskTalk({
  videoId,
  hasTranscript,
  talkHasText,
}: {
  videoId: string;
  hasTranscript: boolean;
  /** A transcript or a substantial description to answer from. */
  talkHasText: boolean;
}) {
  // Back from signing in, the question arrives as `?ask=` — ask it.
  const initialQuestion = useSearchParams().get("ask")?.slice(0, 500) ?? "";
  const [input, setInput] = useState(initialQuestion);
  const { state, ask, clear } = useAsk(videoId);

  useEffect(() => {
    if (initialQuestion) void ask(initialQuestion);
  }, [initialQuestion, ask]);
  const busy = state.status === "searching" || state.status === "answering";

  function submit(question: string) {
    const q = question.trim();
    if (q.length < 3) return;
    setInput(q);
    void ask(q);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-accent" aria-hidden="true">
            <path d="M10 2l1.6 4.4L16 8l-4.4 1.6L10 14l-1.6-4.4L4 8l4.4-1.6L10 2zm5.5 9l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />
          </svg>
          Ask AI about this talk
        </h2>
        {state.asked && (
          <button
            type="button"
            onClick={() => {
              clear();
              setInput("");
            }}
            className="rounded-md px-1.5 py-0.5 text-xs text-ink-dim hover:bg-panel-raised hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex items-center gap-2 rounded-lg border border-line bg-void py-1 pl-3 pr-1 focus-within:border-accent"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          aria-label="Ask a question about this talk"
          placeholder="What does the speaker say about…"
          className="min-w-0 flex-1 bg-transparent py-1 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || input.trim().length < 3}
          className="h-8 shrink-0 rounded-md bg-accent px-3 text-sm font-semibold text-accent-ink transition-opacity disabled:opacity-40"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>

      {!hasTranscript && (
        <p className="text-xs leading-5 text-ink-faint">
          {talkHasText
            ? "No transcript for this talk yet — answers use its description and related talks in the archive."
            : "No transcript or description for this talk yet — answers come from related talks in the archive."}
        </p>
      )}

      {!state.asked ? (
        <div className="flex flex-wrap gap-1.5">
          {(talkHasText ? SUGGESTIONS : NO_TEXT_SUGGESTIONS).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => submit(q)}
              className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-dim transition-colors hover:border-accent/40 hover:text-ink"
            >
              {q}
            </button>
          ))}
        </div>
      ) : (
        <div aria-live="polite" className="flex flex-col gap-4 pt-1">
          <AskAnswer state={state} compact currentVideoId={videoId} />
        </div>
      )}
    </section>
  );
}
