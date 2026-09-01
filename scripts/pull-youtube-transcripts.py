#!/usr/bin/env python3
"""
Pulls YouTube auto-caption transcripts for every video in
data/sources/youtube-videos.json via yt-dlp, cleans the rolling-caption VTT
format into plain continuous text, and writes data/sources/youtube-transcripts.json
keyed by videoId. Writes incrementally so a partial/interrupted run isn't lost.

Run with: python3 scripts/pull-youtube-transcripts.py
"""
import json
import os
import re
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEOS_PATH = os.path.join(REPO, "data", "sources", "youtube-videos.json")
OUT_PATH = os.path.join(REPO, "data", "sources", "youtube-transcripts.json")
CONCURRENCY = 5
TIMEOUT_S = 45


def clean_vtt(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()

    # strip header + cue metadata lines, keep only cue text blocks
    blocks = re.split(r"\n\n+", raw)
    prev = ""
    pieces = []
    for block in blocks:
        lines = block.strip().splitlines()
        lines = [l for l in lines if "-->" not in l and l.strip() and not l.startswith("WEBVTT") and not l.startswith("Kind:") and not l.startswith("Language:")]
        if not lines:
            continue
        text = " ".join(lines)
        text = re.sub(r"<[^>]+>", "", text)  # strip word-level timing tags
        text = re.sub(r"\s+", " ", text).strip()
        if not text:
            continue
        if text.startswith(prev) and len(text) > len(prev):
            pieces.append(text[len(prev):].strip())
        elif text not in prev:
            pieces.append(text)
        prev = text

    full = " ".join(p for p in pieces if p)
    full = re.sub(r"\s+", " ", full).strip()
    return full


def fetch_transcript(video_id: str) -> str | None:
    with tempfile.TemporaryDirectory() as tmp:
        out_template = os.path.join(tmp, "sub")
        try:
            proc = subprocess.run(
                [
                    "yt-dlp",
                    "--write-auto-sub",
                    "--sub-lang", "en",
                    "--skip-download",
                    "--sub-format", "vtt",
                    "--no-warnings",
                    f"https://www.youtube.com/watch?v={video_id}",
                    "-o", out_template,
                ],
                capture_output=True,
                text=True,
                timeout=TIMEOUT_S,
            )
        except subprocess.TimeoutExpired:
            return None

        vtt_path = out_template + ".en.vtt"
        if not os.path.exists(vtt_path):
            return None
        text = clean_vtt(vtt_path)
        return text if text else None


def main():
    videos = json.load(open(VIDEOS_PATH))
    all_ids = []
    for slug, vids in videos.items():
        for v in vids:
            if v.get("videoId"):
                all_ids.append(v["videoId"])
    all_ids = list(dict.fromkeys(all_ids))  # dedupe, preserve order

    existing = {}
    if os.path.exists(OUT_PATH):
        existing = json.load(open(OUT_PATH))

    todo = [vid for vid in all_ids if vid not in existing]
    print(f"{len(all_ids)} total videos, {len(existing)} already done, {len(todo)} to fetch")

    done_count = 0
    ok_count = 0

    def save():
        json.dump(existing, open(OUT_PATH, "w"), indent=2, ensure_ascii=False)

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(fetch_transcript, vid): vid for vid in todo}
        for fut in as_completed(futures):
            vid = futures[fut]
            done_count += 1
            try:
                text = fut.result()
            except Exception as e:
                text = None
                print(f"[{done_count}/{len(todo)}] {vid} ERROR {e}")
            if text:
                existing[vid] = text
                ok_count += 1
                print(f"[{done_count}/{len(todo)}] {vid} OK ({len(text)} chars)")
            else:
                existing[vid] = None
                print(f"[{done_count}/{len(todo)}] {vid} no captions")
            if done_count % 10 == 0:
                save()

    save()
    print(f"done: {ok_count}/{len(todo)} fetched with real transcript text")


if __name__ == "__main__":
    main()
