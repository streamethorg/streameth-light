"use client";

import { useState } from "react";
import { actionButtonClass, TranscriptIcon } from "@/components/ActionButton";

export default function TranscriptPanel({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    // display:contents lets the button and (when open) the panel act as
    // independent siblings of the surrounding actions row, so the button
    // sits inline with Save/Download while the panel still wraps to its
    // own full-width line instead of being squeezed into a button-sized column.
    <div className="contents">
      <button type="button" onClick={() => setExpanded((v) => !v)} className={actionButtonClass(expanded)}>
        <TranscriptIcon />
        {expanded ? "Hide transcript" : "Show transcript"}
      </button>
      {expanded && (
        <div className="order-last max-h-96 w-full max-w-3xl overflow-y-auto whitespace-pre-line rounded-xl bg-panel p-5 text-[15px] leading-relaxed text-ink-dim ring-1 ring-line">
          {text}
        </div>
      )}
    </div>
  );
}
