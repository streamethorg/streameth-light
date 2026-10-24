// Deterministic per-label "waveform" so the same session/event always
// renders the same pattern (no layout shift, no client JS needed).
function barHeights(seed: string, count: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    bars.push(18 + (h % 82)); // 18–100%
  }
  return bars;
}

/** Stand-in cover for a talk with no thumbnail: the dark stage color with
 * a flat audio-waveform, so missing covers still look like part of the
 * archive rather than a broken image. No initials: a monogram reads as a
 * logo the event or channel doesn't have. */
export default function CoverPlaceholder({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  const seed = label || "streameth";
  const bars = barHeights(seed, 32);

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-stage ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-x-0 bottom-0 flex h-3/5 items-end justify-center gap-[3px] px-5 pb-5">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-full max-w-[4px] rounded-full bg-stage-dim/35"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
