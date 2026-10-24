// Where the video and its transcript come from. Two ways in:
//   - an archive video (--video): src/archive.ts, which ends up here too
//   - a file: any MP4 plus a transcript JSON of {startS, endS, text} lines
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { EXIT, FastConsumeError } from "./errors.ts";
import type { Line, Word } from "./ranges.ts";
import type { TalkContext } from "./select.ts";

export interface Source {
  videoPath: string;
  lines: Line[];
  talk: TalkContext;
  outPath: string;
  // Carried into the output sidecar as-is.
  meta: Record<string, unknown>;
  // Defaults for --event and --url.
  event?: string;
  url?: string;
  // The title is as uploaded, speaker and event included, so the strap
  // takes the LLM's split of it instead (Selection.displayTitle).
  rawTitle?: boolean;
}

// How far into the source the transcript reaches, 0-1. A transcript made
// elsewhere (--transcript) can stop partway, or belong to a different cut.
export function transcriptCoverage(lines: Line[], sourceDurationS: number): number {
  if (lines.length === 0 || sourceDurationS <= 0) return 0;
  return Math.min(1, Math.max(...lines.map((l) => l.endS)) / sourceDurationS);
}

function isTimed(x: unknown): x is Word {
  const w = x as Partial<Word>;
  return typeof w?.startS === "number" && typeof w?.endS === "number" && typeof w?.text === "string" && w.endS >= w.startS;
}

// Lines of {startS, endS, text}, each optionally with words: [{startS, endS, text}].
export function parseTranscriptJson(raw: unknown, path: string): Line[] {
  if (!Array.isArray(raw)) throw new FastConsumeError(`${path}: expected a JSON array of lines`, EXIT.transcript);
  return raw
    .map((item, i): Line => {
      if (!isTimed(item)) throw new FastConsumeError(`${path}: line ${i} isn't {startS, endS, text}`, EXIT.transcript);
      const words = (item as { words?: unknown }).words;
      if (words !== undefined && !(Array.isArray(words) && words.every(isTimed))) {
        throw new FastConsumeError(`${path}: line ${i} has malformed words`, EXIT.transcript);
      }
      const line: Line = { startS: item.startS, endS: item.endS, text: item.text.trim() };
      if (words) line.words = words.map((w) => ({ startS: w.startS, endS: w.endS, text: w.text.trim() })).filter((w) => w.text);
      return line;
    })
    .filter((l) => l.text)
    .sort((a, b) => a.startS - b.startS);
}

export async function fileSource(opts: {
  file: string;
  transcriptPath: string;
  title?: string;
  speakers?: string[];
  abstract?: string;
  outPath?: string;
}): Promise<Source> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(opts.transcriptPath, "utf-8"));
  } catch (err) {
    throw new FastConsumeError(`can't read transcript ${opts.transcriptPath}: ${(err as Error).message}`, EXIT.transcript);
  }
  return {
    videoPath: opts.file,
    lines: parseTranscriptJson(raw, opts.transcriptPath),
    talk: {
      title: opts.title ?? basename(opts.file).replace(/\.[^.]+$/, ""),
      speakers: opts.speakers ?? [],
      abstract: opts.abstract ?? "",
    },
    outPath: opts.outPath ?? opts.file.replace(/\.[^.]+$/, "") + ".fast.mp4",
    meta: {},
  };
}
