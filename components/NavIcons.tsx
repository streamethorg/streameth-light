/** Line icons for the sidebar/rail, drawn on a 24px grid at 1.8 stroke to
 * match YouTube's outline icon weight. `filled` marks the active item. */
type IconProps = { filled?: boolean; className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function HomeIcon({ filled, className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4.5v-6h-5v6H5a1 1 0 01-1-1v-9.5z" fill={filled ? "currentColor" : "none"} />
    </svg>
  );
}

export function ChannelsIcon({ filled, className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" fill={filled ? "currentColor" : "none"} />
      <path d="M8 3l4 3 4-3" />
      {filled ? <path d="M10.5 10v5l4-2.5-4-2.5z" fill="var(--void)" stroke="var(--void)" /> : <path d="M10.5 10v5l4-2.5-4-2.5z" />}
    </svg>
  );
}

export function EventsIcon({ filled, className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill={filled ? "currentColor" : "none"} />
      <path d="M8 3v4M16 3v4" />
      <path d="M3.5 10h17" stroke={filled ? "var(--void)" : "currentColor"} />
    </svg>
  );
}

export function SpeakersIcon({ filled, className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" fill={filled ? "currentColor" : "none"} />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M8.5 21h7" />
    </svg>
  );
}

export function TopicsIcon({ filled, className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 12.2V4.5a1 1 0 011-1h7.7a1 1 0 01.7.3l8.3 8.3a1 1 0 010 1.4l-7.7 7.7a1 1 0 01-1.4 0l-8.3-8.3a1 1 0 01-.3-.7z" fill={filled ? "currentColor" : "none"} />
      <circle cx="8" cy="8" r="1.5" fill={filled ? "var(--void)" : "currentColor"} stroke="none" />
    </svg>
  );
}

export function SavedIcon({ filled, className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6.5 3.5h11a1 1 0 011 1v16l-6.5-4.5-6.5 4.5v-16a1 1 0 011-1z" fill={filled ? "currentColor" : "none"} />
    </svg>
  );
}

export function ConnectIcon({ filled, className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 9.5h10v3a5 5 0 01-10 0v-3z" fill={filled ? "currentColor" : "none"} />
      <path d="M9.5 9.5V4.5M14.5 9.5V4.5M12 17.5V21" />
    </svg>
  );
}

export function MenuIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
    </svg>
  );
}

export function SearchIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.8-4.8" />
    </svg>
  );
}

export function BackIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M20 12H4m0 0l6-6m-6 6l6 6" />
    </svg>
  );
}
