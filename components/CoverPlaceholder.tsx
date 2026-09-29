import { initials } from "@/lib/format";

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
 * an audio-waveform in the brand gradient, so missing covers still look
 * like part of the archive rather than a broken image. */
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
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-stage ${className}`}
    >
      <div className="absolute inset-x-0 bottom-0 flex h-3/5 items-end justify-center gap-[3px] px-5 pb-5">
        {bars.map((h, i) => (
          <span
            key={i}
            className="brand-gradient w-full max-w-[4px] rounded-full opacity-50"
            style={{ height: `${h}%`, backgroundSize: `${bars.length * 7}px 100%`, backgroundPosition: `${-i * 7}px 0` }}
          />
        ))}
      </div>
      <span className="relative font-display text-xl font-extrabold tracking-tight text-stage-ink/80">
        {initials(label)}
      </span>
    </div>
  );
}
