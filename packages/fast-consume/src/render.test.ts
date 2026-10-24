import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { EXIT, FastConsumeError } from "./errors.ts";
import type { Range } from "./ranges.ts";
import { buildFfmpegArgs, probe, render } from "./render.ts";

const execFileAsync = promisify(execFile);

const ranges: Range[] = [
  { startS: 10, endS: 20, why: "", text: "" },
  { startS: 40, endS: 45.5, why: "", text: "" },
];

test("buildFfmpegArgs seeks each range as its own input and concats them", () => {
  const args = buildFfmpegArgs("in.mp4", ranges, 1, "out.mp4");
  const joined = args.join(" ");
  assert.match(joined, /-ss 10\.000 -t 10\.000 -i in\.mp4 -ss 40\.000 -t 5\.500 -i in\.mp4/);
  const graph = args[args.indexOf("-filter_complex") + 1];
  assert.match(graph, /\[v0\]\[a0\]\[v1\]\[a1\]concat=n=2:v=1:a=1\[v\]\[a\]$/);
  assert.match(graph, /\[1:a:0\]asetpts=PTS-STARTPTS,afade=t=in:d=0\.030,afade=t=out:st=5\.470:d=0\.030\[a1\]/);
  assert.doesNotMatch(graph, /atempo/);
  assert.equal(args[args.length - 1], "out.mp4");
});

test("buildFfmpegArgs speeds up video and audio together", () => {
  const graph = buildFfmpegArgs("in.mp4", ranges, 1.25, "out.mp4");
  const g = graph[graph.indexOf("-filter_complex") + 1];
  assert.match(g, /concat=n=2:v=1:a=1\[vc\]\[ac\];\[vc\]setpts=PTS\/1\.25\[v\];\[ac\]atempo=1\.25\[a\]$/);
});

async function withTmp(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "fast-consume-render-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// A 60s synthetic talk: test pattern + tone, 2s keyframe interval so the
// cuts at 10s/40s and their ends aren't all on keyframes.
async function synthSource(dir: string): Promise<string> {
  const src = join(dir, "src.mp4");
  await execFileAsync("ffmpeg", [
    "-v", "error", "-y",
    "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30:duration=60",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=60",
    "-c:v", "libx264", "-g", "60", "-c:a", "aac", "-shortest",
    src,
  ]);
  return src;
}

test("render cuts exactly the requested ranges into one file", async () => {
  await withTmp(async (dir) => {
    const src = await synthSource(dir);
    const out = join(dir, "out.mp4");
    let lastProgress = 0;
    await render(src, ranges, 1, out, 15.5, (f) => (lastProgress = f));
    const info = await probe(out);
    assert.ok(info.hasVideo && info.hasAudio);
    assert.ok(Math.abs(info.durationS - 15.5) < 0.1, `duration ${info.durationS}`);
    assert.ok(lastProgress > 0.9, `progress ${lastProgress}`);
    assert.deepEqual((await readdir(dir)).sort(), ["out.mp4", "src.mp4"]);
  });
});

test("render at 1.5x shortens the output accordingly", async () => {
  await withTmp(async (dir) => {
    const src = await synthSource(dir);
    const out = join(dir, "out.mp4");
    await render(src, ranges, 1.5, out, 15.5 / 1.5, () => {});
    const info = await probe(out);
    assert.ok(Math.abs(info.durationS - 15.5 / 1.5) < 0.15, `duration ${info.durationS}`);
  });
});

test("a failed render leaves no partial file and no output", async () => {
  await withTmp(async (dir) => {
    const bad = join(dir, "bad.mp4");
    await writeFile(bad, "not a video");
    await assert.rejects(render(bad, ranges, 1, join(dir, "out.mp4"), 15.5, () => {}), (err: unknown) => {
      assert.ok(err instanceof FastConsumeError);
      assert.equal(err.exitCode, EXIT.render);
      return true;
    });
    assert.deepEqual(await readdir(dir), ["bad.mp4"]);
  });
});
