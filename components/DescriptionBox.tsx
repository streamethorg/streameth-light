"use client";

import { useState, type ReactNode } from "react";

/** A talk's topics and description, clamped to a few lines
 * with "Show more" to expand. */
export default function DescriptionBox({
  topics,
  description,
}: {
  topics?: ReactNode;
  description?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = (description?.length ?? 0) > 280 || (description?.split("\n").length ?? 0) > 4;

  if (!description && !topics) return null;

  return (
    <div className="flex flex-col gap-2 text-sm text-ink">
      {topics && <div>{topics}</div>}
      {description && (
        <p className={`max-w-[80ch] whitespace-pre-line leading-relaxed text-ink-dim ${expanded ? "" : "line-clamp-4"}`}>
          {description}
        </p>
      )}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-fit text-sm font-medium text-ink hover:text-accent"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
