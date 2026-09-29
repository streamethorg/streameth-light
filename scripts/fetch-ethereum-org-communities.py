#!/usr/bin/env python3
# Refreshes data/sources/ethereum-org-communities.json from
# ethereum.org's own open-source repo — the exact file this data was
# originally copied from (src/data/community-meetups.json), fetched via
# GitHub's raw content CDN. No auth needed, no scraping, no rate limits
# beyond GitHub's normal ones.
#
# The upstream file only has title/location/link — this repo's copy also
# carries youtubeChannel/youtubeConfidence/youtubeNote fields added by a
# separate discovery pass (find-youtube-channels.py / guess-youtube-handles.py),
# so this merges by title rather than overwriting, keeping any channel
# already discovered for a meetup that's still listed upstream.
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "data" / "sources" / "ethereum-org-communities.json"

URL = "https://raw.githubusercontent.com/ethereum/ethereum-org-website/dev/src/data/community-meetups.json"


def fetch_upstream() -> list[dict]:
    proc = subprocess.run(
        ["curl", "-sL", URL, "--max-time", "30"],
        capture_output=True,
        text=True,
        timeout=40,
    )
    proc.check_returncode()
    return json.loads(proc.stdout)


def main() -> None:
    upstream = fetch_upstream()
    print(f"Fetched {len(upstream)} community meetups from {URL}")

    existing = json.loads(OUT_PATH.read_text()) if OUT_PATH.exists() else []
    existing_by_title = {e["title"]: e for e in existing}

    merged = []
    new_count = 0
    for u in upstream:
        prior = existing_by_title.get(u["title"])
        entry = {
            "title": u["title"],
            "location": u.get("location"),
            "link": u.get("link"),
        }
        if prior:
            for k in ("logoImage", "bannerImage", "youtubeChannel", "youtubeConfidence", "youtubeNote"):
                if k in prior:
                    entry[k] = prior[k]
        else:
            entry["youtubeChannel"] = None
            entry["youtubeConfidence"] = "none"
            entry["youtubeNote"] = None
            new_count += 1
        merged.append(entry)

    OUT_PATH.write_text(json.dumps(merged, indent=2, ensure_ascii=False))
    print(f"Wrote {OUT_PATH} — {len(merged)} meetups ({new_count} new)")


if __name__ == "__main__":
    main()
