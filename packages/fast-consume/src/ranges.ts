// Pure: turns the LLM's choice of transcript lines into the time ranges that
// get cut out of the source video. The LLM picks line indices, never
// timestamps, so every cut lands on a Whisper segment boundary -- the end of
// a sentence or phrase, never mid-word.

// A transcript line in source-relative seconds (0 = the first frame of the
// file being condensed, not the recording or the wall clock).
export interface Word {
  startS: number;
  endS: number;
  text: string;
}

export interface Line {
  startS: number;
  endS: number;
  text: string;
  // Whisper's word timings, when the transcript kept them.
  words?: Word[];
}

// Inclusive indices into the Line[] the LLM was shown.
export interface Passage {
  from: number;
  to: number;
  why: string;
}

export interface Range {
  startS: number;
  endS: number;
  why: string;
  text: string;
}

// Whisper's segment times are tight on the speech; a little air either side
// keeps the first consonant and the trailing breath.
export const PAD_BEFORE_S = 0.15;
export const PAD_AFTER_S = 0.25;
// Passages closer than this are joined: a sub-second jump cut looks like a
// glitch, not an edit.
export const MERGE_GAP_S = 1.0;

// Validates the LLM's raw tool input: drops anything that isn't a well-formed
// passage over real lines, sorts chronologically, and folds overlapping
// passages together (touching ones are joined in time by passagesToRanges).
// Returns what was dropped so the caller can say so.
export function normalizePassages(raw: unknown, lineCount: number): { passages: Passage[]; dropped: number } {
  const list = Array.isArray((raw as { passages?: unknown })?.passages)
    ? ((raw as { passages: unknown[] }).passages as unknown[])
    : [];
  let dropped = 0;
  const valid: Passage[] = [];
  for (const item of list) {
    const p = item as Partial<Passage>;
    const from = p?.from;
    const to = p?.to;
    if (
      typeof from !== "number" ||
      typeof to !== "number" ||
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      to >= lineCount ||
      from > to
    ) {
      dropped++;
      continue;
    }
    valid.push({ from, to, why: typeof p.why === "string" ? p.why.trim() : "" });
  }
  valid.sort((a, b) => a.from - b.from);

  const merged: Passage[] = [];
  for (const p of valid) {
    const last = merged[merged.length - 1];
    if (last && p.from <= last.to) {
      last.to = Math.max(last.to, p.to);
      if (p.why && !last.why.includes(p.why)) last.why = last.why ? `${last.why}; ${p.why}` : p.why;
    } else {
      merged.push({ ...p });
    }
  }
  return { passages: merged, dropped };
}

const SENTENCE_END = /[.?!]["'”’)\]]*$/;
// A run-on sentence is split at the next word after this long, so the model
// still gets passages it can choose between.
export const MAX_SENTENCE_S = 30;

// Rebuilds the transcript as one line per sentence, from word timings.
// Whisper's segments break mid-sentence ("...you do. And I'm going to"), so
// a cut on a segment edge is often a cut mid-thought; with words, every line
// the model can pick -- and so every cut -- is a whole sentence. Without word
// timings on every line, returns the lines as they are (snapToSentences then
// does what it can).
export function toSentences(lines: Line[]): Line[] {
  if (lines.length === 0 || !lines.every((l) => l.words && l.words.length > 0)) return lines;
  const sentences: Line[] = [];
  let current: Word[] = [];
  const flush = () => {
    if (current.length === 0) return;
    sentences.push({
      startS: current[0].startS,
      endS: current[current.length - 1].endS,
      text: current.map((w) => w.text).join(" "),
      words: current,
    });
    current = [];
  };
  for (const w of lines.flatMap((l) => l.words!)) {
    current.push(w);
    if (SENTENCE_END.test(w.text) || w.endS - current[0].startS >= MAX_SENTENCE_S) flush();
  }
  flush();
  return sentences;
}

// How far snapToSentences may widen a passage, in lines each way.
export const MAX_SNAP_LINES = 3;

// Whisper segments don't follow sentences: on a real talk 5 of 8 chosen
// passages started or ended mid-sentence ("...you do. And I'm going to"),
// even though the model was told to avoid that. The app keeps only segment
// times (transcribe.py stores no word timings), so a cut can't fall inside a
// line. Instead, widen each passage to whole sentences: back to a line that
// follows a sentence end, forward to a line that ends one -- at most
// MAX_SNAP_LINES each way, so a run-on transcript can't swallow the talk.
export function snapToSentences(lines: Line[], passages: Passage[]): Passage[] {
  const endsSentence = (i: number) => SENTENCE_END.test(lines[i].text);
  return passages.map((p) => {
    let from = p.from;
    while (from > 0 && p.from - from < MAX_SNAP_LINES && !endsSentence(from - 1)) from--;
    if (from > 0 && !endsSentence(from - 1)) from = p.from;
    let to = p.to;
    while (to < lines.length - 1 && to - p.to < MAX_SNAP_LINES && !endsSentence(to)) to++;
    if (!endsSentence(to)) to = p.to;
    return { ...p, from, to };
  });
}

// Seconds of source the passages cover, before padding and merging.
export function selectedDurationS(lines: Line[], passages: Passage[]): number {
  return passages.reduce((sum, p) => sum + (lines[p.to].endS - lines[p.from].startS), 0);
}

export function passagesToRanges(lines: Line[], passages: Passage[], sourceDurationS: number): Range[] {
  const ranges: Range[] = [];
  for (const p of passages) {
    // Padding stops halfway to the neighbouring line, so the cut never takes
    // in the first or last syllable of a sentence that wasn't chosen.
    const prev = lines[p.from - 1];
    const next = lines[p.to + 1];
    const speechStartS = lines[p.from].startS;
    const speechEndS = lines[p.to].endS;
    const startS = Math.max(0, speechStartS - PAD_BEFORE_S, prev ? Math.min(speechStartS, (prev.endS + speechStartS) / 2) : 0);
    const endS = Math.min(sourceDurationS, speechEndS + PAD_AFTER_S, next ? Math.max(speechEndS, (speechEndS + next.startS) / 2) : Infinity);
    if (endS <= startS) continue;
    const text = lines
      .slice(p.from, p.to + 1)
      .map((l) => l.text)
      .join(" ");
    const last = ranges[ranges.length - 1];
    // Whisper segments from two transcription chunks can overlap in time at
    // the chunk seam (transcribe.py), so "before" isn't guaranteed by index
    // order alone -- compare times, not indices.
    if (last && startS - last.endS < MERGE_GAP_S) {
      last.endS = Math.max(last.endS, endS);
      last.text = `${last.text} ${text}`;
      if (p.why && !last.why.includes(p.why)) last.why = last.why ? `${last.why}; ${p.why}` : p.why;
    } else {
      ranges.push({ startS, endS, why: p.why, text });
    }
  }
  return ranges;
}

export function totalDurationS(ranges: Range[]): number {
  return ranges.reduce((sum, r) => sum + (r.endS - r.startS), 0);
}
