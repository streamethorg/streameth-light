"use client";

import { useState } from "react";

export default function TranscriptPanel({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-fit items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-ink-dim hover:bg-panel hover:text-ink"
      >
        {expanded ? "Hide transcript" : "Show transcript"}
      </button>
      {expanded && (
        <div className="max-h-96 overflow-y-auto whitespace-pre-line rounded-md border border-line bg-panel p-4 text-sm leading-relaxed text-ink-dim">
          {text}
        </div>
      )}
    </div>
  );
}
