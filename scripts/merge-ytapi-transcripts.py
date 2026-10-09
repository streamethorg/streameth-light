#!/usr/bin/env python3
# Merges data/sources/youtube-transcripts-ytapi.json (written by
# backfill-transcripts-ytapi.py, run separately to avoid racing with the
# yt-dlp-based backfill on the same files) into the sharded
# data/sources/youtube-transcripts/ dataset (see transcript_shards.py). A
# video with real text in either source wins; a video marked null in one is
# only kept null if the other doesn't have real text for it either.
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import transcript_shards as shards

DATA_DIR = ROOT / "data"
YTAPI_PATH = DATA_DIR / "sources" / "youtube-transcripts-ytapi.json"


def main() -> None:
    ytapi_data = json.load(open(YTAPI_PATH)) if YTAPI_PATH.exists() else {}
    if not ytapi_data:
        print("Nothing to merge")
        return

    shard_cache: dict[int, dict] = {}
    added_real = 0
    added_null = 0
    dirty: set[int] = set()

    for vid, text in ytapi_data.items():
        s = shards.shard_for(vid)
        if s not in shard_cache:
            shard_cache[s] = shards.load_shard(DATA_DIR, s)
        sd = shard_cache[s]
        if text:
            if not sd.get(vid):
                added_real += 1
            sd[vid] = text
            dirty.add(s)
        elif vid not in sd:
            sd[vid] = None
            added_null += 1
            dirty.add(s)

    for s in dirty:
        shards.save_shard(DATA_DIR, s, shard_cache[s])

    total = sum(len(shards.load_shard(DATA_DIR, i)) for i in range(shards.SHARD_COUNT))
    print(f"Merged: {added_real} real transcripts added/upgraded, {added_null} new no-caption confirmations")
    print(f"youtube-transcripts/ now has {total} entries across {shards.SHARD_COUNT} shards")


if __name__ == "__main__":
    main()
