#!/usr/bin/env python3
# For directory entries with no known YouTube channel and no video content
# anywhere else, search YouTube itself (via yt-dlp, no API key) for a
# consistent uploader across the top few results — a cheap, scriptable
# substitute for manually searching each of dozens of small local meetups.
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIRECTORY_PATH = ROOT / "data" / "directory.json"
OUT_PATH = ROOT / "scripts" / "found-channels.json"


STOPWORDS = {
    "ethereum", "eth", "meetup", "meetups", "group", "community", "dev",
    "developers", "web3", "blockchain", "nft", "crypto", "the", "and", "of",
    "a", "an", "in", "at", "on", "workshop", "hub",
}


def normalize(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def distinctive_tokens(name: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", name.lower())
    return {w for w in words if w not in STOPWORDS and len(w) >= 3}


def search(query: str) -> list[dict]:
    proc = subprocess.run(
        ["yt-dlp", "--flat-playlist", "--dump-single-json", "--no-warnings", f"ytsearch4:{query}"],
        capture_output=True,
        text=True,
        timeout=45,
    )
    if proc.returncode != 0:
        return []
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return []
    return data.get("entries", [])


def main() -> None:
    directory = json.loads(DIRECTORY_PATH.read_text())["entries"]
    orgs = json.loads((ROOT / "data" / "organizations.json").read_text())
    sessions = json.loads((ROOT / "data" / "sessions.json").read_text())
    org_by_slug = {o["slug"]: o["_id"] for o in orgs if o.get("slug")}
    from collections import Counter

    counts = Counter(s.get("organizationId") for s in sessions)

    targets = []
    for e in directory:
        if e.get("youtubeConfidence") != "none":
            continue
        oid = org_by_slug.get(e["slug"])
        if oid and counts.get(oid, 0) > 0:
            continue
        if e.get("miraEventCount", 0) > 0:
            continue
        targets.append(e)

    print(f"{len(targets)} orgs to search")
    found = {}
    for i, e in enumerate(targets, 1):
        name = e["name"]
        query = f"{name} ethereum meetup"
        entries = search(query)
        if not entries:
            print(f"[{i}/{len(targets)}] {name}: no results")
            continue
        channels = [(en.get("channel_url"), en.get("channel") or en.get("uploader")) for en in entries if en.get("channel_url")]
        if not channels:
            print(f"[{i}/{len(targets)}] {name}: no channel info")
            continue
        # majority channel across results
        from collections import Counter as C

        url_counts = C(url for url, _ in channels)
        top_url, top_count = url_counts.most_common(1)[0]
        top_channel_name = next(n for u, n in channels if u == top_url)
        target_tokens = distinctive_tokens(name)
        channel_tokens = distinctive_tokens(top_channel_name)
        # require at least one shared distinctive token (e.g. a city name),
        # not just the generic "ethereum"/"meetup" words both sides share
        name_match = bool(target_tokens & channel_tokens)
        confident = top_count >= 2 and name_match
        status = "CONFIDENT" if confident else "weak"
        print(f"[{i}/{len(targets)}] {name}: {top_channel_name} ({top_url}) count={top_count}/{len(channels)} [{status}]")
        if confident:
            found[e["slug"]] = {"name": name, "channelName": top_channel_name, "channelUrl": top_url}

    OUT_PATH.write_text(json.dumps(found, indent=2))
    print(f"\n{len(found)} confident matches written to {OUT_PATH}")


if __name__ == "__main__":
    main()
