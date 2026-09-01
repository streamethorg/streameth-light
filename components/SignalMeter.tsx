const BAR_COUNT = 40;

// Deterministic heights + animation delays so this renders identically on
// server and client (no hydration mismatch) while still reading as a live
// signal meter once the CSS animation kicks in.
function bars() {
  let h = 42;
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return {
      base: 12 + (h % 68),
      delay: (i * 73) % 1600,
    };
  });
}

export default function SignalMeter() {
  return (
    <div
      aria-hidden
      className="pointer-events-none flex h-full items-end gap-[3px]"
    >
      {bars().map((b, i) => (
        <span
          key={i}
          className="signal-bar w-full max-w-[3px] rounded-t-[1px] bg-accent/60"
          style={{
            height: `${b.base}%`,
            animationDelay: `${b.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}
