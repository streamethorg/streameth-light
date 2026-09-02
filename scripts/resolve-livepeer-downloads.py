#!/usr/bin/env python3
"""
For the watch page's "Download" button: resolves a direct progressive MP4
URL per Livepeer playbackId via the same public playback-info API used by
resolve-livepeer-playback.py (video) and resolve-livepeer-thumbnails.py
(thumbnail) — https://livepeer.studio/api/playback/{id} returns an "MP4"
source alongside the HLS one for VOD assets, which is what actually makes a
file downloadable (an .m3u8 HLS playlist isn't a single downloadable file).

Caches the highest-bitrate MP4 URL per playbackId to
data/sources/livepeer-downloads.json. Not every asset has one (older/
livestream-recorded assets may only have HLS).

Run with: python3 scripts/resolve-livepeer-downloads.py
"""
import json
import os
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SESSIONS_PATH = os.path.join(REPO, "data", "sessions.json")
OUT_PATH = os.path.join(REPO, "data", "sources", "livepeer-downloads.json")
CONCURRENCY = 15
TIMEOUT_S = 10


def resolve(playback_id):
    url = f"https://livepeer.studio/api/playback/{playback_id}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "streameth-light/1.0"})
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None

    if data.get("type") != "vod":
        return None
    sources = data.get("meta", {}).get("source", [])
    mp4_sources = [s for s in sources if s.get("hrn") == "MP4" or s.get("type") == "html5/video/mp4"]
    if not mp4_sources:
        return None
    # Prefer the highest resolution/bitrate progressive file.
    best = max(mp4_sources, key=lambda s: s.get("bitrate") or s.get("width") or 0)
    return best.get("url")


def main():
    sessions = json.load(open(SESSIONS_PATH))
    playback_ids = list({s["playbackId"] for s in sessions if s.get("playbackId")})

    existing = {}
    if os.path.exists(OUT_PATH):
        existing = json.load(open(OUT_PATH))

    todo = [pid for pid in playback_ids if pid not in existing]
    print(f"{len(playback_ids)} total playback ids, {len(existing)} already resolved, {len(todo)} to fetch")

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
    print(f"done: {ok}/{len(todo)} resolved to a downloadable MP4")


if __name__ == "__main__":
    main()
