#!/usr/bin/env python3
# Merges data/sources/youtube-transcripts-ytapi.json (written by
# backfill-transcripts-ytapi.py, run separately to avoid racing with the
# yt-dlp-based backfill on the same file) into the main
# data/sources/youtube-transcripts.json. A video with real text in either
# file wins; a video marked null in one file is only kept null if the other
# file doesn't have real text for it either.
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAIN_PATH = ROOT / "data" / "sources" / "youtube-transcripts.json"
YTAPI_PATH = ROOT / "data" / "sources" / "youtube-transcripts-ytapi.json"


def main() -> None:
    main_data = json.load(open(MAIN_PATH)) if MAIN_PATH.exists() else {}
    ytapi_data = json.load(open(YTAPI_PATH)) if YTAPI_PATH.exists() else {}

    added_real = 0
    added_null = 0
    for vid, text in ytapi_data.items():
        if text:
            if not main_data.get(vid):
                added_real += 1
            main_data[vid] = text
        elif vid not in main_data:
            main_data[vid] = None
            added_null += 1

    MAIN_PATH.write_text(json.dumps(main_data, ensure_ascii=False))
    print(f"Merged: {added_real} real transcripts added/upgraded, {added_null} new no-caption confirmations")
    print(f"{MAIN_PATH} now has {len(main_data)} entries")


if __name__ == "__main__":
    main()
