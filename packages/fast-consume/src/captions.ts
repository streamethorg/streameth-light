// Pure: the words spoken in the condensed cut, timed on the cut's own
// timeline (0 = its first frame), for the graphics pass to burn in. Source
// times come from Whisper; each kept range is shifted to where it lands in
// the cut and divided by the playback speed.
import type { Caption } from "@remotion/captions";
import type { Line, Range, Word } from "./ranges.ts";

// A line without word timings (the app's transcripts keep only segment
// times) gets its words spread evenly over the line: close enough for
// captions that show a few words at a time.
export function wordsOf(line: Line): Word[] {
  if (line.words && line.words.length > 0) return line.words;
  const tokens = line.text.split(/\s+/).filter(Boolean);
  const step = (line.endS - line.startS) / Math.max(1, tokens.length);
  return tokens.map((text, i) => ({ startS: line.startS + i * step, endS: line.startS + (i + 1) * step, text }));
}

export function cutCaptions(lines: Line[], ranges: Range[], speed: number): Caption[] {
  const captions: Caption[] = [];
  let outOffsetS = 0;
  for (const r of ranges) {
    for (const line of lines) {
      if (line.endS <= r.startS || line.startS >= r.endS) continue;
      for (const w of wordsOf(line)) {
        // A word belongs to the range its middle falls in; padding can clip
        // the edge of a word that was mostly cut.
        const mid = (w.startS + w.endS) / 2;
        if (mid < r.startS || mid >= r.endS) continue;
        const startS = outOffsetS + (Math.max(w.startS, r.startS) - r.startS);
        const endS = outOffsetS + (Math.min(w.endS, r.endS) - r.startS);
        const startMs = Math.round((startS / speed) * 1000);
        captions.push({
          // Leading space: createTikTokStyleCaptions splits pages on it.
          text: ` ${w.text}`,
          startMs,
          endMs: Math.max(startMs, Math.round((endS / speed) * 1000)),
          timestampMs: startMs,
          confidence: null,
        });
      }
    }
    outOffsetS += r.endS - r.startS;
  }
  return captions;
}
