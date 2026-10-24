// A video from the archive (`--video <id>`): looked up in data/streameth.db
// (built from data/*.json by `pnpm build-db`, the same `videos` table the
// site reads in lib/videoDb.ts), downloaded once into a cache dir and
// transcribed there with Whisper.
//
// The archive's own transcripts can't drive a cut: they're plain text with
// no timings (data/transcripts.json, data/sources/youtube-transcripts/), and
// the YouTube ones have no punctuation either, so there are no sentences to
// cut on. Whisper gives both, with word timings for the captions.
import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, mkdir, rename, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { EXIT, FastConsumeError } from "./errors.ts";
import { fileSource, type Source } from "./source.ts";

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_DIR = join(PACKAGE_DIR, "..", "..");
export const DB_PATH = join(REPO_DIR, "data", "streameth.db");
const TRANSCRIBE_SCRIPT = join(PACKAGE_DIR, "scripts", "transcribe.py");

export interface ArchiveVideo {
  id: string;
  source: "streameth" | "youtube";
  title: string;
  description: string;
  orgName: string;
  eventName: string;
  speakers: string[];
  watchUrl: string;
  downloadUrl: string | null;
  contentUrl: string | null;
}

// The archive id for whatever the user pasted: an id as the site uses it
// ("yt-<videoId>" or a session _id), a watch page URL, or a YouTube URL.
export function parseVideoRef(ref: string): string {
  const s = ref.trim();
  let url: URL | null = null;
  try {
    url = new URL(s);
  } catch {
    // Not a URL: an id.
  }
  if (url) {
    const host = url.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return `yt-${url.pathname.slice(1).split("/")[0]}`;
    if (host === "youtube.com") {
      const v = url.searchParams.get("v") ?? /^\/(?:live|shorts|embed)\/([^/]+)/.exec(url.pathname)?.[1];
      if (v) return `yt-${v}`;
    }
    const watch = /\/watch\/([^/]+)/.exec(url.pathname);
    if (watch) return decodeURIComponent(watch[1]).replace(/\.md$/, "");
    throw new FastConsumeError(`${s} isn't a watch page or YouTube URL`, EXIT.usage);
  }
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new FastConsumeError(`${s} isn't a video id`, EXIT.usage);
  return s;
}

interface VideoRow {
  id: string;
  source: "streameth" | "youtube";
  title: string;
  description: string;
  org_name: string;
  event_name: string;
  speakers: string;
  watch_url: string;
  download_url: string | null;
  content_url: string | null;
}

export function findVideo(id: string, dbPath = DB_PATH): ArchiveVideo {
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
  } catch (err) {
    throw new FastConsumeError(
      `can't open ${dbPath} (${(err as Error).message}); build it with \`pnpm build-db\``,
      EXIT.sourceNotFound
    );
  }
  try {
    const row = db
      .prepare(
        `SELECT id, source, title, description, org_name, event_name, speakers, watch_url, download_url, content_url
         FROM videos WHERE id = ?`
      )
      .get(id) as VideoRow | undefined;
    if (!row) throw new FastConsumeError(`no video ${id} in the archive`, EXIT.sourceNotFound);
    return {
      id: row.id,
      source: row.source,
      title: row.title,
      description: row.description,
      orgName: row.org_name,
      eventName: row.event_name,
      // Same separator as build-db.mjs writes and lib/videoDb.ts reads.
      speakers: row.speakers ? row.speakers.split(", ").filter(Boolean) : [],
      watchUrl: row.watch_url,
      downloadUrl: row.download_url,
      contentUrl: row.content_url,
    };
  } finally {
    db.close();
  }
}

export function cacheDir(): string {
  return process.env.FAST_CONSUME_CACHE || join(homedir(), ".cache", "fast-consume");
}

export function siteUrl(): string {
  return (process.env.FAST_CONSUME_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://streameth.org").replace(/\/$/, "");
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  );
}

