/** Line icons for the top bar, drawn on a 24px grid at 1.8 stroke to
 * read as a set. `filled` marks the active item. */
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

export function MenuIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Plug: connecting an AI app over MCP. */
export function McpIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 01-10 0V7zM12 16v5" />
    </svg>
  );
}

/** Event page sidebar: the live feed. */
export function FeedIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

export function InfoIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export function PeopleIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 19.5a6.5 6.5 0 0113 0" />
      <path d="M16 5.2a3.5 3.5 0 010 6.6M18 14.2a6.5 6.5 0 013.5 5.3" />
    </svg>
  );
}

export function PlayIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M10 9.5v5l4.5-2.5z" />
    </svg>
  );
}

export function BroadcastIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="2" />
      <path d="M8.2 8.2a5.4 5.4 0 000 7.6M15.8 8.2a5.4 5.4 0 010 7.6M5.4 5.4a9.3 9.3 0 000 13.2M18.6 5.4a9.3 9.3 0 010 13.2" />
    </svg>
  );
}

export function StageIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
    </svg>
  );
}

export function RssIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 11a8 8 0 018 8M5 5a14 14 0 0114 14" />
      <circle cx="6" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}

/** Phone tab bar: home. */
export function HomeIcon({ filled = false, className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} fill={filled ? "currentColor" : "none"} className={className}>
      <path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4.5v-5.5h-5V20H5a1 1 0 01-1-1v-8.5z" />
    </svg>
  );
}

/** Phone tab bar: events. */
export function CalendarIcon({ filled = false, className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" fill={filled ? "currentColor" : "none"} />
      <path d="M8 3v4M16 3v4" />
      <path d="M3.5 10h17" stroke={filled ? "var(--void)" : "currentColor"} />
    </svg>
  );
}

/** Phone tab bar: stories. */
export function StoriesIcon({ filled = false, className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" fill={filled ? "currentColor" : "none"} />
      <path d="M8 8.5h8M8 12h8M8 15.5h5" stroke={filled ? "var(--void)" : "currentColor"} />
    </svg>
  );
}

/** Phone tab bar: saved talks. */
export function BookmarkIcon({ filled = false, className = "h-6 w-6" }: IconProps) {
  return (
    <svg {...base} fill={filled ? "currentColor" : "none"} className={className}>
      <path d="M6.5 3.5h11a1 1 0 011 1v16l-6.5-4.5-6.5 4.5v-16a1 1 0 011-1z" />
    </svg>
  );
}
