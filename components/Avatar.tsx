"use client";

import { useState } from "react";
import { initials } from "@/lib/format";

// Stops along the logo's purple→peach gradient, each paired with a text
// color that reads on it. A channel always lands on the same stop, so
// monograms vary across the page but stay inside the brand.
const MONOGRAM_SWATCHES = [
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
  return MONOGRAM_SWATCHES[h % MONOGRAM_SWATCHES.length];
}

/** A person's photo or a channel's logo, falling back to a monogram when
 * there's no image or it fails to load (plenty of the older CDN logos 404).
 * People are round; channels/orgs are rounded squares, the way logos are
 * usually cropped — so the two read differently at a glance. */
export default function Avatar({
  name,
  photo,
  shape = "round",
  className = "",
}: {
  name: string;
  photo?: string | null;
  shape?: "round" | "square";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const radius = shape === "round" ? "rounded-full" : "rounded-[22%]";

  if (photo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`shrink-0 bg-panel object-cover ring-1 ring-inset ring-black/5 ${radius} ${className}`}
      />
    );
  }

  const swatch = shape === "square" ? swatchFor(name) : undefined;
  return (
    <div
      aria-hidden="true"
      style={swatch ? { backgroundColor: swatch.bg, color: swatch.fg } : undefined}
      className={`flex shrink-0 select-none items-center justify-center font-display font-extrabold tracking-[-0.02em] ${radius} ${
        shape === "square" ? "ring-1 ring-inset ring-white/15" : "bg-accent/10 text-accent"
      } ${className}`}
    >
      {initials(name)}
    </div>
  );
}
