import { test } from "node:test";
import assert from "node:assert/strict";
import { EXIT, FastConsumeError } from "./errors.ts";
import type { Line } from "./ranges.ts";
import { cutAsHeard, selectPassages, type AskFn } from "./select.ts";

// 100 sentences of 10s each: a 1000s talk.
const lines: Line[] = Array.from({ length: 100 }, (_, i) => ({ startS: i * 10, endS: i * 10 + 10, text: `line ${i}.` }));
const talk = { title: "T", speakers: ["S"], abstract: "" };

function scripted(...answers: unknown[]): { ask: AskFn; calls: Array<{ prompt: string; tool: string }> } {
  const calls: Array<{ prompt: string; tool: string }> = [];
  const ask: AskFn = async (_system, prompt, tool) => {
    calls.push({ prompt, tool: tool.name });
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { ask, calls };
}

test("drafts, then reviews the draft as heard, and keeps the review's selection", async () => {
  const { ask, calls } = scripted(
    {
      summary: "The claim, why, and the conclusion.",
      thesis: " It's you who needs it. ",
      displayTitle: "Agents + Crypto",
      speakers: [" Haseeb Qureshi ", "", 3],
      event: "TOKEN2049 Singapore 2026",
      passages: [{ from: 10, to: 14, why: "claim" }, { from: 90, to: 92, why: "end" }],
    },
    {
      problems: ["The conclusion refers to an example that was cut."],
      passages: [{ from: 10, to: 14, why: "claim" }, { from: 40, to: 42, why: "example" }, { from: 90, to: 92, why: "end" }],
    }
  );
  const sel = await selectPassages(lines, talk, 1000, ask);
  assert.deepEqual(
    calls.map((c) => c.tool),
    ["select_passages", "review_cut"]
  );
  assert.match(calls[0].prompt, /\[0\] 0:00:00 line 0\./);
  assert.match(calls[1].prompt, /What the talk says \(the cut has to get this across\):\nThe claim, why, and the conclusion\./);
  assert.match(calls[1].prompt, /\[10-14\] line 10\. line 11\. line 12\. line 13\. line 14\.\n--- cut ---\n\[90-92\]/);
  assert.equal(sel.summary, "The claim, why, and the conclusion.");
  assert.equal(sel.thesis, "It's you who needs it.");
  assert.equal(sel.displayTitle, "Agents + Crypto");
  assert.deepEqual(sel.speakers, ["Haseeb Qureshi"]);
  assert.equal(sel.event, "TOKEN2049 Singapore 2026");
  assert.deepEqual(sel.problems, ["The conclusion refers to an example that was cut."]);
  assert.deepEqual(
    sel.passages.map((p) => [p.from, p.to]),
    [
      [10, 14],
      [40, 42],
      [90, 92],
    ]
  );
  assert.equal(sel.selectedS, 50 + 30 + 30);
});

test("keeps the draft when the review returns nothing usable", async () => {
  const { ask } = scripted({ summary: "s", passages: [{ from: 0, to: 2, why: "" }] }, { problems: [], passages: [{ from: 900, to: 901 }] });
  const sel = await selectPassages(lines, talk, 1000, ask);
  assert.deepEqual(
    sel.passages.map((p) => [p.from, p.to]),
    [[0, 2]]
  );
  assert.match(sel.warnings.join(), /using the draft as it was/);
  // A draft without the title fields leaves them empty for the caller to fill.
  assert.equal(sel.displayTitle, "");
  assert.deepEqual(sel.speakers, []);
});

test("redrafts once when the first draft has no usable passages", async () => {
  const { ask, calls } = scripted(
    { summary: "s", passages: [] },
    { summary: "s", passages: [{ from: 0, to: 2, why: "" }] },
    { problems: [], passages: [{ from: 0, to: 2, why: "" }] }
  );
  await selectPassages(lines, talk, 1000, ask);
  assert.equal(calls.length, 3);
  assert.match(calls[1].prompt, /no usable passages/);
});

test("fails with the LLM exit code when both drafts are unusable", async () => {
  const { ask } = scripted({ passages: [{ from: 500, to: 501 }] }, { nonsense: true });
  await assert.rejects(selectPassages(lines, talk, 1000, ask), (err: unknown) => {
    assert.ok(err instanceof FastConsumeError);
    assert.equal(err.exitCode, EXIT.llm);
    return true;
  });
});

test("an API error becomes the LLM exit code", async () => {
  const { ask } = scripted(new Error("529 overloaded"));
  await assert.rejects(selectPassages(lines, talk, 1000, ask), /LLM call failed: 529 overloaded/);
});

test("cutAsHeard joins each passage's text and marks the cuts", () => {
  assert.equal(
    cutAsHeard(lines, [
      { from: 0, to: 1, why: "" },
      { from: 5, to: 5, why: "" },
    ]),
    "[0-1] line 0. line 1.\n--- cut ---\n[5-5] line 5."
  );
});
