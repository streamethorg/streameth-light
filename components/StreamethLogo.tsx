import { MARK_GRADIENT_STOPS, MARK_HEIGHT, MARK_SHAPES, MARK_WIDTH } from "@/lib/streamethMark";

// Ported from streameth-platform's lib/svg/StreamethLogo.tsx — the actual
// StreamETH brand mark, not an invented one for this archive.
export default function StreamethLogo({ className }: { className?: string }) {
  return (
    <svg
      width={MARK_WIDTH}
      height={MARK_HEIGHT}
      viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {MARK_SHAPES.map(({ d }, i) => (
        <path key={i} fillRule="evenodd" clipRule="evenodd" d={d} fill={`url(#streameth-g${i})`} />
      ))}
      <defs>
        {MARK_SHAPES.map(({ gradient: g }, i) => (
          <linearGradient
            key={i}
            id={`streameth-g${i}`}
            x1={g.x1}
            y1={g.y1}
            x2={g.x2}
            y2={g.y2}
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={MARK_GRADIENT_STOPS[0]} />
            <stop offset="1" stopColor={MARK_GRADIENT_STOPS[1]} />
          </linearGradient>
        ))}
      </defs>
    </svg>
  );
}