// Runs a command, passing its output through; rejects with the last of its
// stderr when it fails.
function run(cmd: string, args: string[], missingHint: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "inherit", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-2000);
      process.stderr.write(d);
    });
    child.on("error", (err: NodeJS.ErrnoException) =>
      reject(err.code === "ENOENT" ? new Error(`${cmd} isn't installed: ${missingHint}`) : err)
    );
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}: ${stderr.trim().split("\n").pop() ?? ""}`))
    );
  });
}

// 720p is plenty for a condensed cut with burned-in captions, and keeps the
// download and both encodes fast.
async function downloadYoutube(videoId: string, out: string): Promise<void> {
  await run(
    "yt-dlp",
    [
      "-f", "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/b[height<=720]",
      "--merge-output-format", "mp4",
      "--no-playlist",
      "--no-progress",
      "-o", out,
      `https://www.youtube.com/watch?v=${videoId}`,
    ],
    "brew install yt-dlp (or pip install yt-dlp)"
  );
}

async function downloadFile(url: string, out: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30 * 60_000) });
  if (!res.ok || !res.body) throw new Error(`${url} returned ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(out));
}

async function downloadHls(url: string, out: string): Promise<void> {
  await run("ffmpeg", ["-v", "error", "-y", "-i", url, "-c", "copy", "-bsf:a", "aac_adtstoasc", out], "brew install ffmpeg");
}

// Downloads to a .partial file and renames it into place, so a cached
// video.mp4 is always a whole one.
async function fetchVideo(video: ArchiveVideo, out: string): Promise<void> {
  const partial = `${out}.partial.mp4`;
  try {
    if (video.source === "youtube") {
      await downloadYoutube(video.id.replace(/^yt-/, ""), partial);
    } else if (video.downloadUrl) {
      await downloadFile(video.downloadUrl, partial);
    } else if (video.contentUrl) {
      await downloadHls(video.contentUrl, partial);
    } else {
      throw new Error("the archive has no playable URL for it");
    }
    await rename(partial, out);
  } catch (err) {
    await unlink(partial).catch(() => {});
    throw new FastConsumeError(`can't download ${video.id}: ${(err as Error).message}`, EXIT.download);
  }
}

function pythonOk(python: string): Promise<boolean> {
  return new Promise((resolve) =>
    execFile(python, ["-I", "-c", "import faster_whisper, numpy"], (err) => resolve(!err))
  );
}

async function transcribe(videoPath: string, out: string): Promise<void> {
  const python = process.env.FAST_CONSUME_PYTHON || "python3";
  if (!(await pythonOk(python))) {
    throw new FastConsumeError(
      `${python} can't import faster_whisper; install it (pip install faster-whisper) or point FAST_CONSUME_PYTHON at a Python that has it`,
      EXIT.transcript
    );
  }
  const partial = `${out}.partial`;
  try {
    await run(python, ["-I", TRANSCRIBE_SCRIPT, videoPath, partial], "set FAST_CONSUME_PYTHON");
    await rename(partial, out);
  } catch (err) {
    await unlink(partial).catch(() => {});
    throw new FastConsumeError(`transcription failed: ${(err as Error).message}`, EXIT.transcript);
  }
}

export async function archiveSource(opts: { ref: string; outPath?: string }): Promise<Source> {
  const video = findVideo(parseVideoRef(opts.ref));
  const dir = join(cacheDir(), video.id);
  await mkdir(dir, { recursive: true });
  const videoPath = join(dir, "video.mp4");
  const transcriptPath = join(dir, "transcript.json");

  if (await exists(videoPath)) {
    console.log(`using the downloaded video in ${dir}`);
  } else {
    console.log(`downloading ${video.id}…`);
    await fetchVideo(video, videoPath);
  }
  if (!(await exists(transcriptPath))) {
    console.log("transcribing with Whisper (a few minutes for a 20-minute talk)…");
    await transcribe(videoPath, transcriptPath);
  }

  const source = await fileSource({
    file: videoPath,
    transcriptPath,
    title: video.title,
    speakers: video.speakers,
    abstract: video.description,
    outPath: opts.outPath ?? join(REPO_DIR, "fast", `${video.id}.fast.mp4`),
  });
  return {
    ...source,
    meta: { videoId: video.id, archiveSource: video.source },
    event: video.eventName || video.orgName,
    url: `${siteUrl()}${video.watchUrl}`,
    // Sessions have their own title and speakers; YouTube uploads have
    // whatever the uploader typed.
    rawTitle: video.source === "youtube",
  };
}
