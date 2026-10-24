import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePassages,
  passagesToRanges,
  selectedDurationS,
  snapToSentences,
  toSentences,
  PAD_AFTER_S,
  PAD_BEFORE_S,
  type Line,
} from "./ranges.ts";

// 10 lines of 5s speech each, a 1s pause between them: [0-5], [6-11], ...
const lines: Line[] = Array.from({ length: 10 }, (_, i) => ({ startS: i * 6, endS: i * 6 + 5, text: `line ${i}` }));

test("normalizePassages drops malformed passages and sorts the rest", () => {
  const { passages, dropped } = normalizePassages(
    {
      passages: [
        { from: 7, to: 8, why: "b" },
        { from: 1, to: 2, why: "a" },
        { from: 3, to: 2, why: "reversed" },
        { from: 9, to: 10, why: "past the end" },
        { from: -1, to: 0, why: "negative" },
        { from: 1.5, to: 2, why: "fraction" },
        { from: "4", to: 5, why: "string" },
        null,
      ],
    },
    10
  );
  assert.equal(dropped, 6);
  assert.deepEqual(passages, [
    { from: 1, to: 2, why: "a" },
    { from: 7, to: 8, why: "b" },
  ]);
});

test("normalizePassages merges overlapping passages but keeps touching ones apart", () => {
  const { passages } = normalizePassages(
    { passages: [{ from: 0, to: 3, why: "x" }, { from: 2, to: 5, why: "y" }, { from: 6, to: 6, why: "z" }] },
    10
  );
  assert.deepEqual(passages, [
    { from: 0, to: 5, why: "x; y" },
    { from: 6, to: 6, why: "z" },
  ]);
});

test("normalizePassages treats a missing or non-array passages field as empty", () => {
  assert.deepEqual(normalizePassages(undefined, 10), { passages: [], dropped: 0 });
  assert.deepEqual(normalizePassages({ passages: "0-3" }, 10), { passages: [], dropped: 0 });
});

test("selectedDurationS sums line spans", () => {
  assert.equal(selectedDurationS(lines, [{ from: 0, to: 1, why: "" }, { from: 5, to: 5, why: "" }]), 11 + 5);
});

test("passagesToRanges pads each passage and keeps separate passages apart", () => {
  const ranges = passagesToRanges(lines, [{ from: 2, to: 3, why: "a" }, { from: 7, to: 7, why: "b" }], 60);
  assert.equal(ranges.length, 2);
  assert.equal(ranges[0].startS, 12 - PAD_BEFORE_S);
  assert.equal(ranges[0].endS, 23 + PAD_AFTER_S);
  assert.equal(ranges[0].text, "line 2 line 3");
  assert.equal(ranges[1].startS, 42 - PAD_BEFORE_S);
});

test("passagesToRanges clamps to the source", () => {
  const ranges = passagesToRanges(lines, [{ from: 0, to: 0, why: "" }, { from: 9, to: 9, why: "" }], 59.1);
  assert.equal(ranges[0].startS, 0);
  assert.equal(ranges[1].endS, 59.1);
});

test("passagesToRanges merges passages less than a second apart once padded", () => {
  // Line 1 ends at 11, line 2 starts at 12: padded, the gap is 0.6s.
  const ranges = passagesToRanges(lines, [{ from: 1, to: 1, why: "a" }, { from: 2, to: 2, why: "b" }], 60);
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].why, "a; b");
});

test("passagesToRanges merges lines that overlap in time at a transcription chunk seam", () => {
  const seam: Line[] = [
    { startS: 0, endS: 10, text: "a" },
    { startS: 9.5, endS: 15, text: "b" },
    { startS: 30, endS: 35, text: "c" },
  ];
  const ranges = passagesToRanges(seam, [{ from: 0, to: 0, why: "" }, { from: 1, to: 1, why: "" }, { from: 2, to: 2, why: "" }], 40);
  assert.equal(ranges.length, 2);
  assert.equal(ranges[0].endS, 15 + PAD_AFTER_S);
});

test("snapToSentences widens a passage to whole sentences", () => {
  const t = (text: string, i: number): Line => ({ startS: i * 6, endS: i * 6 + 5, text });
  const sentences = [
    "Intro.",
    "The thing about agents",
    "is that they make",
    "hard things easy.",
    "And I'm going to",
    "show you why.",
    "Next part.",
  ].map(t);
  // Picked "is that they make" .. "And I'm going to": starts and ends mid-sentence.
  const [p] = snapToSentences(sentences, [{ from: 2, to: 4, why: "" }]);
  assert.deepEqual([p.from, p.to], [1, 5]);
});

test("snapToSentences leaves a passage alone when no boundary is within reach", () => {
  const runOn: Line[] = Array.from({ length: 12 }, (_, i) => ({ startS: i * 6, endS: i * 6 + 5, text: `and ${i}` }));
  const [p] = snapToSentences(runOn, [{ from: 5, to: 6, why: "" }]);
  assert.deepEqual([p.from, p.to], [5, 6]);
});

test("snapToSentences stops at the transcript's first line", () => {
  const ls: Line[] = ["starts mid", "sentence ends here."].map((text, i) => ({ startS: i, endS: i + 1, text }));
  const [p] = snapToSentences(ls, [{ from: 1, to: 1, why: "" }]);
  assert.deepEqual([p.from, p.to], [0, 1]);
});

test("toSentences regroups word timings into one line per sentence across segment edges", () => {
  const w = (text: string, startS: number) => ({ text, startS, endS: startS + 0.4 });
  const segs: Line[] = [
    { startS: 0, endS: 2, text: "you do. And I'm", words: [w("you", 0), w("do.", 0.5), w("And", 1), w("I'm", 1.5)] },
    { startS: 2, endS: 3.4, text: "going to develop it.", words: [w("going", 2), w("to", 2.5), w("develop", 2.8), w("it.", 3)] },
  ];
  const s = toSentences(segs);
  assert.deepEqual(
    s.map((l) => [l.text, l.startS, l.endS]),
    [
      ["you do.", 0, 0.9],
      ["And I'm going to develop it.", 1, 3.4],
    ]
  );
});

test("toSentences splits a run-on sentence once it passes MAX_SENTENCE_S", () => {
  const words = Array.from({ length: 80 }, (_, i) => ({ text: "and", startS: i, endS: i + 0.5 }));
  const s = toSentences([{ startS: 0, endS: 80, text: "and ...", words }]);
  assert.ok(s.length >= 2);
  assert.ok(s.every((l) => l.endS - l.startS <= 30.5));
});

test("toSentences keeps segment lines when any line lacks word timings", () => {
  const segs: Line[] = [
    { startS: 0, endS: 1, text: "a.", words: [{ text: "a.", startS: 0, endS: 1 }] },
    { startS: 1, endS: 2, text: "b" },
  ];
  assert.equal(toSentences(segs), segs);
});

test("passagesToRanges never pads into a neighbouring line", () => {
  const tight: Line[] = [
    { startS: 0, endS: 1, text: "a." },
    { startS: 1.1, endS: 2, text: "b." },
    { startS: 2.1, endS: 3, text: "c." },
  ];
  const [r] = passagesToRanges(tight, [{ from: 1, to: 1, why: "" }], 10);
  assert.ok(Math.abs(r.startS - 1.05) < 1e-9 && Math.abs(r.endS - 2.05) < 1e-9, `${r.startS}-${r.endS}`);
});
