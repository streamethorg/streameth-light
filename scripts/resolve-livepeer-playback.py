#!/usr/bin/env python3
"""
For every session with a Livepeer playbackId but no working videoUrl (either
the videoUrl is missing entirely, or it's on the dead lp-playback.com short-
link domain), resolve the real HLS URL via Livepeer's public playback-info
API (https://livepeer.studio/api/playback/{id}) and cache it to
data/sources/livepeer-resolved.json, keyed by playbackId.

Run with: python3 scripts/resolve-livepeer-playback.py
"""
import json
import os
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SESSIONS_PATH = os.path.join(REPO, "data", "sessions.json")
OUT_PATH = os.path.join(REPO, "data", "sources", "livepeer-resolved.json")
CONCURRENCY = 15
TIMEOUT_S = 10


def has_working_video(s):
    url = s.get("videoUrl") or (s.get("playback") or {}).get("videoUrl")
    if not url:
        return False
    return "lp-playback.com" not in url


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
    hls = next((s["url"] for s in sources if s.get("type", "").endswith("mpegurl")), None)
    return hls


def main():
    sessions = json.load(open(SESSIONS_PATH))
    candidates = {}
    for s in sessions:
        if not has_working_video(s) and s.get("playbackId"):
            candidates[s["playbackId"]] = True
    playback_ids = list(candidates.keys())

    existing = {}
    if os.path.exists(OUT_PATH):
        existing = json.load(open(OUT_PATH))

    todo = [pid for pid in playback_ids if pid not in existing]
    print(f"{len(playback_ids)} total candidates, {len(existing)} already resolved, {len(todo)} to fetch")

    def save():
        json.dump(existing, open(OUT_PATH, "w"), indent=2)

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
            if done % 50 == 0:
                save()
                print(f"[{done}/{len(todo)}] ({ok} resolved so far)")

    save()
    print(f"done: {ok}/{len(todo)} resolved to a real VOD URL")


if __name__ == "__main__":
    main()
