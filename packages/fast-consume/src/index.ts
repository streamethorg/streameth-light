// fast consume: condenses a talk to its shortest version that still makes
// sense, by keeping only the passages that carry it, picked and then
// reviewed by the LLM from the transcript, and re-encoding them back to back
// into one MP4 with a JSON sidecar. A Remotion pass then adds a title card,
// captions, a progress bar, a closing card and music (src/graphics.ts).
//
//   pnpm fast-consume --video yt-bXe3ass7I-o         a video from the archive (an id or a watch/YouTube URL)
//   pnpm fast-consume --file x.mp4 --transcript x.json [--title T] [--out y.mp4]
//   pnpm fast-consume graphics y.mp4 [--music m.mp3] redo only the graphics of an earlier run
//
// Options: --speed 1.0 (up to 1.5), --event, --url, --music, --plain, --dry-run, --force.
// See docs/prds/fast-consume.md.
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { archiveSource } from "./archive.ts";
import { cutCaptions } from "./captions.ts";
import { EXIT, FastConsumeError } from "./errors.ts";
import { callTool, llmConfigured, llmSetupHint, MODEL } from "./llm.ts";
import { passagesToRanges, toSentences, totalDurationS } from "./ranges.ts";
import { probe, render } from "./render.ts";
import { selectPassages } from "./select.ts";
import { fileSource, transcriptCoverage, type Source } from "./source.ts";
import { fmt, fmtDuration } from "./time.ts";

const MIN_SOURCE_S = 120;
const MIN_COVERAGE = 0.7;
const MAX_LINES = 4000; // ~3h of talk; past that the prompt gets too long for one call

const USAGE = `usage:
  fast-consume --video <id or URL> [--out <out.mp4>]    a video from the archive: downloaded and transcribed on first use
  fast-consume --file <video.mp4> --transcript <lines.json> [--title T] [--speakers "A, B"] [--abstract A] [--out <out.mp4>]
  fast-consume graphics <out.mp4> [--music <file>]    redo only the graphics, from an earlier run's plain cut and sidecar
options:
  --title T    title for the strap (default: the archive's, or the file name)
  --speakers   comma-separated speaker names for the strap
  --speed S    playback speed of the condensed cut (1.0-1.5, default 1.0)
  --event E    event name for the strap, e.g. "TOKEN2049 2026" (default: the archive's)
  --url U      link to the full talk, for the closing card (default: its watch page)
  --music F    audio file to play under the cut: full on the cards, quiet under the speaker
  --plain      the cut alone: no title card, captions, progress bar or closing card
  --dry-run    print the chosen passages, don't render
  --force      go ahead even if the transcript doesn't cover the whole video`;

function usage(message: string): never {
  throw new FastConsumeError(`${message}\n${USAGE}`, EXIT.usage);
}

