#!/usr/bin/env python3
"""
Pulls YouTube auto-caption transcripts for every video in
data/sources/youtube-videos.json via yt-dlp, cleans the rolling-caption VTT
format into plain continuous text, and writes data/sources/youtube-transcripts.json
keyed by videoId. Writes incrementally so a partial/interrupted run isn't lost.

Only a *confirmed* absence of captions (yt-dlp succeeded but wrote no .vtt
file) is persisted as null — a failed/blocked/timed-out request is left out
of the output entirely so the next run retries it, the same guarantee
pull-youtube-metadata.py already makes. Getting this wrong is a real data
corruption risk: `existing`/`todo` below treats any key present — including
null — as permanently resolved, so persisting a transient failure as null
would silently and irreversibly mark a video as caption-less forever. This
bit in CI on 2026-09-29: the default "web" yt-dlp client hits YouTube's
"Sign in to confirm you're not a bot" wall after a few hundred requests in a
session (the exact issue pull-youtube-metadata.py already worked around with
`player_client=android`), and nearly every request after that point was
misrecorded as "no captions" before this fix.

If data/sources/new-video-ids.json exists (pull-youtube-videos.py writes it
every run, listing just the video IDs that run discovered as new), this
only processes those — so the daily action can run this safely every day,
backfilling transcripts for today's new videos without re-scanning the
entire tracked catalog. Without that file (e.g. a manual one-off run), it
falls back to the full catalog, capped to BATCH_LIMIT videos per invocation
(env var, default 2000), and bails out early if the first 30 requests are
mostly failures — same reasoning as pull-youtube-metadata.py: the calling
workflow only commits after this step finishes, so an uncapped run against
a 10,000+ video cold backlog that gets killed by the job timeout saves
nothing, and hammering a blocked/rate-limited session harder doesn't
unblock it.

Run with: python3 scripts/pull-youtube-transcripts.py
"""
import json
import os
import re
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEOS_PATH = os.path.join(REPO, "data", "sources", "youtube-videos.json")
OUT_PATH = os.path.join(REPO, "data", "sources", "youtube-transcripts.json")
NEW_IDS_PATH = os.path.join(REPO, "data", "sources", "new-video-ids.json")
CONCURRENCY = 5
TIMEOUT_S = 45
MAX_ATTEMPTS = 3
RETRY_BACKOFF_S = 5
BATCH_LIMIT = int(os.environ.get("BATCH_LIMIT", "2000"))
CIRCUIT_BREAKER_AFTER = 30
CIRCUIT_BREAKER_FAIL_RATE = 0.8


class FetchFailed(Exception):
    """The request itself failed/was blocked — distinct from a confirmed
    absence of captions. Never persisted; the video stays eligible for the
    next run."""


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


def fetch_transcript_once(video_id: str) -> str | None:
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
                    "--sleep-requests", "1.5",
                    # see module docstring — the default "web" client hits a
                    # bot-check wall after enough requests in a session.
                    "--extractor-args", "youtube:player_client=android",
                    f"https://www.youtube.com/watch?v={video_id}",
                    "-o", out_template,
                ],
                capture_output=True,
                text=True,
                timeout=TIMEOUT_S,
            )
        except subprocess.TimeoutExpired:
            raise FetchFailed("timeout")

        if proc.returncode != 0:
            raise FetchFailed(proc.stderr.strip()[:200])

        vtt_path = out_template + ".en.vtt"
        if not os.path.exists(vtt_path):
            return None  # confirmed: request succeeded, no captions exist
        text = clean_vtt(vtt_path)
        return text if text else None


def fetch_transcript(video_id: str) -> str | None:
    last_error: FetchFailed | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return fetch_transcript_once(video_id)
        except FetchFailed as e:
            last_error = e
            if attempt < MAX_ATTEMPTS:
                time.sleep(RETRY_BACKOFF_S * attempt)
    raise last_error


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

    new_only = None
    if os.path.exists(NEW_IDS_PATH):
        new_only = set(json.load(open(NEW_IDS_PATH)))
        all_ids = [vid for vid in all_ids if vid in new_only]

    todo_all = [vid for vid in all_ids if vid not in existing]
    todo = todo_all if new_only is not None else todo_all[:BATCH_LIMIT]
    if new_only is not None:
        scope = f"{len(new_only)} newly-discovered videos this run"
        already_done = len(new_only) - len(todo_all)
    else:
        scope = f"{len(all_ids)} total videos"
        already_done = len(existing)
    print(
        f"{scope}, {already_done} already done, "
        f"{len(todo_all)} remaining, processing {len(todo)} this run"
    )

    done_count = 0
    ok_count = 0
    failed_count = 0
    breaker_tripped = False

    def save():
        json.dump(existing, open(OUT_PATH, "w"), indent=2, ensure_ascii=False)

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(fetch_transcript, vid): vid for vid in todo}
        for fut in as_completed(futures):
            vid = futures[fut]
            done_count += 1
            try:
                text = fut.result()
            except FetchFailed as e:
                failed_count += 1
                print(f"[{done_count}/{len(todo)}] {vid} FAILED, left for next run: {e}")
            else:
                if text:
                    existing[vid] = text
                    ok_count += 1
                    print(f"[{done_count}/{len(todo)}] {vid} OK ({len(text)} chars)")
                else:
                    existing[vid] = None
                    print(f"[{done_count}/{len(todo)}] {vid} no captions")
            if done_count % 10 == 0:
                save()
            if (
                not breaker_tripped
                and done_count == CIRCUIT_BREAKER_AFTER
                and failed_count / done_count >= CIRCUIT_BREAKER_FAIL_RATE
            ):
                breaker_tripped = True
                cancelled = sum(1 for f in futures if f.cancel())
                print(
                    f"{failed_count}/{done_count} of the first {CIRCUIT_BREAKER_AFTER} requests failed — "
                    f"session looks blocked/rate-limited, not going to recover by retrying harder. "
                    f"Cancelled {cancelled} not-yet-started requests; leaving them for the next run."
                )

    save()
    print(f"done: {ok_count}/{len(todo)} fetched with real transcript text, {failed_count} failed (left for next run)")


if __name__ == "__main__":
    main()
