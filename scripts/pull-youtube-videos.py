#!/usr/bin/env python3
# Pulls the FULL upload list per known channel via yt-dlp (no API key, no
# quota — uses YouTube's internal web endpoints the same way the site's own
# /videos tab does). Replaces the old data/sources/youtube-videos.json, which
# was built from a single unpaginated call and silently capped every channel
# at 15 videos regardless of how many it actually had.
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIRECTORY_PATH = ROOT / "data" / "directory.json"
OUT_PATH = ROOT / "data" / "sources" / "youtube-videos.json"


def channel_videos_url(channel_url: str) -> str:
    return channel_url.rstrip("/") + "/videos"


def fetch_channel(url: str) -> list[dict]:
    proc = subprocess.run(
        [
            "yt-dlp",
            "--flat-playlist",
            "--extractor-args",
            "youtubetab:approximate_date",
            "--dump-single-json",
            "--no-warnings",
            url,
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if proc.returncode != 0:
        print(f"  ERROR: {proc.stderr.strip()[:300]}", file=sys.stderr)
        return []
    data = json.loads(proc.stdout)
    videos = []
    for e in data.get("entries", []):
        if not e or e.get("_type") != "url":
            continue
        vid = e.get("id")
        if not vid:
            continue
        ts = e.get("timestamp")
        thumbs = e.get("thumbnails") or []
        thumb = thumbs[-1]["url"] if thumbs else None
        videos.append(
            {
                "videoId": vid,
                "title": e.get("title") or "",
                "publishedAt": (
                    __import__("datetime")
                    .datetime.utcfromtimestamp(ts)
                    .isoformat() + "Z"
                    if ts
                    else None
                ),
                "thumbnail": thumb,
                "description": None,
            }
        )
    return videos


def main() -> None:
    directory = json.loads(DIRECTORY_PATH.read_text())["entries"]
    channels = [
        e for e in directory if e.get("youtubeChannel") and e.get("youtubeConfidence") != "none"
    ]
    print(f"{len(channels)} channels with a known YouTube URL")

    existing = json.loads(OUT_PATH.read_text()) if OUT_PATH.exists() else {}
    result = dict(existing)

    for i, entry in enumerate(channels, 1):
        slug = entry["slug"]
        url = channel_videos_url(entry["youtubeChannel"])
        print(f"[{i}/{len(channels)}] {slug} -> {url}")
        videos = fetch_channel(url)
        if videos:
            result[slug] = videos
            print(f"  {len(videos)} videos (was {len(existing.get(slug, []))})")
        else:
            print(f"  0 videos fetched, keeping existing {len(existing.get(slug, []))}")

    OUT_PATH.write_text(json.dumps(result, indent=None, separators=(",", ":")))
    total = sum(len(v) for v in result.values())
    print(f"\nWrote {OUT_PATH} — {len(result)} channels, {total} videos total")


if __name__ == "__main__":
    main()
