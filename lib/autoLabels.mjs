// Session `autoLabels` come from an LLM labeler, and its raw output leaked
// into the export unparsed: whole bulleted lists as one label
// ("- blockchain\n- ethereum\n- defi"), and refusals stored as labels
// ("No labels can be assigned based on the provided transcription.").
// Shared by the app (lib/data.ts) and the search-index build
// (scripts/build-db.mjs) so topic pages, chips and search all agree.

const MAX_WORDS = 5;
const REFUSAL = /\b(transcription|labels?|provided|context)\b/i;

/**
 * @param {string[] | undefined} labels
 * @returns {string[]}
 */
export function cleanAutoLabels(labels) {
  const seen = new Set();
  const out = [];
  for (const raw of labels ?? []) {
    for (const piece of String(raw).split(/\n+/)) {
      const label = piece.replace(/^\s*[-*•]\s*/, "").trim();
      if (!label || label.endsWith(":")) continue;
      if (/[.?!]$/.test(label) || REFUSAL.test(label)) continue;
      if (label.split(/\s+/).length > MAX_WORDS) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(label);
    }
  }
  return out;
}
