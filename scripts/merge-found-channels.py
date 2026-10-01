#!/usr/bin/env python3
# Applies scripts/find-youtube-channels.py's and scripts/guess-youtube-handles.py's
# output ({slug: {name, channelName, channelUrl}}) into directory.json,
# setting youtubeChannel/youtubeConfidence for the matched orgs — the merge
# step those two discovery scripts leave undone. Both output files are
# consumed and removed so the pipeline is idempotent on the next run.
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIRECTORY_PATH = ROOT / "data" / "directory.json"
FOUND_PATHS = [ROOT / "scripts" / "found-channels.json", ROOT / "scripts" / "found-channels-2.json"]


def main() -> None:
    directory = json.loads(DIRECTORY_PATH.read_text())
    entries = directory["entries"]
    by_slug = {e["slug"]: e for e in entries}

    applied = 0
    for path in FOUND_PATHS:
        if not path.exists():
            continue
        found = json.loads(path.read_text())
        for slug, match in found.items():
            entry = by_slug.get(slug)
            if not entry or entry.get("youtubeChannel"):
                continue
            entry["youtubeChannel"] = match["channelUrl"]
            entry["youtubeConfidence"] = "medium"
            applied += 1
            print(f"{entry['name']}: -> {match['channelUrl']}")
        path.unlink()

    if applied:
        DIRECTORY_PATH.write_text(json.dumps(directory, separators=(",", ":"), ensure_ascii=False))
    print(f"Applied {applied} newly-discovered channels to directory.json")


if __name__ == "__main__":
    main()
