// The gate every story passes before it's published, whoever wrote it (our
// writer in scripts/write-stories.mjs or an outside agent via the MCP
// server's submit_story). Stories go out without human review, so this is
// the only check: citations must resolve, every paragraph must cite, and
// every quote must be in the cited talk's transcript, word for word, said by
// the speaker it's attributed to. Plain .mjs so the CI writer can use it
// without the Next toolchain, like lib/autoLabels.mjs.

export const HEADLINE_MIN = 8;
export const HEADLINE_MAX = 160;
export const STANDFIRST_MIN = 20;
export const STANDFIRST_MAX = 400;
export const BODY_MIN = 200;
export const BODY_MAX = 12000;
export const MAX_SOURCES = 60;
export const MAX_EXTERNAL_SOURCES = 12;
// Quoted spans shorter than this are phrases ("so-called 'based' rollups"),
// not quotes of what someone said.
export const MIN_QUOTE_WORDS = 4;

// Automatic transcripts keep every hesitation; a quote that drops them is
// still word for word.
const FILLERS = new Set(["um", "uh", "erm", "er", "hmm", "ah", "uhm", "mm"]);

// Caption text carries HTML entities ("S&amp;P", "&gt;&gt;" for a speaker
// change); a quote written with the plain characters is the same words.
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };

/** @param {string} text */
function decodeEntities(text) {
  return text.replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (_, name) => ENTITIES[name]);
}

/** @param {string} text */
export function normalizeForQuote(text) {
  return decodeEntities(text)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !FILLERS.has(w))
    .join(" ");
}

/**
 * Whether `quote` appears in `transcript`. An ellipsis ("…" or "...") marks a
 * cut; each piece must appear, in order.
 *
 * @param {string} quote
 * @param {string} transcript already passed through normalizeForQuote
 */
export function quoteInTranscript(quote, transcript) {
  const pieces = quote
    .split(/…|\.\.\.|\[\.\.\.\]/)
    .map(normalizeForQuote)
    .filter(Boolean);
  if (pieces.length === 0) return false;
  const haystack = ` ${transcript} `;
  let from = 0;
  for (const piece of pieces) {
    const at = haystack.indexOf(` ${piece} `, from);
    if (at === -1) return false;
    from = at + piece.length + 1;
  }
  return true;
}

