// YouTube descriptions mostly open with the channel's promo text ("Visit the
// https://archive.devcon.org/ to gain access…", "🚀 Get Ready for ETHDenver
// 2026! 🚀", "Join us on Meetup…") and are full of raw links, so search
// snippets cut off before saying who spoke or what the talk is about.
// Paragraphs repeated across a channel's uploads are its boilerplate.

// A link, without the punctuation right after it ("…/SteakhouseFi.").
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s]*[^\s.,;:!?)\]'"]/gi;

/** A paragraph's identity with its links and punctuation ignored, so
 * "…and more.\nhttps://archive.devcon.org/…/<talk>/index" matches across
 * every Devcon upload.
 * @param {string} paragraph
 * @returns {string} */
export function paragraphKey(paragraph) {
  return paragraph
    .replace(URL_RE, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

/** @param {string | null | undefined} text */
function paragraphs(text) {
  return (text ?? "").split(/\n\s*\n/);
}

/** Keys of the paragraphs that appear in at least `min` of these
 * descriptions (one channel's uploads).
 * @param {Iterable<string>} descriptions
 * @returns {Set<string>} */
export function boilerplateKeys(descriptions, min = 3) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const description of descriptions) {
    const seen = new Set();
    for (const paragraph of paragraphs(description)) {
      const key = paragraphKey(paragraph);
      if (key.length < 12 || seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  /** @type {Set<string>} */
  const keys = new Set();
  for (const [key, count] of counts) if (count >= min) keys.add(key);
  return keys;
}

/** The description as a snippet should use it: the channel's boilerplate
 * paragraphs dropped, links removed, and lines that were only a label for a
 * link ("Website: https://…", "Discord: https://…") dropped. Returns "" when
 * nothing about the talk itself is left.
 * @param {string | null | undefined} text
 * @param {Set<string>} [boilerplate]
 * @returns {string} */
export function cleanDescription(text, boilerplate = new Set()) {
  /** @type {string[]} */
  const kept = [];
  for (const paragraph of paragraphs(text)) {
    if (boilerplate.has(paragraphKey(paragraph))) continue;
    for (const line of paragraph.split("\n")) {
      const hadLink = URL_RE.test(line);
      URL_RE.lastIndex = 0;
      const clean = line
        .replace(URL_RE, "")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/([,;:])(?=[,.;:])/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!/\p{L}/u.test(clean)) continue;
      // "Website:", "Follow us on X:", "Learn more:" with the link gone.
      if (hadLink && /^[^.!?]{0,40}[:\-–—]?$/u.test(clean) && clean.split(" ").length <= 5) continue;
      kept.push(clean);
    }
  }
  return kept
    .map((line) => (/[.!?:]$/.test(line) ? line : `${line}.`))
    .join(" ")
    .trim();
}
