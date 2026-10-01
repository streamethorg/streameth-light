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

Only successful fetches are persisted — a failure (YouTube rate-limits
after enough sustained requests, then recovers) is retried within the run
with backoff, and if it still fails is simply left out of the output file
so the *next* run retries it too, rather than being permanently recorded
as null.

Capped to BATCH_LIMIT videos per invocation (env var, default 2000) — a
cold backlog (e.g. this script's first-ever run against the full catalog,
or against several newly-discovered channels at once) can be 10,000+
videos, which doesn't fit in a CI job's time budget in one go regardless of
fetch speed. The calling workflow commits after every run, so a capped run
still makes real, saved forward progress; an uncapped run that times out
mid-way saves nothing, because nothing gets committed until the step
finishes (confirmed in CI on 2026-09-29/30: two consecutive ~5-hour runs
against an uncapped ~14k-video backlog were each killed by the job timeout
before reaching the commit step, so neither saved any of that work).

Also bails out early if the first 30 attempts are mostly failures (a
blocked/rate-limited session recovers on its own time, not by retrying
harder) rather than burning the rest of the run's time budget on a session
that isn't going to start succeeding.

Run with: python3 scripts/pull-youtube-metadata.py
"""
import json
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEOS_PATH = os.path.join(REPO, "data", "sources", "youtube-videos.json")
OUT_PATH = os.path.join(REPO, "data", "sources", "youtube-metadata.json")
BATCH_LIMIT = int(os.environ.get("BATCH_LIMIT", "2000"))
CIRCUIT_BREAKER_AFTER = 30
CIRCUIT_BREAKER_FAIL_RATE = 0.8
CONCURRENCY = 5
TIMEOUT_S = 30
SAVE_EVERY = 25
SLEEP_REQUESTS = "1.5"
MAX_ATTEMPTS = 3
RETRY_BACKOFF_S = 5

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


def fetch_once(video_id: str) -> dict | None:
    try:
        proc = subprocess.run(
            [
                "yt-dlp",
                "--dump-single-json",
                "--no-warnings",
                "--skip-download",
                "--sleep-requests", SLEEP_REQUESTS,
                # The default "web" client hits YouTube's "Sign in to confirm
                # you're not a bot" wall after enough requests in a session
                # (confirmed: ~600 videos in, then every request failed).
                # The android client's API doesn't require it.
                "--extractor-args", "youtube:player_client=android",
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


def fetch_metadata(video_id: str) -> dict | None:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        meta = fetch_once(video_id)
        if meta:
            return meta
        if attempt < MAX_ATTEMPTS:
            time.sleep(RETRY_BACKOFF_S * attempt)
    return None


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
        # Drop any nulls a previous (buggier) run may have persisted for
        # failed fetches, so this run retries them instead of skipping.
        existing = {k: v for k, v in json.load(open(OUT_PATH)).items() if v}

    todo_all = [vid for vid in all_ids if vid not in existing]
    todo = todo_all[:BATCH_LIMIT]
    print(
        f"{len(all_ids)} total videos, {len(existing)} already done, "
        f"{len(todo_all)} remaining, processing {len(todo)} this run",
        flush=True,
    )

    done_count = 0
    ok_count = 0
    fail_count = 0
    breaker_tripped = False

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
                fail_count += 1
                print(f"[{done_count}/{len(todo)}] {vid} failed after {MAX_ATTEMPTS} attempts", flush=True)
            if done_count % SAVE_EVERY == 0:
                save()
            if (
                not breaker_tripped
                and done_count == CIRCUIT_BREAKER_AFTER
                and fail_count / done_count >= CIRCUIT_BREAKER_FAIL_RATE
            ):
                breaker_tripped = True
                cancelled = sum(1 for f in futures if f.cancel())
                print(
                    f"{fail_count}/{done_count} of the first {CIRCUIT_BREAKER_AFTER} requests failed — "
                    f"session looks blocked/rate-limited, not going to recover by retrying harder. "
                    f"Cancelled {cancelled} not-yet-started requests; leaving them for the next run.",
                    flush=True,
                )

    save()
    print(f"done: {ok_count} fetched, {fail_count} still failing (left out for next run)", flush=True)


if __name__ == "__main__":
    main()
