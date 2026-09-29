"use client";

import { useState } from "react";
import { initials } from "@/lib/format";

/** A person's photo, falling back to their initials when there's no photo
 * or it fails to load (plenty of the scraped speaker photo URLs are dead). */
export default function Avatar({
  name,
  photo,
  className = "",
}: {
  name: string;
  photo?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (photo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full bg-panel object-cover ring-1 ring-inset ring-black/5 ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 select-none items-center justify-center rounded-full bg-accent/10 font-display font-bold tracking-tight text-accent ${className}`}
    >
      {initials(name)}
    </div>
  );
}
