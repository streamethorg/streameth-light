"use client";

import { useState } from "react";
import CoverPlaceholder from "./CoverPlaceholder";

/** A video/event cover that swaps to the waveform placeholder when there's
 * no image or it fails to load — some recovered thumbnails still 404, and a
 * broken-image icon in the middle of a grid looks worse than a placeholder. */
export default function CoverImage({
  src,
  label,
  className = "",
  loading = "lazy",
}: {
  src?: string | null;
  label: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <CoverPlaceholder label={label} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading={loading}
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
