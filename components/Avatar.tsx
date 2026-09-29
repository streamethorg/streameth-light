"use client";

import { useState } from "react";
import { initials } from "@/lib/format";

// Stops along the logo's purple→peach gradient, each with a text color that
// reads on it. A channel always lands on the same stop, so channel avatars
// vary across a grid (as YouTube's do) but stay inside the brand.
const CHANNEL_SWATCHES = [
  { bg: "#140b36", fg: "#f4f1ff" },
  { bg: "#6426ef", fg: "#ffffff" },
  { bg: "#8b3fd9", fg: "#ffffff" },
  { bg: "#b35fd0", fg: "#ffffff" },
  { bg: "#ff9976", fg: "#140b36" },
  { bg: "#2b1a6e", fg: "#ffb89e" },
];

function swatchFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CHANNEL_SWATCHES[h % CHANNEL_SWATCHES.length];
}

/** A round photo/logo, falling back to initials when there's no image or it
 * fails to load. `channel` monograms get a brand swatch color; people get a
 * quiet tint so a speaker never looks like a channel. */
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

  if (photo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full bg-panel-raised object-cover ${className}`}
      />
    );
  }

  const swatch = channel ? swatchFor(name) : undefined;
  return (
    <div
      aria-hidden="true"
      style={swatch ? { backgroundColor: swatch.bg, color: swatch.fg } : undefined}
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-display font-bold tracking-tight ${
        swatch ? "" : "bg-accent/10 text-accent"
      } ${className}`}
    >
      {initials(name)}
    </div>
  );
}
