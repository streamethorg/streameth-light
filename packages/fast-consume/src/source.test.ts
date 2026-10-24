import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTranscriptJson, transcriptCoverage } from "./source.ts";

test("transcriptCoverage is how far the transcript reaches", () => {
  assert.equal(transcriptCoverage([], 100), 0);
  assert.equal(transcriptCoverage([{ startS: 0, endS: 50, text: "x" }], 100), 0.5);
  assert.equal(transcriptCoverage([{ startS: 0, endS: 120, text: "x" }], 100), 1);
});

test("parseTranscriptJson validates lines and sorts them", () => {
  assert.deepEqual(
    parseTranscriptJson(
      [
        { startS: 5, endS: 6, text: " b " },
        { startS: 1, endS: 2, text: "a" },
        { startS: 3, endS: 4, text: "" },
      ],
      "t.json"
    ),
    [
      { startS: 1, endS: 2, text: "a" },
      { startS: 5, endS: 6, text: "b" },
    ]
  );
  assert.deepEqual(parseTranscriptJson([{ startS: 0, endS: 1, text: "a.", words: [{ startS: 0, endS: 1, text: " a. " }] }], "t.json"), [
    { startS: 0, endS: 1, text: "a.", words: [{ startS: 0, endS: 1, text: "a." }] },
  ]);
  assert.throws(() => parseTranscriptJson([{ startS: 0, endS: 1, text: "a", words: [{ start: 0 }] }], "t.json"), /malformed words/);
  assert.throws(() => parseTranscriptJson({ lines: [] }, "t.json"), /expected a JSON array/);
  assert.throws(() => parseTranscriptJson([{ start: 1, end: 2, text: "x" }], "t.json"), /line 0 isn't/);
});
