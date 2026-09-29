#!/usr/bin/env python3
# Adds directory.json stub entries for organizations/events discovered in
# data/sources/mira-events.json (recurring event series) and
# data/sources/ethereum-org-communities.json (community meetups) that
# aren't tracked yet — run after scripts/fetch-mira-events.py and
# scripts/fetch-ethereum-org-communities.py so those files are current.
#
# New entries start with youtubeChannel: null; scripts/find-youtube-channels.py
# and scripts/guess-youtube-handles.py (run next in the pipeline) fill that
# in where a real channel can be found. An entry with no channel just sits
# under "Tracked — no video yet" on /channels — never fabricated content.
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIRECTORY_PATH = ROOT / "data" / "directory.json"
MIRA_PATH = ROOT / "data" / "sources" / "mira-events.json"
COMMUNITIES_PATH = ROOT / "data" / "sources" / "ethereum-org-communities.json"


def slugify(name: str) -> str:
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", name.lower())) or "org"


def normalize(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def unique_slug(base: str, taken: set[str]) -> str:
    slug = base
    n = 2
    while slug in taken:
        slug = f"{base}-{n}"
        n += 1
    taken.add(slug)
    return slug


def new_entry(name, slug, website, source, mira_series_slug=None):
    return {
        "name": name,
        "slug": slug,
        "location": "",
        "website": website,
        "youtubeChannel": None,
        "youtubeConfidence": "none",
        "onStreamETH": False,
        "sessionCount": 0,
        "sources": [source],
        "miraSeriesSlug": mira_series_slug,
        "miraEventCount": 0,
        "youtubeVideoCount": 0,
    }


def main() -> None:
    directory = json.loads(DIRECTORY_PATH.read_text())
    entries = directory["entries"]
    taken_slugs = {e["slug"] for e in entries}
    known_names = {normalize(e["name"]) for e in entries}
    tracked_mira_slugs = {e["miraSeriesSlug"] for e in entries if e.get("miraSeriesSlug")}

    added = []

    if MIRA_PATH.exists():
        mira = json.loads(MIRA_PATH.read_text())
        event_counts: dict[str, int] = {}
        for e in mira.get("events", []):
            if e.get("seriesSlug"):
                event_counts[e["seriesSlug"]] = event_counts.get(e["seriesSlug"], 0) + 1
        for series in mira.get("series", []):
            slug = series.get("slug")
            title = (series.get("title") or "").strip()
            if not slug or not title or slug in tracked_mira_slugs:
                continue
            if normalize(title) in known_names:
                continue
            org_slug = unique_slug(slugify(title), taken_slugs)
            entry = new_entry(title, org_slug, None, "mira", mira_series_slug=slug)
            entry["miraEventCount"] = event_counts.get(slug, 0)
            entries.append(entry)
            known_names.add(normalize(title))
            added.append(f"mira: {title}")

    if COMMUNITIES_PATH.exists():
        communities = json.loads(COMMUNITIES_PATH.read_text())
        for c in communities:
            title = (c.get("title") or "").strip()
            if not title or normalize(title) in known_names:
                continue
            org_slug = unique_slug(slugify(title), taken_slugs)
            entry = new_entry(title, org_slug, c.get("link"), "ethereum.org-communities")
            if c.get("youtubeChannel"):
                entry["youtubeChannel"] = c["youtubeChannel"]
                entry["youtubeConfidence"] = c.get("youtubeConfidence", "none")
            entries.append(entry)
            known_names.add(normalize(title))
            added.append(f"ethereum.org-communities: {title}")

    directory["count"] = len(entries)
    directory["generatedAt"] = __import__("datetime").date.today().isoformat()
    DIRECTORY_PATH.write_text(json.dumps(directory, separators=(",", ":"), ensure_ascii=False))

    print(f"Added {len(added)} new directory entries:")
    for a in added:
        print(f"  {a}")
    print(f"Directory now has {len(entries)} entries")


if __name__ == "__main__":
    main()
