#!/usr/bin/env python3
# Alternate transcript backfill path using the `youtube-transcript-api`
# package instead of yt-dlp. It hits YouTube's caption endpoint directly
# (no heavy "resolve player response" step), which is a different request
# pattern than yt-dlp's --write-auto-sub and in practice tolerates more
# sustained volume before YouTube's bot-check kicks in — run this alongside
# scripts/pull-youtube-transcripts.py (which is already running against the
# other half of the backlog) rather than instead of it.
#
# Writes to data/sources/youtube-transcripts-ytapi.json (a separate file
# from the main youtube-transcripts.json) so this and the concurrently
# running yt-dlp-based backfill never race on the same file. Merge both into
# youtube-transcripts.json with scripts/merge-ytapi-transcripts.py once done.
#
# Does not shard against the yt-dlp-based backfill — both just pull from
# whatever's not yet done as of their own start, so there's some redundant
# work where the two overlap, but no coordination needed and no risk of
# missing a video.
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

ROOT = Path(__file__).resolve().parent.parent
VIDEOS_PATH = ROOT / "data" / "sources" / "youtube-videos.json"
MAIN_OUT_PATH = ROOT / "data" / "sources" / "youtube-transcripts.json"
OUT_PATH = ROOT / "data" / "sources" / "youtube-transcripts-ytapi.json"
CONCURRENCY = 8

api = YouTubeTranscriptApi()


def fetch(video_id: str) -> str | None:
    try:
        transcript = api.fetch(video_id, languages=["en", "en-US", "en-GB"])
    except (NoTranscriptFound, TranscriptsDisabled, VideoUnavailable):
        return None
    except Exception:
        raise
    text = " ".join(s.text for s in transcript if s.text).strip()
    return text if text else None


def main() -> None:
    videos = json.load(open(VIDEOS_PATH))
    all_ids = []
    for vids in videos.values():
        for v in vids:
            if v.get("videoId"):
                all_ids.append(v["videoId"])
    all_ids = list(dict.fromkeys(all_ids))

    done_already = {}
    if MAIN_OUT_PATH.exists():
        done_already.update(json.load(open(MAIN_OUT_PATH)))
    if OUT_PATH.exists():
        done_already.update(json.load(open(OUT_PATH)))

    todo = [vid for vid in all_ids if vid not in done_already]
    print(f"{len(all_ids)} total videos, {len(todo)} to fetch", flush=True)

    result = json.load(open(OUT_PATH)) if OUT_PATH.exists() else {}
    done_count = 0
    ok_count = 0
    fail_count = 0

    def save():
        json.dump(result, open(OUT_PATH, "w"), indent=None, separators=(",", ":"), ensure_ascii=False)

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(fetch, vid): vid for vid in todo}
        for fut in as_completed(futures):
            vid = futures[fut]
            done_count += 1
            try:
                text = fut.result()
            except Exception as e:
                fail_count += 1
                print(f"[{done_count}/{len(todo)}] {vid} FAILED (left for retry): {e}", flush=True)
                continue
            if text:
                result[vid] = text
                ok_count += 1
                print(f"[{done_count}/{len(todo)}] {vid} OK ({len(text)} chars)", flush=True)
            else:
                result[vid] = None
                print(f"[{done_count}/{len(todo)}] {vid} no captions", flush=True)
            if done_count % 25 == 0:
                save()

    save()
    print(f"done: {ok_count}/{len(todo)} fetched, {fail_count} failed (left for retry)", flush=True)


if __name__ == "__main__":
    main()