/** @param {string} name */
function normalizeName(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Same person if one name's words are all in the other's ("Vitalik" vs
 * "Vitalik Buterin"). */
function sameSpeaker(a, b) {
  const wa = normalizeName(a).split(" ").filter(Boolean);
  const wb = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (wa.length === 0 || wb.size === 0) return false;
  const [short, long] = wa.length <= wb.size ? [wa, wb] : [[...wb], new Set(wa)];
  return short.every((w) => long.has(w));
}

/** Every word of the name appears in the title. */
function nameInTitle(name, title) {
  const words = normalizeName(name).split(" ").filter(Boolean);
  const titleWords = new Set(normalizeName(title).split(" "));
  return words.length > 0 && words.every((w) => titleWords.has(w));
}

/** Grouped citations ("[2, 3]") → "[2][3]", as AskAnswer renders them. */
export function splitGroupedCitations(text) {
  return text.replace(/\[(w?\d+(?:\s*,\s*w?\d+)+)\]/g, (_, list) =>
    list
      .split(",")
      .map((n) => `[${n.trim()}]`)
      .join("")
  );
}

/** Paragraphs and bullets: the units that each need a citation. */
function blocksOf(body) {
  return splitGroupedCitations(body)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^#+\s/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, ""));
}

/** Text inside double quotes (straight or curly) of at least
 * MIN_QUOTE_WORDS words. */
function quotedSpans(text) {
  const spans = [];
  for (const m of text.matchAll(/["“]([^"”]+)["”]/g)) {
    if (m[1].trim().split(/\s+/).length >= MIN_QUOTE_WORDS) spans.push(m[1]);
  }
  return spans;
}

/**
 * @typedef {{
 *   headline: string,
 *   standfirst: string,
 *   body: string,
 *   quotes: { text: string, n: number, speaker?: string | null }[],
 *   sources: { n: number, videoId: string }[],
 *   externalSources?: { n: number, url: string, title: string }[],
 * }} StoryDraft
 *
 * @typedef {{
 *   title?: string,
 *   speakers: string[],
 *   transcript: string | null,
 * }} SourceTalk  transcript: the talk's transcript text, or null when it has
 *   none (it can be cited then, but not quoted). title: used to check a
 *   quote's attribution when no speakers are listed ("Talk | Name, Org").
 *
 * @param {StoryDraft} draft
 * @param {Map<string, SourceTalk>} talks by video id; a missing id is an
 *   unknown video
 * @param {{ allowExternal?: boolean }} [options]
 * @returns {string[]} failures, empty when the story passes
 */
export function verifyStory(draft, talks, { allowExternal = false } = {}) {
  const failures = [];
  const headline = draft.headline?.trim() ?? "";
  const standfirst = draft.standfirst?.trim() ?? "";
  const body = draft.body?.trim() ?? "";

  if (headline.length < HEADLINE_MIN || headline.length > HEADLINE_MAX) {
    failures.push(`headline must be ${HEADLINE_MIN}–${HEADLINE_MAX} characters`);
  }
  if (standfirst.length < STANDFIRST_MIN || standfirst.length > STANDFIRST_MAX) {
    failures.push(`standfirst must be ${STANDFIRST_MIN}–${STANDFIRST_MAX} characters`);
  }
  if (body.length < BODY_MIN || body.length > BODY_MAX) {
    failures.push(`body must be ${BODY_MIN}–${BODY_MAX} characters`);
  }
  if (/<[a-z!/][^>]*>/i.test(body)) failures.push("body must be markdown, not HTML");

  const sources = draft.sources ?? [];
  const external = draft.externalSources ?? [];
  if (sources.length === 0) failures.push("cite at least one archive talk");
  if (sources.length > MAX_SOURCES) failures.push(`at most ${MAX_SOURCES} sources`);
  if (external.length > 0 && !allowExternal) failures.push("outside links aren't allowed for this reporter");
  if (external.length > MAX_EXTERNAL_SOURCES) failures.push(`at most ${MAX_EXTERNAL_SOURCES} outside links`);

  /** @type {Map<number, string>} */
  const videoByN = new Map();
  for (const s of sources) {
    if (!Number.isInteger(s.n) || s.n < 1) {
      failures.push(`source numbers must be positive integers (got ${s.n})`);
      continue;
    }
    if (videoByN.has(s.n)) failures.push(`source [${s.n}] is listed twice`);
    if (!talks.has(s.videoId)) failures.push(`source [${s.n}]: no archive video "${s.videoId}"`);
    videoByN.set(s.n, s.videoId);
  }
  const externalNs = new Set();
  for (const e of external) {
    if (!/^https:\/\/[^\s]+$/.test(e.url ?? "")) failures.push(`outside link [w${e.n}] must be an https URL`);
    if (!e.title?.trim()) failures.push(`outside link [w${e.n}] needs a title`);
    externalNs.add(e.n);
  }

  const normalized = new Map();
  const transcriptOf = (n) => {
    const videoId = videoByN.get(n);
    const talk = videoId ? talks.get(videoId) : undefined;
    if (!talk?.transcript) return null;
    if (!normalized.has(videoId)) normalized.set(videoId, normalizeForQuote(talk.transcript));
    return normalized.get(videoId);
  };

  const blocks = blocksOf(body);
  blocks.forEach((block, i) => {
    const cites = [...block.matchAll(/\[(w?)(\d+)\]/g)];
    if (cites.length === 0) {
      failures.push(`paragraph ${i + 1} has no citation: "${block.slice(0, 80)}"`);
      return;
    }
    for (const [, w, n] of cites) {
      if (w ? !externalNs.has(Number(n)) : !videoByN.has(Number(n))) {
        failures.push(`citation [${w}${n}] in paragraph ${i + 1} doesn't match a source`);
      }
    }
    // A quote in the text has to be in one of the talks this paragraph cites.
    const cited = cites.filter(([, w]) => !w).map(([, , n]) => Number(n));
    for (const span of quotedSpans(block)) {
      const found = cited.some((n) => {
        const t = transcriptOf(n);
        return t !== null && quoteInTranscript(span, t);
      });
      if (!found) {
        failures.push(`paragraph ${i + 1}: quote "${span.slice(0, 80)}" isn't in the transcript of any talk it cites`);
      }
    }
  });

  for (const q of draft.quotes ?? []) {
    const text = q.text?.trim() ?? "";
    if (!text) {
      failures.push("empty pulled quote");
      continue;
    }
    if (!videoByN.has(q.n)) {
      failures.push(`pulled quote cites [${q.n}], which isn't a source`);
      continue;
    }
    const t = transcriptOf(q.n);
    if (t === null) {
      failures.push(`pulled quote [${q.n}]: that talk has no transcript to quote from`);
      continue;
    }
    if (!quoteInTranscript(text, t)) {
      failures.push(`pulled quote "${text.slice(0, 80)}" isn't in the transcript of [${q.n}]`);
    }
    if (q.speaker) {
      const talk = talks.get(videoByN.get(q.n));
      const known = talk?.speakers ?? [];
      // No speaker list: the name has to be in the talk's title, which for
      // most uploads is "Talk title | Speaker, Org | Event".
      const attributed =
        known.length > 0 ? known.some((s) => sameSpeaker(s, q.speaker)) : nameInTitle(q.speaker, talk?.title ?? "");
      if (!attributed) {
        failures.push(`pulled quote [${q.n}] is attributed to ${q.speaker}, who isn't listed as a speaker of that talk`);
      }
    }
  }

  return failures;
}
