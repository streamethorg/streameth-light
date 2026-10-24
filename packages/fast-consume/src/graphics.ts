// The graphics pass: renders the condensed cut through the Remotion
// composition in src/graphics/ (name strap, logo, captions, progress line,
// closing card, background music) into the final MP4. It reads only the plain cut and its sidecar, so
// it can be re-run on its own (`fast-consume graphics <out.mp4>`) without
// another LLM call.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { Caption } from "@remotion/captions";
import { copyFile, link, mkdtemp, readFile, rename, rm, unlink } from "node:fs/promises";
import { setPriority, tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, FastConsumeError } from "./errors.ts";
import type { FastConsumeProps } from "./graphics/props.ts";
import { probe } from "./render.ts";

// The fields of the .json sidecar (index.ts) the graphics pass needs.
export interface GraphicsSidecar {
  title: string;
  speakers: string[];
  event: string;
  url: string;
  thesis: string;
  sourceDurationS: number;
  plainFile: string;
  // Background music file; empty for none.
  music: string;
  captions: Caption[];
}

export async function readGraphicsSidecar(path: string): Promise<GraphicsSidecar> {
  let raw: Partial<GraphicsSidecar>;
  try {
    raw = JSON.parse(await readFile(path, "utf-8"));
  } catch (err) {
    throw new FastConsumeError(`can't read sidecar ${path}: ${(err as Error).message}`, EXIT.sourceNotFound);
  }
  if (typeof raw.plainFile !== "string" || !Array.isArray(raw.captions)) {
    throw new FastConsumeError(
      `${path} has no plain cut or captions to draw on; it was made with --plain or by an older version, so run fast-consume again`,
      EXIT.sourceNotFound
    );
  }
  return {
    title: raw.title ?? "",
    speakers: raw.speakers ?? [],
    event: raw.event ?? "",
    url: raw.url ?? "",
    thesis: raw.thesis ?? "",
    sourceDurationS: raw.sourceDurationS ?? 0,
    plainFile: raw.plainFile,
    music: raw.music ?? "",
    captions: raw.captions,
  };
}

const ENTRY = join(dirname(fileURLToPath(import.meta.url)), "graphics", "index.ts");

// Renders to a .partial file and renames it into place, like render.ts.
export async function renderGraphics(
  sidecar: GraphicsSidecar,
  outPath: string,
  onProgress: (fraction: number) => void
): Promise<number> {
  let info;
  try {
    info = await probe(sidecar.plainFile);
  } catch (err) {
    throw new FastConsumeError(`can't read the plain cut ${sidecar.plainFile}: ${(err as Error).message}`, EXIT.sourceNotFound);
  }
  if (!info.width || !info.height || !info.fps) {
    throw new FastConsumeError(`${sidecar.plainFile} has no readable video stream`, EXIT.unsuitableSource);
  }

  if (sidecar.music) {
    try {
      const music = await probe(sidecar.music);
      if (!music.hasAudio) throw new Error("no audio stream");
    } catch (err) {
      throw new FastConsumeError(`can't use ${sidecar.music} as music: ${(err as Error).message}`, EXIT.usage);
    }
  }

  const props: FastConsumeProps = {
    videoSrc: "cut.mp4",
    musicSrc: sidecar.music ? `music${extname(sidecar.music) || ".mp3"}` : "",
    width: info.width,
    height: info.height,
    fps: info.fps,
    videoDurationS: info.durationS,
    sourceDurationS: sidecar.sourceDurationS,
    title: sidecar.title,
    speakers: sidecar.speakers,
    event: sidecar.event,
    url: sidecar.url,
    thesis: sidecar.thesis,
    captions: sidecar.captions,
  };

  // The bundle serves the cut from its public dir. The bundler copies that
  // dir but skips symlinks, so the cut goes in as a hard link (no copy on the
  // same volume), or as a copy when the temp dir is on another volume.
  const publicDir = await mkdtemp(join(tmpdir(), "fast-consume-public-"));
  let bundleDir: string | undefined;
  const partial = outPath.replace(/\.mp4$/, `.partial.${process.pid}.mp4`);
  try {
    const intoPublic = (from: string, name: string) => {
      const to = join(publicDir, name);
      return link(from, to).catch(() => copyFile(from, to));
    };
    await intoPublic(sidecar.plainFile, props.videoSrc);
    if (props.musicSrc) await intoPublic(sidecar.music, props.musicSrc);
    bundleDir = await bundle({ entryPoint: ENTRY, publicDir });
    const composition = await selectComposition({ serveUrl: bundleDir, id: "FastConsume", inputProps: props });
    // Chrome and ffmpeg inherit this, so the render stays behind live ingest
    // on a workstation, as the ffmpeg pass does with nice.
    setPriority(10);
    await renderMedia({
      composition,
      serveUrl: bundleDir,
      codec: "h264",
      crf: 20,
      x264Preset: "veryfast",
      audioBitrate: "160k",
      outputLocation: partial,
      inputProps: props,
      onProgress: ({ progress }) => onProgress(progress),
    });
    await rename(partial, outPath);
  } catch (err) {
    await unlink(partial).catch(() => {});
    throw new FastConsumeError(`graphics render failed: ${(err as Error).message}`, EXIT.render);
  } finally {
    await rm(publicDir, { recursive: true, force: true });
    if (bundleDir) await rm(bundleDir, { recursive: true, force: true });
  }
  return (await probe(outPath)).durationS;
}
