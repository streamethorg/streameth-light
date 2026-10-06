"use client";

import { useState, type ReactNode } from "react";

/** YouTube's grey description box: a bold meta line, then the description
 * clamped to a few lines with "...more" to expand. Expanded, it also
 * offers the transcript, the way YouTube tucks "Show transcript" in here. */
export default function DescriptionBox({
  meta,
  topics,
  description,
  transcript,
}: {
  meta?: string;
  topics?: ReactNode;
  description?: string;
  transcript?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const hasMore = Boolean(transcript) || (description?.length ?? 0) > 180 || (description?.split("\n").length ?? 0) > 3;

  if (!meta && !description && !topics && !transcript) return null;

  return (
    <div
      className={`rounded-xl bg-panel-raised p-3 text-sm text-ink ${
        !expanded && hasMore ? "cursor-pointer hover:bg-panel-hover" : ""
      }`}
      onClick={() => {
        if (!expanded && hasMore) setExpanded(true);
      }}
    >
      {meta && <p className="tabular font-semibold">{meta}</p>}
      {topics && <div className="mt-1">{topics}</div>}
      {description && (
        <p className={`mt-2 whitespace-pre-line leading-relaxed ${expanded ? "" : "line-clamp-3"}`}>
          {description}
        </p>
      )}
      {!expanded && hasMore && (
        <button type="button" className="mt-1 font-semibold" onClick={() => setExpanded(true)}>
          ...more
        </button>
      )}
      {/* Always in the server-rendered HTML, only hidden with CSS until
          expanded, so search engines and AI crawlers read the full
          transcript — it's the richest text on the page. */}
      {(expanded || transcript) && (
        <div className={`mt-4 flex-col items-start gap-4 ${expanded ? "flex" : "hidden"}`}>
          {transcript && (
            <div className="flex w-full flex-col gap-3">
              <h2 className="text-base font-semibold">Transcript</h2>
              <button
                type="button"
                onClick={() => setShowTranscript((v) => !v)}
                className="w-fit rounded-full border border-line bg-void px-4 py-2 font-semibold text-ink transition-colors hover:bg-panel-hover"
              >
                {showTranscript ? "Hide transcript" : "Show transcript"}
              </button>
              <div
                className={`max-h-96 w-full overflow-y-auto whitespace-pre-line rounded-lg bg-void p-4 leading-relaxed text-ink-dim ${
                  showTranscript ? "" : "hidden"
                }`}
              >
                {transcript}
              </div>
            </div>
          )}
          {hasMore && (
            <button type="button" className="font-semibold" onClick={() => setExpanded(false)}>
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
}
