import { initials, tagColorFor } from "@/lib/format";

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

export default function CoverPlaceholder({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  const seed = label || "streameth";
  const bars = barHeights(seed, 28);
  const color = tagColorFor(seed);

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-panel-raised ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, var(--ink) 0px, var(--ink) 1px, transparent 1px, transparent 14px)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 flex h-1/2 items-end justify-center gap-[3px] px-4 pb-4 opacity-35">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-full max-w-[3px] rounded-t-[1px]"
            style={{ height: `${h}%`, backgroundColor: `var(--color-${color})` }}
          />
        ))}
      </div>
      <span className="relative font-display text-lg font-bold tracking-tight text-ink-faint">
        {initials(label)}
      </span>
    </div>
  );
}
