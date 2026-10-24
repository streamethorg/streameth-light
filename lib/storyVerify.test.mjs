import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeForQuote, quoteInTranscript, verifyStory } from "./storyVerify.mjs";

// A real excerpt (lowercase, unpunctuated automatic captions), from
// data/sources/youtube-transcripts/shard-00.json.
const TRANSCRIPT =
  "okay folks um i have a a little bit longer lighting talk um so this talk which i'll have i will expect some discussion afterwards uh on that um so let's start um i don't know if you have heard that on chain we do have um fx rates for the different currencies it's typically provided by oracles";

const talks = new Map([
  ["yt-QvByK87VN0s", { speakers: ["Anna Rose"], transcript: TRANSCRIPT }],
  ["yt-other", { speakers: [], transcript: null }],
  [
    "yt-titled",
    {
      title: "Security in the AI Age | Krum Pashov, Pashov Audit Group | ETHSofia 2026",
      speakers: [],
      transcript: "one of the biggest companies open zeppelin being acquired by a very serious company uh s&amp;p global",
    },
  ],
]);

const BODY = [
  'Onchain FX rates came up in a lightning talk: "we do have fx rates for the different currencies" [1].',
  "The speaker said they're typically provided by oracles and invited discussion afterwards [1].",
  "A second talk covered related ground in its description, without a transcript to quote [2].",
].join("\n\n");

function draft(overrides = {}) {
  return {
    headline: "Oracles and onchain FX rates take the stage",
    standfirst: "A lightning talk walked through where onchain currency rates come from.",
    body: BODY,
    quotes: [{ text: "We do have FX rates for the different currencies.", n: 1, speaker: "Anna Rose" }],
    sources: [
      { n: 1, videoId: "yt-QvByK87VN0s" },
      { n: 2, videoId: "yt-other" },
    ],
    ...overrides,
  };
}

test("a well-formed story passes", () => {
  assert.deepEqual(verifyStory(draft(), talks), []);
});

test("quotes match through case, punctuation and dropped fillers", () => {
  const t = normalizeForQuote(TRANSCRIPT);
  assert.ok(quoteInTranscript("I don't know if you have heard that onchain...", t) === false);
  assert.ok(quoteInTranscript("I don't know if you have heard that on chain", t));
  // "um" is in the transcript between "have" and "fx"; the quote leaves it out.
  assert.ok(quoteInTranscript("we do have FX rates", t));
  // An ellipsis joins two pieces, in order.
  assert.ok(quoteInTranscript("so let's start … it's typically provided by oracles", t));
  assert.ok(!quoteInTranscript("it's typically provided by oracles … so let's start", t));
});

test("an invented pulled quote is rejected", () => {
  const failures = verifyStory(draft({ quotes: [{ text: "Oracles are the biggest risk in DeFi", n: 1 }] }), talks);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /isn't in the transcript of \[1\]/);
});

test("an invented quote inside the body is rejected", () => {
  const body = BODY.replace('"we do have fx rates for the different currencies"', '"oracles will replace every bank by 2030"');
  const failures = verifyStory(draft({ body }), talks);
  assert.ok(failures.some((f) => /paragraph 1: quote/.test(f)), failures.join("\n"));
});

test("a citation with no matching source is rejected", () => {
  const failures = verifyStory(draft({ body: `${BODY} [7]` }), talks);
  assert.ok(failures.some((f) => /\[7\]/.test(f)), failures.join("\n"));
});

test("a paragraph without any citation is rejected", () => {
  const failures = verifyStory(draft({ body: `${BODY}\n\nThis paragraph makes a claim and cites nothing at all.` }), talks);
  assert.ok(failures.some((f) => /paragraph 4 has no citation/.test(f)), failures.join("\n"));
});

test("an unknown video id is rejected", () => {
  const failures = verifyStory(draft({ sources: [{ n: 1, videoId: "yt-QvByK87VN0s" }, { n: 2, videoId: "yt-madeup" }] }), talks);
  assert.ok(failures.some((f) => /no archive video "yt-madeup"/.test(f)));
});

test("a quote attributed to someone who isn't a speaker of that talk is rejected", () => {
  const failures = verifyStory(
    draft({ quotes: [{ text: "we do have fx rates for the different currencies", n: 1, speaker: "Vitalik Buterin" }] }),
    talks
  );
  assert.ok(failures.some((f) => /attributed to Vitalik Buterin/.test(f)));
});

test("a first name alone counts as the same speaker", () => {
  const failures = verifyStory(
    draft({ quotes: [{ text: "we do have fx rates for the different currencies", n: 1, speaker: "Anna" }] }),
    talks
  );
  assert.deepEqual(failures, []);
});

test("quoting a talk with no transcript is rejected", () => {
  const failures = verifyStory(draft({ quotes: [{ text: "something they said in the talk", n: 2 }] }), talks);
  assert.ok(failures.some((f) => /no transcript to quote from/.test(f)));
});

test("outside links: rejected for the house writer, allowed for external reporters", () => {
  const withLink = draft({
    body: `${BODY}\n\nThe team followed up with a blog post [w1].`,
    externalSources: [{ n: 1, url: "https://example.com/post", title: "Follow-up post" }],
  });
  assert.ok(verifyStory(withLink, talks).some((f) => /outside links aren't allowed/.test(f)));
  assert.deepEqual(verifyStory(withLink, talks, { allowExternal: true }), []);
  const httpLink = { ...withLink, externalSources: [{ n: 1, url: "http://example.com", title: "x" }] };
  assert.ok(verifyStory(httpLink, talks, { allowExternal: true }).some((f) => /https URL/.test(f)));
});

test("HTML in the body is rejected", () => {
  const failures = verifyStory(draft({ body: `${BODY}\n\n<script>alert(1)</script> [1]` }), talks);
  assert.ok(failures.some((f) => /markdown, not HTML/.test(f)));
});

test("grouped citations count", () => {
  const body = BODY.replace("afterwards [1].", "afterwards [1, 2].");
  assert.deepEqual(verifyStory(draft({ body }), talks), []);
});

test("HTML entities in captions don't break a quote", () => {
  const t = normalizeForQuote("being acquired by a very serious company uh s&amp;p global");
  assert.ok(quoteInTranscript("being acquired by a very serious company, S&P Global", t));
});

test("with no speaker list, attribution is checked against the talk title", () => {
  const base = draft({
    sources: [
      { n: 1, videoId: "yt-QvByK87VN0s" },
      { n: 2, videoId: "yt-titled" },
    ],
  });
  const quote = { text: "being acquired by a very serious company, S&P Global", n: 2 };
  assert.deepEqual(verifyStory({ ...base, quotes: [{ ...quote, speaker: "Krum Pashov" }] }, talks), []);
  const wrong = verifyStory({ ...base, quotes: [{ ...quote, speaker: "Vitalik Buterin" }] }, talks);
  assert.ok(wrong.some((f) => /attributed to Vitalik Buterin/.test(f)));
});
