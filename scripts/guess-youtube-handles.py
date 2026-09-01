#!/usr/bin/env python3
# Direct-handle-guessing pass: the search-based discovery (find-youtube-channels.py)
# missed CryptoCanal entirely because "Common S3nse (CryptoCanal) ethereum meetup"
# didn't surface @cryptocanal in search results, even though the handle itself
# is an obvious guess from the org's own name/website. Try plausible @handle
# variants directly against YouTube via yt-dlp before giving up on an org.
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIRECTORY_PATH = ROOT / "data" / "directory.json"
OUT_PATH = ROOT / "scripts" / "found-channels-2.json"


def slug_variants(name: str, website: str | None) -> list[str]:
    base = re.sub(r"\([^)]*\)", "", name)  # drop parenthetical
    words = re.findall(r"[a-zA-Z0-9]+", base)
    variants = set()
    if words:
        variants.add("".join(words).lower())
        variants.add("".join(w.lower() for w in words if w.lower() not in {"the", "meetup", "group"}))
    # also try the parenthetical content alone, e.g. "(CryptoCanal)" -> "cryptocanal"
    paren = re.findall(r"\(([^)]*)\)", name)
    for p in paren:
        pw = re.findall(r"[a-zA-Z0-9]+", p)
        if pw:
            variants.add("".join(pw).lower())
    # also derive from website domain — but never from a generic hosting
    # platform's own domain (meetup.com, x.com, etc.), which would guess the
    # platform's own YouTube channel instead of the org's
    PLATFORM_HOSTS = {
        "meetup", "eventbrite", "facebook", "twitter", "x", "lu", "t",
        "telegram", "instagram", "linkedin", "discord",
    }
    if website:
        m = re.search(r"https?://(?:www\.)?([a-zA-Z0-9-]+)\.", website)
        if m and m.group(1).lower() not in PLATFORM_HOSTS:
            variants.add(m.group(1).lower().replace("-", ""))
    return [v for v in variants if 3 <= len(v) <= 30]


def check_handle(handle: str) -> dict | None:
    url = f"https://www.youtube.com/@{handle}/videos"
    proc = subprocess.run(
        ["yt-dlp", "--flat-playlist", "--playlist-items", "1", "--dump-single-json", "--no-warnings", url],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if proc.returncode != 0:
        return None
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return None
    if not data.get("entries"):
        return None
    return {"channel": data.get("channel"), "channel_id": data.get("channel_id"), "follower_count": data.get("channel_follower_count")}


def main() -> None:
    directory = json.loads(DIRECTORY_PATH.read_text())["entries"]
    orgs = json.loads((ROOT / "data" / "organizations.json").read_text())
    sessions = json.loads((ROOT / "data" / "sessions.json").read_text())
    org_by_slug = {o["slug"]: o["_id"] for o in orgs if o.get("slug")}
    from collections import Counter

    counts = Counter(s.get("organizationId") for s in sessions)

    targets = []
    for e in directory:
        if e.get("youtubeConfidence") not in ("none", None):
            continue
        oid = org_by_slug.get(e["slug"])
        if oid and counts.get(oid, 0) > 0:
            continue
        if e.get("miraEventCount", 0) > 0:
            continue
        targets.append(e)

    print(f"{len(targets)} orgs to try handle guesses for")
    found = {}
    for i, e in enumerate(targets, 1):
        variants = slug_variants(e["name"], e.get("website"))
        hit = None
        tried = []
        for v in variants:
            tried.append(v)
            result = check_handle(v)
            if result:
                hit = (v, result)
                break
        if hit:
            handle, info = hit
            print(f"[{i}/{len(targets)}] {e['name']}: FOUND @{handle} -> {info['channel']} ({info.get('follower_count')} subs)")
            found[e["slug"]] = {
                "name": e["name"],
                "channelName": info["channel"],
                "channelUrl": f"https://www.youtube.com/@{handle}",
            }
        else:
            print(f"[{i}/{len(targets)}] {e['name']}: no match (tried {tried})")

    OUT_PATH.write_text(json.dumps(found, indent=2))
    print(f"\n{len(found)} handle matches written to {OUT_PATH}")


if __name__ == "__main__":
    main()
