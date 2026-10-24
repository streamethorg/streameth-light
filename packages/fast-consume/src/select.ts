// Asks the LLM for the shortest cut of a talk that still makes sense as the
// talk, in two calls:
//   1. draft: write the talk's argument as a chain of steps, then keep only
//      the sentences that state each step -- no length target, the
//      argument decides
//   2. review: read the draft back exactly as a viewer would hear it, find
//      joins that don't hold (a reference to something cut, a claim with its
//      reasoning missing), and return a corrected selection
//
// Earlier versions aimed at a fixed share of the talk (10%) and picked
// passages by importance to hit it. On a real 20-minute talk every variant
// of that played as disconnected fragments: the target forced out the
// sentences that link one point to the next, and nothing checked the joins.
import type Anthropic from "@anthropic-ai/sdk";
import { EXIT, FastConsumeError } from "./errors.ts";
import { normalizePassages, selectedDurationS, snapToSentences, type Line, type Passage } from "./ranges.ts";
import { fmt, fmtDuration } from "./time.ts";

// Raw tool input in, so tests can stand in for the LLM.
export type AskFn = (system: string, prompt: string, tool: Anthropic.Tool) => Promise<unknown>;

export interface TalkContext {
  title: string;
  speakers: string[];
  abstract: string;
}

export interface Selection {
  summary: string;
  // The talk's conclusion in one short sentence, for the closing card.
  thesis: string;
  // What the on-screen strap should say. Uploaded titles carry everything
  // ("Haseeb Qureshi - Agents + Crypto: What's Real & What's Cope - TOKEN2049
  // Singapore 2026"), so the model splits them; empty where it couldn't tell.
  displayTitle: string;
  speakers: string[];
  event: string;
  passages: Passage[];
  selectedS: number;
  // What the review found wrong with the draft; empty when it found nothing.
  problems: string[];
  draftS: number;
  warnings: string[];
}

const DRAFT_SYSTEM = `You turn a recorded conference talk into its shortest watchable version: a cut someone can watch instead of the whole talk and come away with its argument, in the speaker's own words. You're given the transcript (automatic speech-to-text, so expect misheard words), one numbered line per sentence. The lines you keep are cut out of the video and played back to back, in the original order, with nothing added between them, so the cut has to make sense as speech on its own.

First write the talk's argument as a short chain: its main claim, each step that gets there, and where it lands. Write only the steps the conclusion depends on, not every point the speaker makes. Then, for each step, keep the sentences where the speaker states it most clearly, plus the sentence that leads into it from the step before. Nothing else.

This is a condensed version, not an edit for time. Cut the evidence, statistics, examples, anecdotes, names, quotes, caveats, asides and jokes, unless the step is the example itself. A step the speaker spends three minutes on usually needs two or three sentences. There's no length target, but a good cut is a small fraction of the talk: if you're keeping more than a few sentences for a step, you're keeping its support, not the step.

Every join has to hold. After each cut, the next line must make sense straight after the line before it. Nothing you keep may refer to something you cut: a person ("what he points out"), an earlier example ("that's why that works"), a slide ("this chart"). When it does, drop that line or pick a different sentence that states the step. Skip greetings, thanks, housekeeping, slide trouble and Q&A.`;

const REVIEW_SYSTEM = `You check a condensed cut of a conference talk before it's published. The cut keeps some of the talk's lines and plays them back to back with nothing added between them. You're shown the cut exactly as a viewer will hear it, passage by passage, followed by the full numbered transcript for reference.

Watch the cut as someone who has never seen the talk, and find every place it fails:
- a join where what follows doesn't make sense right after what came before
- a line that refers to something that was cut: a person, an example, a slide, "that", "this", "the reason why that works"
- a claim whose reasoning was cut, so it comes from nowhere
- a step of the talk's argument that's missing, so the conclusion doesn't follow
- anything kept that the talk's point doesn't need

List the problems, then give the corrected, complete selection. The cut has to stay a condensed version of the talk, as short as it can be while it makes sense, so fix each problem the cheapest way:
- a line that refers to something cut: drop that line, or reword nothing and move the cut a sentence or two so the reference isn't needed
- a join that jars: move the cut point to a cleaner sentence boundary
- add lines back only when a step of the argument would otherwise be missing, and then add the fewest that state it
Examples, anecdotes, names and caveats are what a condensed cut leaves out; a reference to one is fixed by dropping the line that makes it, not by bringing the example back. Also drop whatever the talk's point doesn't need. If the cut already works, return it unchanged.`;

const PASSAGES_SCHEMA = {
  type: "array",
  description: "The lines to keep, in talk order",
  items: {
    type: "object",
    properties: {
      from: { type: "integer", description: "First line kept, by its [number]" },
      to: { type: "integer", description: "Last line kept, inclusive, by its [number]" },
      why: { type: "string", description: "What this passage contributes, in at most 12 words" },
    },
    required: ["from", "to", "why"],
  },
};