function numberOpt(value: string | undefined, name: string, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) usage(`--${name} must be between ${min} and ${max}`);
  return n;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      video: { type: "string" },
      file: { type: "string" },
      transcript: { type: "string" },
      title: { type: "string" },
      speakers: { type: "string" },
      abstract: { type: "string" },
      out: { type: "string" },
      speed: { type: "string" },
      event: { type: "string" },
      url: { type: "string" },
      music: { type: "string" },
      plain: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      force: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }
  if (positionals[0] === "graphics") {
    if (positionals.length !== 2) usage("graphics needs the output MP4 of an earlier run");
    await graphicsPass(resolve(positionals[1]), { music: values.music === undefined ? undefined : resolve(values.music) });
    return;
  }
  const speed = numberOpt(values.speed, "speed", 1, 1, 1.5);

  if (positionals.length > 0) usage(`unexpected ${positionals.join(" ")}`);
  const speakersOpt = values.speakers?.split(",").map((s) => s.trim()).filter(Boolean);
  const outOpt = values.out ? resolve(values.out) : undefined;
  let source: Source;
  if (values.video !== undefined) {
    if (values.file || values.transcript) usage("give either --video or --file, not both");
    source = await archiveSource({ ref: values.video, outPath: outOpt });
    // Given on the command line, they're the answer, not something to clean up.
    if (values.title) source.talk = { ...source.talk, title: values.title };
    if (speakersOpt) source.talk = { ...source.talk, speakers: speakersOpt };
    if (values.title) source.rawTitle = false;
  } else if (values.file) {
    if (!values.transcript) usage("--file needs --transcript");
    source = await fileSource({
      file: resolve(values.file),
      transcriptPath: resolve(values.transcript),
      title: values.title,
      speakers: speakersOpt,
      abstract: values.abstract,
      outPath: outOpt,
    });
  } else {
    usage("give --video or --file");
  }
  let info;
  try {
    info = await probe(source.videoPath);
  } catch (err) {
    throw new FastConsumeError(`can't read ${source.videoPath}: ${(err as Error).message}`, EXIT.sourceNotFound);
  }
  if (!info.hasVideo || !info.hasAudio) {
    throw new FastConsumeError(`${source.videoPath} needs both a video and an audio stream`, EXIT.unsuitableSource);
  }
  if (info.durationS < MIN_SOURCE_S) {
    throw new FastConsumeError(
      `${fmtDuration(info.durationS)} is too short to condense (needs ${fmtDuration(MIN_SOURCE_S)}+)`,
      EXIT.unsuitableSource
    );
  }
  if (source.lines.length === 0) {
    throw new FastConsumeError("no transcript for this video yet", EXIT.transcript);
  }
  if (source.lines.length > MAX_LINES) {
    throw new FastConsumeError(
      `${source.lines.length} transcript lines is more than one LLM call can take (${MAX_LINES}); cut the talk into parts first`,
      EXIT.unsuitableSource
    );
  }
  const coverage = transcriptCoverage(source.lines, info.durationS);
  if (coverage < MIN_COVERAGE && !values.force) {
    throw new FastConsumeError(
      `the transcript only reaches ${Math.round(coverage * 100)}% into the video (transcriber still catching up?); --force to go ahead anyway`,
      EXIT.transcript
    );
  }
  if (!llmConfigured()) throw new FastConsumeError(`no LLM credentials: ${llmSetupHint()}`, EXIT.llm);

  const lines = toSentences(source.lines);
  console.log(
    `${source.talk.title} (${fmtDuration(info.durationS)})\ncondensing ${lines.length} ${lines === source.lines ? "transcript lines" : "sentences"} with ${MODEL}: draft, then review…`
  );
  const selection = await selectPassages(lines, source.talk, info.durationS, (system, prompt, tool) =>
    callTool(system, prompt, tool, 16000)
  );
  for (const w of selection.warnings) console.warn(`warning: ${w}`);
  if (selection.summary) console.log(`summary: ${selection.summary}`);
  console.log(`draft: ${fmtDuration(selection.draftS)}, after review: ${fmtDuration(selection.selectedS)}`);
  if (selection.problems.length) {
    console.log("review fixed:");
    for (const p of selection.problems) console.log(`  - ${p}`);
  }

  const title = (source.rawTitle && selection.displayTitle) || source.talk.title;
  const speakers = source.talk.speakers.length ? source.talk.speakers : selection.speakers;
  const event = values.event ?? (selection.event || source.event || "");
  if (source.rawTitle) console.log(`strap: ${[speakers.join(", "), title, event].filter(Boolean).join(" · ")}`);

  const ranges = passagesToRanges(lines, selection.passages, info.durationS);
  const keptS = totalDurationS(ranges);
  const outDurationS = keptS / speed;
  for (const r of ranges) console.log(`  ${fmt(r.startS)}–${fmt(r.endS)}  ${r.why}`);
  console.log(
    `${ranges.length} passages, ${fmtDuration(keptS)} kept${speed !== 1 ? `, ${fmtDuration(outDurationS)} at ${speed}x` : ""}`
  );
  if (values["dry-run"]) return;

  await mkdir(dirname(source.outPath), { recursive: true });
  const existed = await stat(source.outPath).then(
    () => true,
    () => false
  );
  // With graphics, the cut is kept beside the output as .plain.mp4, so the
  // graphics can be redone without picking passages again.
  const graphics = !values.plain;
  const cutPath = graphics ? source.outPath.replace(/\.mp4$/, ".plain.mp4") : source.outPath;
  await render(source.videoPath, ranges, speed, cutPath, outDurationS, progressPrinter("cutting"));

  // Written after the cut is in place, so a sidecar always means a finished cut.
  let outStartS = 0;
  const sidecar = {
    ...source.meta,
    title,
    speakers,
    event,
    url: values.url ?? source.url ?? "",
    music: values.music ? resolve(values.music) : "",
    sourceFile: source.videoPath,
    sourceDurationS: info.durationS,
    durationS: (await probe(cutPath)).durationS,
    speed,
    model: MODEL,
    summary: selection.summary,
    thesis: selection.thesis,
    reviewProblems: selection.problems,
    passages: ranges.map((r) => {
      const p = { sourceStartS: r.startS, sourceEndS: r.endS, outStartS, why: r.why, text: r.text };
      outStartS += (r.endS - r.startS) / speed;
      return p;
    }),
    ...(graphics ? { plainFile: cutPath, captions: cutCaptions(lines, ranges, speed) } : {}),
    createdAt: new Date().toISOString(),
  };
  const sidecarPath = source.outPath.replace(/\.mp4$/, ".json");
  await writeFile(sidecarPath, JSON.stringify(sidecar, null, 2) + "\n");
  if (!graphics) {
    console.log(`${existed ? "replaced" : "wrote"} ${source.outPath} (${fmtDuration(sidecar.durationS)})`);
    return;
  }
  if (selection.thesis) console.log(`thesis: ${selection.thesis}`);
  try {
    await graphicsPass(source.outPath, { existed });
  } catch (err) {
    if (err instanceof FastConsumeError) {
      err.message += `\nthe cut is done (${cutPath}); retry the graphics with: fast-consume graphics ${source.outPath}`;
    }
    throw err;
  }
}

