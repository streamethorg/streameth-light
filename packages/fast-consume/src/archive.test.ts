import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { findVideo, parseVideoRef } from "./archive.ts";
import { EXIT, FastConsumeError } from "./errors.ts";

test("parseVideoRef takes an id, a watch page URL or a YouTube URL", () => {
  assert.equal(parseVideoRef(" yt-bXe3ass7I-o "), "yt-bXe3ass7I-o");
  assert.equal(parseVideoRef("65b8f60ca5b2d09b88ec0c8f"), "65b8f60ca5b2d09b88ec0c8f");
  assert.equal(parseVideoRef("https://streameth.org/watch/yt-bXe3ass7I-o"), "yt-bXe3ass7I-o");
  assert.equal(parseVideoRef("http://localhost:3000/watch/65b8f60ca5b2d09b88ec0c8f.md"), "65b8f60ca5b2d09b88ec0c8f");
  assert.equal(parseVideoRef("https://www.youtube.com/watch?v=bXe3ass7I-o&t=42s"), "yt-bXe3ass7I-o");
  assert.equal(parseVideoRef("https://youtu.be/bXe3ass7I-o?si=x"), "yt-bXe3ass7I-o");
  assert.equal(parseVideoRef("https://www.youtube.com/live/bXe3ass7I-o"), "yt-bXe3ass7I-o");
  assert.throws(() => parseVideoRef("https://example.com/talks/1"), /isn't a watch page or YouTube URL/);
  assert.throws(() => parseVideoRef("../../etc"), /isn't a video id/);
});

async function withDb(fn: (path: string) => void): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "fast-consume-db-"));
  const path = join(dir, "streameth.db");
  // The columns findVideo reads, as scripts/build-db.mjs creates them.
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE videos (
    id TEXT PRIMARY KEY, source TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    org_name TEXT NOT NULL DEFAULT '', event_name TEXT NOT NULL DEFAULT '', watch_url TEXT NOT NULL,
    speakers TEXT NOT NULL DEFAULT '', download_url TEXT, content_url TEXT)`);
  db.prepare("INSERT INTO videos VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "65b8f60ca5b2d09b88ec0c8f", "streameth", "Consumer Goods", "About goods.", "Base", "Base House",
    "/watch/65b8f60ca5b2d09b88ec0c8f", "Jesse Pollak, Maryam Mazrei", "https://cdn.example/1080p0.mp4", "https://cdn.example/index.m3u8"
  );
  db.close();
  try {
    fn(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("findVideo reads the archive's row for the id", async () => {
  await withDb((path) => {
    assert.deepEqual(findVideo("65b8f60ca5b2d09b88ec0c8f", path), {
      id: "65b8f60ca5b2d09b88ec0c8f",
      source: "streameth",
      title: "Consumer Goods",
      description: "About goods.",
      orgName: "Base",
      eventName: "Base House",
      speakers: ["Jesse Pollak", "Maryam Mazrei"],
      watchUrl: "/watch/65b8f60ca5b2d09b88ec0c8f",
      downloadUrl: "https://cdn.example/1080p0.mp4",
      contentUrl: "https://cdn.example/index.m3u8",
    });
  });
});

test("findVideo says when the id isn't in the archive, or there's no archive", async () => {
  await withDb((path) => {
    assert.throws(() => findVideo("yt-nope", path), (err: unknown) => {
      assert.ok(err instanceof FastConsumeError);
      assert.equal(err.exitCode, EXIT.sourceNotFound);
      assert.match(err.message, /no video yt-nope in the archive/);
      return true;
    });
  });
  assert.throws(() => findVideo("x", join(tmpdir(), "no-such-dir", "streameth.db")), /pnpm build-db/);
});
