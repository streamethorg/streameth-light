"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AskAnswer from "./AskAnswer";
import { useAsk } from "@/lib/useAsk";

const SUGGESTIONS = ["Summarize this talk", "What are the key takeaways?", "What problem does this solve?"];
// With nothing from the talk itself, ask about its subject instead.
const NO_TEXT_SUGGESTIONS = ["What is this topic about?", "Find related talks", "Who else has spoken on this?"];

const EVENT_SUGGESTIONS = ["What were the big themes?", "Who's speaking, and when?", "Which talks should I watch?"];

/** The "Ask AI" panel. About one talk (the watch page, an opened video):
 * answered from its transcript, falling back to the rest of the archive;
 * without a transcript it says where answers come from instead. About an
 * event (`event`): answered from the event's page (agenda, speakers,
 * stories, shared links) plus searches over only that event's talks. Given
 * both, it opens on the talk with a switch to ask about the whole event.
 * Answers cite their passages either way. */
export default function AskTalk({
  videoId,
  hasTranscript,
  talkHasText,
  event,
}: {
  videoId?: string;
  hasTranscript: boolean;
  /** A transcript or a substantial description to answer from. */
  talkHasText: boolean;
  /** The event the talk is from (or, with no `videoId`, the event to ask
   * about). */
  event?: { key: string; name: string; transcribedTalks: number };
}) {
  // Back from signing in, the question arrives as `?ask=` — ask it.
  const initialQuestion = useSearchParams().get("ask")?.slice(0, 500) ?? "";
  const [input, setInput] = useState(initialQuestion);
  const [scope, setScope] = useState<"talk" | "event">(videoId ? "talk" : "event");
  const aboutEvent = scope === "event" && Boolean(event);
  const { state, ask, clear } = useAsk(aboutEvent ? undefined : videoId, aboutEvent ? event?.key : undefined);
  const suggestions = aboutEvent ? EVENT_SUGGESTIONS : talkHasText ? SUGGESTIONS : NO_TEXT_SUGGESTIONS;

  // Once: switching scope changes `ask`, and that mustn't re-ask it.
  const askedInitial = useRef(false);
  useEffect(() => {
    if (!initialQuestion || askedInitial.current) return;
    askedInitial.current = true;
    void ask(initialQuestion);
  }, [initialQuestion, ask]);

  function switchScope(next: "talk" | "event") {
    if (next === scope) return;
    clear();
    setScope(next);
  }
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
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-dim">
          {aboutEvent && event ? (videoId ? "Ask AI" : "Ask AI about this event") : "Ask AI about this talk"}
        </h2>
        {state.asked && (
          <button
            type="button"
            onClick={() => {
              clear();
              setInput("");
            }}
            className="rounded-sm px-1.5 py-0.5 text-xs text-ink-dim hover:bg-panel-raised hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      {videoId && event && (
        <div
          className="grid grid-cols-2 rounded-sm border border-line-strong p-0.5 text-[13px] font-medium"
          role="tablist"
          aria-label="Ask about"
        >
          {(
            [
              ["talk", "This talk"],
              ["event", `All of ${event.name}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              onClick={() => switchScope(value)}
              className={`truncate rounded-[2px] px-3 py-2 transition-colors sm:py-1 ${
                scope === value ? "bg-ink font-semibold text-void" : "text-ink-dim hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          aria-label={aboutEvent && event ? `Ask a question about ${event.name}` : "Ask a question about this talk"}
          placeholder={aboutEvent ? "Ask about the agenda, speakers, talks…" : "What does the speaker say about…"}
          className="h-10 min-w-0 flex-1 rounded-sm border border-line-strong bg-void px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none sm:h-9"
        />
        <button
          type="submit"
          disabled={busy || input.trim().length < 3}
          className="h-10 shrink-0 rounded-sm bg-accent px-4 text-sm font-semibold text-accent-ink transition-opacity disabled:opacity-40 sm:h-9 sm:px-3.5"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>

      {aboutEvent && event ? (
        <p className="text-xs leading-5 text-ink-faint">
          {event.transcribedTalks > 0
            ? `Answers come from ${event.name}'s page — agenda, speakers, stories, shared links — and its ${event.transcribedTalks} transcribed ${event.transcribedTalks === 1 ? "talk" : "talks"}, with citations.`
            : `Answers come from ${event.name}'s page — agenda, speakers, stories, shared links — with citations. Talks are added as they're transcribed.`}
        </p>
      ) : !hasTranscript && (
        <p className="text-xs leading-5 text-ink-faint">
          {talkHasText
            ? "No transcript for this talk yet — answers use its description and related talks in the archive."
            : "No transcript or description for this talk yet — answers come from related talks in the archive."}
        </p>
      )}

      {!state.asked ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => submit(q)}
              className="rounded-sm border border-line-strong px-3 py-2 text-left text-[13px] text-ink-dim transition-colors hover:border-ink-faint hover:text-ink sm:px-2.5 sm:py-1"
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
