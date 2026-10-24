"use client";

import { useState } from "react";
import { initials } from "@/lib/format";

/** A photo or logo, with a neutral fallback when there's no image or it
 * fails to load. People are round, with quiet initials; `channel` logos
 * (events, organisers) are 4px-cornered squares, and with no logo they're a
 * plain tile — a channel never gets an initials monogram. */
export default function Avatar({
  name,
  photo,
  channel = false,
  className = "",
}: {
  name: string;
  photo?: string | null;
  channel?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const shape = channel ? "rounded-sm" : "rounded-full";

  if (photo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`shrink-0 bg-panel-raised object-cover ${shape} ${className}`}
      />
    );
  }

  if (channel) {
    return <div aria-hidden="true" className={`shrink-0 border border-line bg-panel-raised ${shape} ${className}`} />;
  }

  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 select-none items-center justify-center bg-panel-raised font-semibold tracking-tight text-ink-dim ${shape} ${className}`}
    >
      {initials(name)}
    </div>
  );
}
