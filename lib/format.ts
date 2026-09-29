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

function hexToHsl(hex: string): { s: number; l: number } | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s: s * 100, l: l * 100 };
}

/** Rejects colors too washed-out, too dark, or too light to read as an
 * intentional accent (near-black/near-white/near-gray event branding). */
export function isUsableAccent(color?: string): boolean {
  if (!color) return false;
  const c = color.trim().toLowerCase();
  if (c === "" || c === "#fff" || c === "#ffffff" || c === "white") return false;
  const hsl = hexToHsl(c);
  if (!hsl) return true;
  if (hsl.l < 20 || hsl.l > 85) return false;
  if (hsl.s < 15) return false;
  return true;
}

export function accentStyle(
  color?: string
): { "--accent": string } | undefined {
  return isUsableAccent(color) ? { "--accent": color! } : undefined;
}

export function initials(name: string): string {
  // Letters/digits only, so "Pragma (ETHGlobal)" gives "PE", not "P(".
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
