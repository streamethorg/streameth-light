// Re-encodes the chosen ranges into one MP4. It re-encodes rather than
// stream-copies on purpose: cuts have to land on sentence boundaries, not on
// whatever keyframe is nearby, and a condensed cut is a small part of the
// talk, so encoding it is cheap.
//
// Each range is its own input with an input-side -ss. With re-encoding,
// ffmpeg decodes from the keyframe before -ss and drops frames up to it, so
// the cut is frame-accurate, and only the kept ~10% of the talk is ever
// decoded. (One input with a trim filter per range would decode the whole
// talk.)
import { spawn, execFile } from "node:child_process";
import { rename, unlink } from "node:fs/promises";
import { promisify } from "node:util";
import { EXIT, FastConsumeError } from "./errors.ts";
import type { Range } from "./ranges.ts";

const execFileAsync = promisify(execFile);

// Short fades at every cut: a hard cut through a waveform clicks.
const AUDIO_FADE_S = 0.03;

export interface ProbeResult {
  durationS: number;
  hasVideo: boolean;
  hasAudio: boolean;
  // Of the first video stream; 0 when there is none.
  width: number;
  height: number;
  fps: number;
}

export async function probe(path: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type,width,height,avg_frame_rate",
    "-of", "json",
    path,
  ]);
  const json = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string; width?: number; height?: number; avg_frame_rate?: string }>;
  };
  const durationS = parseFloat(json.format?.duration ?? "");
  if (!Number.isFinite(durationS)) throw new Error(`ffprobe found no duration in ${path}`);
  const types = new Set((json.streams ?? []).map((s) => s.codec_type));
  const video = (json.streams ?? []).find((s) => s.codec_type === "video");
  // avg_frame_rate is a fraction ("30000/1001"); "0/0" when ffprobe can't tell.
  const [num, den] = (video?.avg_frame_rate ?? "0/0").split("/").map(Number);
  const fps = den > 0 && Number.isFinite(num / den) ? num / den : 0;
  return {
    durationS,
    hasVideo: types.has("video"),
    hasAudio: types.has("audio"),
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    fps,
  };
}

export function buildFfmpegArgs(input: string, ranges: Range[], speed: number, outPath: string): string[] {
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1"];
  for (const r of ranges) {
    args.push("-ss", r.startS.toFixed(3), "-t", (r.endS - r.startS).toFixed(3), "-i", input);
  }

  const parts: string[] = [];
  const concatInputs: string[] = [];
  ranges.forEach((r, i) => {
    const len = r.endS - r.startS;
    const fade = Math.min(AUDIO_FADE_S, len / 4);
    parts.push(`[${i}:v:0]setpts=PTS-STARTPTS[v${i}]`);
    parts.push(
      `[${i}:a:0]asetpts=PTS-STARTPTS,afade=t=in:d=${fade.toFixed(3)},afade=t=out:st=${(len - fade).toFixed(3)}:d=${fade.toFixed(3)}[a${i}]`
    );
    concatInputs.push(`[v${i}][a${i}]`);
  });
  const sped = speed !== 1;
  parts.push(`${concatInputs.join("")}concat=n=${ranges.length}:v=1:a=1[${sped ? "vc" : "v"}][${sped ? "ac" : "a"}]`);
  if (sped) {
    // atempo keeps the pitch; valid for 0.5-2.0, and speed is capped at 1.5.
    parts.push(`[vc]setpts=PTS/${speed}[v]`, `[ac]atempo=${speed}[a]`);
  }

  args.push(
    "-filter_complex", parts.join(";"),
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
    outPath
  );
  return args;
}

// Renders to a .partial file and renames it into place, so outPath only
// ever holds a finished file. nice'd: on a workstation this runs next to
// live ingest, which must not stutter.
export async function render(
  input: string,
  ranges: Range[],
  speed: number,
  outPath: string,
  expectedDurationS: number,
  onProgress: (fraction: number) => void
): Promise<void> {
  const partial = outPath.replace(/\.mp4$/, `.partial.${process.pid}.mp4`);
  const args = buildFfmpegArgs(input, ranges, speed, partial);
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("nice", ["-n", "10", "ffmpeg", ...args], { stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      let buffered = "";
      child.stdout.on("data", (chunk: Buffer) => {
        buffered += chunk.toString();
        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";
        for (const line of lines) {
          const m = /^out_time_us=(\d+)/.exec(line);
          if (m && expectedDurationS > 0) onProgress(Math.min(1, Number(m[1]) / 1e6 / expectedDurationS));
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with ${code}: ${stderr.trim().split("\n").slice(-5).join(" | ")}`));
      });
    });
    await rename(partial, outPath);
  } catch (err) {
    await unlink(partial).catch(() => {});
    throw new FastConsumeError(`render failed: ${(err as Error).message}`, EXIT.render);
  }
}
