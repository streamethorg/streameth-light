#!/usr/bin/env python3
"""
Pulls full per-video metadata (duration, view/like counts, exact upload
date, real description, tags, categories, channel) for every video in
data/sources/youtube-videos.json via yt-dlp --dump-single-json.

pull-youtube-videos.py deliberately uses --flat-playlist for speed, which
only lists id/title/approximate-date per channel in one call and leaves
description null with no duration/views/tags at all. This does the heavier
one-request-per-video pull to fill that in. Writes incrementally to
data/sources/youtube-metadata.json keyed by videoId, so an interrupted run
resumes instead of restarting.

Run with: python3 scripts/pull-youtube-metadata.py
"""
import json
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEOS_PATH = os.path.join(REPO, "data", "sources", "youtube-videos.json")
OUT_PATH = os.path.join(REPO, "data", "sources", "youtube-metadata.json")
CONCURRENCY = 6
TIMEOUT_S = 30
SAVE_EVERY = 25

FIELDS = [
    "duration",
    "view_count",
    "like_count",
    "upload_date",
    "description",
    "tags",
    "categories",
    "channel",
    "uploader",
]


def fetch_metadata(video_id: str) -> dict | None:
    try:
        proc = subprocess.run(
            [
                "yt-dlp",
                "--dump-single-json",
                "--no-warnings",
                "--skip-download",
                f"https://www.youtube.com/watch?v={video_id}",
            ],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        return None
    if proc.returncode != 0:
        return None
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None
    return {field: data.get(field) for field in FIELDS}


def main() -> None:
    videos = json.load(open(VIDEOS_PATH))
    all_ids = []
    for vids in videos.values():
        for v in vids:
            if v.get("videoId"):
                all_ids.append(v["videoId"])
    all_ids = list(dict.fromkeys(all_ids))  # dedupe, preserve order

    existing = {}
    if os.path.exists(OUT_PATH):
        existing = json.load(open(OUT_PATH))

    todo = [vid for vid in all_ids if vid not in existing]
    print(f"{len(all_ids)} total videos, {len(existing)} already done, {len(todo)} to fetch", flush=True)

    done_count = 0
    ok_count = 0

    def save():
        json.dump(existing, open(OUT_PATH, "w"), indent=None, separators=(",", ":"), ensure_ascii=False)

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(fetch_metadata, vid): vid for vid in todo}
        for fut in as_completed(futures):
            vid = futures[fut]
            done_count += 1
            try:
                meta = fut.result()
            except Exception as e:
                meta = None
                print(f"[{done_count}/{len(todo)}] {vid} ERROR {e}", flush=True)
            if meta:
                existing[vid] = meta
                ok_count += 1
                print(f"[{done_count}/{len(todo)}] {vid} OK (duration={meta.get('duration')}, views={meta.get('view_count')})", flush=True)
            else:
                existing[vid] = None
                print(f"[{done_count}/{len(todo)}] {vid} failed", flush=True)
            if done_count % SAVE_EVERY == 0:
                save()

    save()
    print(f"done: {ok_count}/{len(todo)} fetched", flush=True)


if __name__ == "__main__":
    main()
