import { test } from "node:test";
import assert from "node:assert/strict";
import { cutCaptions, wordsOf } from "./captions.ts";
import type { Line } from "./ranges.ts";

const timed: Line[] = [
  {
    startS: 10,
    endS: 12,
    text: "Agents need crypto.",
    words: [
      { startS: 10, endS: 10.5, text: "Agents" },
      { startS: 10.6, endS: 11, text: "need" },
      { startS: 11.1, endS: 12, text: "crypto." },
    ],
  },
  { startS: 20, endS: 21, text: "Cut this.", words: [{ startS: 20, endS: 20.4, text: "Cut" }, { startS: 20.5, endS: 21, text: "this." }] },
  { startS: 30, endS: 31, text: "You do.", words: [{ startS: 30, endS: 30.4, text: "You" }, { startS: 30.5, endS: 31, text: "do." }] },
];

test("cutCaptions shifts each kept range's words onto the cut's timeline", () => {
  const ranges = [
    { startS: 9.9, endS: 12.2, why: "", text: "" },
    { startS: 29.9, endS: 31.2, why: "", text: "" },
  ];
  const caps = cutCaptions(timed, ranges, 1);
  assert.deepEqual(
    caps.map((c) => [c.text, c.startMs, c.endMs]),
    [
      [" Agents", 100, 600],
      [" need", 700, 1100],
      [" crypto.", 1200, 2100],
      // Second range starts 2.3s into the cut.
      [" You", 2400, 2800],
      [" do.", 2900, 3400],
    ]
  );
  assert.ok(caps.every((c) => c.timestampMs === c.startMs && c.confidence === null));
});

test("cutCaptions divides times by the playback speed", () => {
  const caps = cutCaptions(timed, [{ startS: 10, endS: 12, why: "", text: "" }], 2);
  assert.deepEqual(
    caps.map((c) => [c.startMs, c.endMs]),
    [
      [0, 250],
      [300, 500],
      [550, 1000],
    ]
  );
});

test("cutCaptions drops a word whose middle the padding didn't reach", () => {
  // The range clips the start of "Agents" (10-10.5, middle 10.25) but keeps its middle,
  // and stops before the middle of "crypto." (11.55).
  const caps = cutCaptions(timed, [{ startS: 10.2, endS: 11.5, why: "", text: "" }], 1);
  assert.deepEqual(
    caps.map((c) => [c.text, c.startMs, c.endMs]),
    [
      [" Agents", 0, 300],
      [" need", 400, 800],
    ]
  );
});

test("wordsOf spreads an untimed line's words evenly", () => {
  assert.deepEqual(wordsOf({ startS: 0, endS: 3, text: "one  two three" }), [
    { startS: 0, endS: 1, text: "one" },
    { startS: 1, endS: 2, text: "two" },
    { startS: 2, endS: 3, text: "three" },
  ]);
});
