export function formatTimecode(seconds: number | undefined): string {
  if (!seconds || Number.isNaN(seconds)) return "--:--";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDateShort(input: string | number): string {
  const date = new Date(input);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateLong(input: string | number): string {
  const date = new Date(input);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function callSign(name: string, length = 3): string {
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "SIG";
  if (words.length === 1) {
    return words[0].slice(0, length).toUpperCase().padEnd(length, "X");
  }
  const letters = words.map((w) => w[0]).join("").slice(0, length);
  return letters.toUpperCase().padEnd(length, "X");
}

export function isUsableAccent(color?: string): boolean {
  if (!color) return false;
  const c = color.trim().toLowerCase();
  return c !== "" && c !== "#fff" && c !== "#ffffff" && c !== "white";
}

export function accentStyle(
  color?: string
): { "--accent": string } | undefined {
  return isUsableAccent(color) ? { "--accent": color! } : undefined;
}

const TAG_COLORS = ["accent", "tag-cyan", "tag-yellow", "tag-magenta", "tag-green"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

/** Deterministic tag color per string — same channel/event always gets the
 * same color, but the set as a whole reads as varied rather than one accent
 * hue repeated on every tile. */
export function tagColorFor(seed: string): TagColor {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