// music: replaces the sidecar's music for this render ("" for none), and is
// saved back so the next graphics run keeps it.
async function graphicsPass(outPath: string, opts: { existed?: boolean; music?: string }): Promise<void> {
  // Loaded here, not at the top: Remotion is heavy and warns on load, and
  // --plain, --dry-run and every early error don't need it.
  const { readGraphicsSidecar, renderGraphics } = await import("./graphics.ts");
  const sidecarPath = outPath.replace(/\.mp4$/, ".json");
  const sidecar = await readGraphicsSidecar(sidecarPath);
  const musicChanged = opts.music !== undefined && opts.music !== sidecar.music;
  if (musicChanged) sidecar.music = opts.music!;
  const was =
    opts.existed ??
    (await stat(outPath).then(
      () => true,
      () => false
    ));
  const durationS = await renderGraphics(sidecar, outPath, progressPrinter("graphics"));
  // Saved only once it rendered, so a bad --music never sticks.
  if (musicChanged) {
    const raw = JSON.parse(await readFile(sidecarPath, "utf-8"));
    await writeFile(sidecarPath, JSON.stringify({ ...raw, music: sidecar.music }, null, 2) + "\n");
  }
  console.log(`${was ? "replaced" : "wrote"} ${outPath} (${fmtDuration(durationS)})`);
}

// Prints "<label> N%" in steps of 10, overwriting the line.
function progressPrinter(label: string): (fraction: number) => void {
  let lastPct = -1;
  return (f) => {
    const pct = Math.floor(f * 100);
    if (pct >= lastPct + 10 || (pct === 100 && lastPct !== 100)) {
      lastPct = pct;
      process.stdout.write(`\r${label} ${pct}%${pct === 100 ? "\n" : ""}`);
    }
  };
}

main().catch((err) => {
  if (err instanceof FastConsumeError) {
    console.error(err.message);
    process.exit(err.exitCode);
  }
  console.error(err);
  process.exit(1);
});