const DRAFT_TOOL: Anthropic.Tool = {
  name: "select_passages",
  description: "The talk's summary and the passages that deliver it.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "The talk's argument as a chain: the claim, each step, the conclusion" },
      thesis: {
        type: "string",
        description: "The talk's conclusion as one plain sentence of at most 12 words, as the speaker would put it",
      },
      displayTitle: {
        type: "string",
        description: "The talk's title as it should appear on screen: the given title without speaker names, event, or year",
      },
      speakers: {
        type: "array",
        items: { type: "string" },
        description:
          "The speakers' full names, only as the title, the speaker list or the speaker themself gives them; empty if none is given. Never guess.",
      },
      event: {
        type: "string",
        description: "The event as the title names it, e.g. \"TOKEN2049 Singapore 2026\"; empty if the title doesn't name one",
      },
      passages: PASSAGES_SCHEMA,
    },
    required: ["summary", "thesis", "displayTitle", "speakers", "event", "passages"],
  },
};

const REVIEW_TOOL: Anthropic.Tool = {
  name: "review_cut",
  description: "The problems found in the cut, and the corrected selection.",
  input_schema: {
    type: "object",
    properties: {
      problems: {
        type: "array",
        items: { type: "string" },
        description: "Each place the cut fails, in one sentence; empty if it works",
      },
      passages: PASSAGES_SCHEMA,
    },
    required: ["problems", "passages"],
  },
};

function transcriptBlock(lines: Line[]): string {
  return lines.map((l, i) => `[${i}] ${fmt(l.startS)} ${l.text}`).join("\n");
}

function talkHeader(talk: TalkContext, sourceDurationS: number): string {
  return [
    `Talk: ${talk.title}`,
    talk.speakers.length ? `Speakers: ${talk.speakers.join(", ")}` : null,
    talk.abstract ? `Abstract: ${talk.abstract}` : null,
    `Length: ${fmtDuration(sourceDurationS)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// The draft as a viewer hears it: each passage's text, with the cuts marked.
export function cutAsHeard(lines: Line[], passages: Passage[]): string {
  return passages
    .map(
      (p) =>
        `[${p.from}-${p.to}] ${lines
          .slice(p.from, p.to + 1)
          .map((l) => l.text)
          .join(" ")}`
    )
    .join("\n--- cut ---\n");
}

function stringField(raw: unknown, key: string): string {
  const v = (raw as Record<string, unknown> | null)?.[key];
  return typeof v === "string" ? v.trim() : "";
}

function stringList(raw: unknown, key: string): string[] {
  const v = (raw as Record<string, unknown> | null)?.[key];
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim()) : [];
}

export async function selectPassages(
  lines: Line[],
  talk: TalkContext,
  sourceDurationS: number,
  ask: AskFn
): Promise<Selection> {
  const warnings: string[] = [];

  const call = async (system: string, prompt: string, tool: Anthropic.Tool) => {
    let raw: unknown;
    try {
      raw = await ask(system, prompt, tool);
    } catch (err) {
      throw new FastConsumeError(`LLM call failed: ${(err as Error).message}`, EXIT.llm);
    }
    const normalized = normalizePassages(raw, lines.length);
    if (normalized.dropped > 0) warnings.push(`dropped ${normalized.dropped} malformed passage(s) from the LLM's answer`);
    // Widening can make neighbours overlap; normalize again to fold them.
    const { passages } = normalizePassages({ passages: snapToSentences(lines, normalized.passages) }, lines.length);
    return { raw, passages };
  };

  const transcript = `Transcript (${lines.length} lines, [number] start-time text):\n${transcriptBlock(lines)}`;
  const draftPrompt = `${talkHeader(talk, sourceDurationS)}\n\n${transcript}`;
  let draft = await call(DRAFT_SYSTEM, draftPrompt, DRAFT_TOOL);
  if (draft.passages.length === 0) {
    draft = await call(
      DRAFT_SYSTEM,
      `${draftPrompt}\n\nYour previous answer had no usable passages. Choose lines by their [number]s.`,
      DRAFT_TOOL
    );
    if (draft.passages.length === 0) throw new FastConsumeError("the LLM returned no usable passages twice", EXIT.llm);
  }
  const summary = stringField(draft.raw, "summary");
  const thesis = stringField(draft.raw, "thesis");
  const displayTitle = stringField(draft.raw, "displayTitle");
  const speakers = stringList(draft.raw, "speakers");
  const event = stringField(draft.raw, "event");

  const reviewPrompt = [
    talkHeader(talk, sourceDurationS),
    summary ? `What the talk says (the cut has to get this across):\n${summary}` : null,
    `The cut as the viewer hears it (${fmtDuration(selectedDurationS(lines, draft.passages))}):\n${cutAsHeard(lines, draft.passages)}`,
    transcript,
  ]
    .filter(Boolean)
    .join("\n\n");
  const review = await call(REVIEW_SYSTEM, reviewPrompt, REVIEW_TOOL);
  const problems = stringList(review.raw, "problems");

  // A review that came back without a usable selection doesn't sink the
  // draft, which was usable on its own.
  let passages = review.passages;
  if (passages.length === 0) {
    warnings.push("the review returned no usable passages; using the draft as it was");
    passages = draft.passages;
  }
  return {
    summary,
    thesis,
    displayTitle,
    speakers,
    event,
    passages,
    selectedS: selectedDurationS(lines, passages),
    problems,
    draftS: selectedDurationS(lines, draft.passages),
    warnings,
  };
}
