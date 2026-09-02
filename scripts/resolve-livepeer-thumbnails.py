#!/usr/bin/env python3
"""
The old StreamETH DigitalOcean Spaces bucket that used to host session
coverImages is dead (see lib/data.ts's cleanImageUrl), which leaves every
session that relied on it with no thumbnail at all. For sessions with a
Livepeer playbackId, Livepeer's public playback-info API
(https://livepeer.studio/api/playback/{id}) — the same public, no-API-key
endpoint resolve-livepeer-playback.py already uses for video URLs — also
returns thumbnail sources for the asset: either a direct
"Thumbnail (PNG/JPEG)" source, or a "Thumbnails" WebVTT track whose first
cue points at a real keyframe image (mirrors streameth-platform's
packages/server/src/utils/livepeer.ts generateThumbnail()).

Resolves a real thumbnail URL per playbackId and caches it to
data/sources/livepeer-thumbnails.json.

Run with: python3 scripts/resolve-livepeer-thumbnails.py
"""
import json
import os
import re
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SESSIONS_PATH = os.path.join(REPO, "data", "sessions.json")
OUT_PATH = os.path.join(REPO, "data", "sources", "livepeer-thumbnails.json")
CONCURRENCY = 15
TIMEOUT_S = 10


def has_usable_cover_image(s):
    url = s.get("coverImage")
    if not url:
        return False
    return "digitaloceanspaces.com" not in url


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "streameth-light/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
        return json.loads(resp.read().decode("utf-8"))


def first_vtt_keyframe(vtt_url):
    req = urllib.request.Request(vtt_url, headers={"User-Agent": "streameth-light/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
        text = resp.read().decode("utf-8")
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if re.match(r"^\d{2}:\d{2}:\d{2}", line):
            return lines[i + 1].strip()
    return None


def resolve(playback_id):
    try:
        data = fetch_json(f"https://livepeer.studio/api/playback/{playback_id}")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None
    if data.get("type") != "vod":
        return None
    sources = data.get("meta", {}).get("source", [])

    direct = next(
        (
            s["url"]
            for s in sources
            if s.get("hrn") in ("Thumbnail (PNG)", "Thumbnail (JPEG)")
            or s.get("type") in ("image/png", "image/jpeg")
        ),
        None,
    )
    if direct:
        return direct

    vtt = next((s["url"] for s in sources if s.get("hrn") == "Thumbnails"), None)
    if not vtt:
        return None
    try:
        keyframe = first_vtt_keyframe(vtt)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
        return None
    if not keyframe:
        return None
    return vtt.replace("thumbnails.vtt", keyframe)


def main():
    sessions = json.load(open(SESSIONS_PATH))
    candidates = {}
    for s in sessions:
        if s.get("playbackId") and not has_usable_cover_image(s):
            candidates[s["playbackId"]] = True
    playback_ids = list(candidates.keys())

    existing = {}
    if os.path.exists(OUT_PATH):
        existing = json.load(open(OUT_PATH))

    todo = [pid for pid in playback_ids if pid not in existing]
    print(f"{len(playback_ids)} total candidates, {len(existing)} already resolved, {len(todo)} to fetch")

    def save():
        json.dump(existing, open(OUT_PATH, "w"), indent=None, separators=(",", ":"))

    done = 0
    ok = 0
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        futures = {pool.submit(resolve, pid): pid for pid in todo}
        for fut in as_completed(futures):
            pid = futures[fut]
            done += 1
            try:
                url = fut.result()
            except Exception as e:
                url = None
                print(f"[{done}/{len(todo)}] {pid} ERROR {e}")
            existing[pid] = url
            if url:
                ok += 1
            if done % 100 == 0:
                save()
                print(f"[{done}/{len(todo)}] ({ok} resolved so far)")

    save()
    print(f"done: {ok}/{len(todo)} resolved to a real thumbnail")


if __name__ == "__main__":
    main()
