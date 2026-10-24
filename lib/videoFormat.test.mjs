import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVideoFormat, videoFormat } from "./videoFormat.mjs";

test("the /shorts tab is a Short whatever its length", () => {
  assert.equal(videoFormat({ source: "youtube", tab: "shorts", durationSeconds: 58 }), "short");
  assert.equal(videoFormat({ source: "youtube", tab: "shorts", durationSeconds: null }), "short");
});

test("the /streams tab, or any live status, is a stream", () => {
  assert.equal(videoFormat({ source: "youtube", tab: "streams", durationSeconds: 8 * 3600 }), "stream");
  assert.equal(videoFormat({ source: "youtube", tab: "videos", liveStatus: "was_live" }), "stream");
});

test("/videos uploads split into clips and talks at 20 minutes", () => {
  assert.equal(videoFormat({ source: "youtube", tab: "videos", durationSeconds: 3 * 60 }), "clip");
  assert.equal(videoFormat({ source: "youtube", tab: "videos", durationSeconds: 20 * 60 }), "clip");
  assert.equal(videoFormat({ source: "youtube", tab: "videos", durationSeconds: 45 * 60 }), "talk");
});

test("entries stored before tabs were tracked count as /videos", () => {
  assert.equal(videoFormat({ source: "youtube", durationSeconds: 5 * 60 }), "clip");
});

test("unknown duration is a talk; StreamETH sessions are always talks", () => {
  assert.equal(videoFormat({ source: "youtube", tab: "videos", durationSeconds: null }), "talk");
  assert.equal(videoFormat({ source: "streameth" }), "talk");
});

test("parseVideoFormat only accepts real formats", () => {
  assert.equal(parseVideoFormat("short"), "short");
  assert.equal(parseVideoFormat("podcast"), undefined);
  assert.equal(parseVideoFormat(null), undefined);
});
