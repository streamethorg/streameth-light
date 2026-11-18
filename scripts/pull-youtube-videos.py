#!/usr/bin/env python3
# Pulls the FULL upload list per known channel via yt-dlp (no API key, no
# quota — uses YouTube's internal web endpoints the same way the site's own
# /videos tab does). Replaces the old data/sources/youtube-videos.json, which
# was built from a single unpaginated call and silently capped every channel
# at 15 videos regardless of how many it actually had.
#
# Lists three tabs per channel: /videos (uploads), /shorts and /streams (past,
# live and scheduled livestreams). Each entry records which tab listed it and,
# for streams, yt-dlp's live_status — lib/videoFormat.mjs turns those into the
# short/clip/talk/stream format the UI shows. A tab that fails to list keeps
# that tab's previously pulled entries instead of dropping them.
#
# A tracked video is never dropped just because no tab lists it any more.
# Channels unlist talks after an event (the Ethereum Foundation unlisted
# ~300 Devcon 8 talks in Nov 2026, and the refreshes of 2026-11-14 and
# 2026-11-17 deleted them from this file, which 404'd every one of their
# /watch pages). Unlisted videos still play, so a video missing from every
# tab keeps its stored entry, and is only dropped once YouTube confirms it is
# gone (deleted, removed or private) — see video_is_gone(). Pass
# --no-prune to skip that check and keep everything.
#
#   python3 scripts/pull-youtube-videos.py                      # every channel
#   python3 scripts/pull-youtube-videos.py --channels devcon,ethcc
import argparse
import concurrent.futures
import datetime
import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIRECTORY_PATH = ROOT / "data" / "directory.json"
OUT_PATH = ROOT / "data" / "sources" / "youtube-videos.json"
# Not committed (see .gitignore) — scratch output consumed by
# pull-youtube-metadata.py/pull-youtube-transcripts.py in the same run so
# they only backfill the videos this run actually discovered as new,
# instead of the whole tracked catalog.
NEW_IDS_PATH = ROOT / "data" / "sources" / "new-video-ids.json"
# YouTube channel ids by directory slug (UC…), which the live player embed
# (youtube.com/embed/live_stream?channel=<id>) needs.
CHANNEL_IDS_PATH = ROOT / "data" / "sources" / "youtube-channel-ids.json"

# Order matters for de-duplication: a livestream recording is listed under
# both /streams and (often) /videos, and /streams is the more specific tab.
TABS = ("streams", "shorts", "videos")

# Safety valve for the gone-check: if more unlisted-looking videos than this
# come back "gone" in one run, YouTube is more likely blocking the runner
# than a channel deleting that much at once, so nothing is dropped.
MAX_PRUNE_PER_RUN = 25

# Phrases yt-dlp prints for a video that is really gone. Anything else (bot
# checks, "Sign in to confirm", rate limits, network errors) keeps the video.
GONE_PHRASES = (
    "private video",
    "removed by the uploader",
    "video unavailable",
    "account associated with this video has been terminated",
    "has been removed for violating",
)


def channel_tab_url(channel_url: str, tab: str) -> str:
    return channel_url.rstrip("/") + "/" + tab


def fetch_tab(url: str, tab: str) -> tuple[list[dict], str | None] | None:
    """The tab's entries and the channel id, or None when listing failed. A
    channel without the tab at all (no Shorts ever posted) also fails here,
    which keeps whatever was stored for it — nothing."""
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
        timeout=180,
    )
    if proc.returncode != 0:
        print(f"  {tab}: ERROR {proc.stderr.strip()[:300]}", file=sys.stderr)
        return None
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        print(f"  {tab}: ERROR unparseable yt-dlp output", file=sys.stderr)
        return None
    videos = []
    for e in data.get("entries", []):
        if not e or e.get("_type") != "url":
            continue
        vid = e.get("id")
        if not vid:
            continue
        ts = e.get("timestamp")
        thumbs = e.get("thumbnails") or []
        # Shorts get YouTube's plain vertical cover; the listing's own URLs
        # carry signed query strings that aren't guaranteed to last.
        if tab == "shorts":
            thumb = f"https://i.ytimg.com/vi/{vid}/oar2.jpg"
        else:
            thumb = thumbs[-1]["url"] if thumbs else None
        video = {
            "videoId": vid,
            "title": e.get("title") or "",
            # The /shorts listing carries no date; pull-youtube-metadata.py's
            # upload_date fills it in (build-db.mjs falls back to it).
            "publishedAt": (
                datetime.datetime.fromtimestamp(ts, datetime.timezone.utc)
                .replace(tzinfo=None)
                .isoformat() + "Z"
                if ts
                else None
            ),
            "thumbnail": thumb,
            "description": None,
            "tab": tab,
        }
        if tab == "streams":
            video["liveStatus"] = e.get("live_status")
            if e.get("duration"):
                video["duration"] = e["duration"]
        videos.append(video)
    return videos, data.get("channel_id")


def merge_tabs(
    previous: list[dict],
    fetched: dict[str, list[dict] | None],
    gone: set[str] | frozenset[str] = frozenset(),
) -> list[dict]:
    """One channel's entries across tabs, newest first. Each video id appears
    once, from the first tab in TABS that lists it, with that listing's fresh
    metadata. A tab whose listing failed (None) keeps its previous entries;
    entries stored before tabs were tracked count as /videos. Previously
    stored videos that no tab lists any more (typically unlisted) are kept as
    stored unless their id is in `gone`."""
    previous_by_tab: dict[str, list[dict]] = {}
    for v in previous:
        previous_by_tab.setdefault(v.get("tab") or "videos", []).append(v)
    merged: list[dict] = []
    seen: set[str] = set()
    for tab in TABS:
        entries = fetched.get(tab)
        if entries is None:
            entries = previous_by_tab.get(tab, [])
        for v in entries:
            if v["videoId"] in seen:
                continue
            seen.add(v["videoId"])
            merged.append(v)
    for v in previous:
        vid = v.get("videoId")
        if not vid or vid in seen or vid in gone:
            continue
        seen.add(vid)
        merged.append(v)
    merged.sort(key=lambda v: v.get("publishedAt") or "", reverse=True)
    return merged


def unlisted_ids(previous: list[dict], fetched: dict[str, list[dict] | None]) -> list[str]:
    """Stored video ids that no successfully listed tab lists any more (ids
    from a failed tab are left alone; merge_tabs keeps them anyway)."""
    listed = {v["videoId"] for entries in fetched.values() if entries for v in entries}
    kept_by_failed_tab = {
        v.get("videoId")
        for v in previous
        if fetched.get(v.get("tab") or "videos") is None
    }
    return [
        v["videoId"]
        for v in previous
        if v.get("videoId") and v["videoId"] not in listed and v["videoId"] not in kept_by_failed_tab
    ]


def video_is_gone(video_id: str) -> bool:
    """True only when YouTube says the video is deleted, removed or private.
    oEmbed answers 200 for public and unlisted videos alike (keep), 404 for
    most deleted ones, and 401/403 for private ones and some deleted ones —
    those are confirmed with yt-dlp before counting as gone. Any other
    answer, or an error, keeps the video."""
    url = (
        "https://www.youtube.com/oembed?format=json&url="
        f"https://www.youtube.com/watch?v={video_id}"
    )
    try:
        with urllib.request.urlopen(url, timeout=20):
            return False
    except urllib.error.HTTPError as e:
        status = e.code
    except Exception:
        return False
    if status == 404:
        return True
    if status not in (401, 403):
        return False
    try:
        proc = subprocess.run(
            ["yt-dlp", "--skip-download", "--no-warnings", "--print", "id",
             f"https://www.youtube.com/watch?v={video_id}"],
            capture_output=True, text=True, timeout=60,
        )
    except Exception:
        return False
    err = proc.stderr.lower()
    if proc.returncode == 0 or "sign in to confirm" in err:
        return False
    return any(p in err for p in GONE_PHRASES)


def find_gone(candidates: list[str], check=video_is_gone, limit: int = MAX_PRUNE_PER_RUN) -> set[str]:
    """The candidates YouTube confirms are gone, or nothing at all when more
    than `limit` of them come back gone (see MAX_PRUNE_PER_RUN)."""
    ids = list(dict.fromkeys(candidates))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        gone = {vid for vid, is_gone in zip(ids, pool.map(check, ids)) if is_gone}
    if len(gone) > limit:
        print(
            f"WARNING: {len(gone)} unlisted videos looked gone (limit {limit}); "
            "keeping all of them in case YouTube is blocking this runner",
            file=sys.stderr,
        )
        return set()
    return gone


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--channels", default="", help="Comma-separated directory slugs (default: all)")
    parser.add_argument(
        "--no-prune",
        action="store_true",
        help="Keep every stored video, without checking whether unlisted ones were deleted",
    )
    args = parser.parse_args()
    only = {s.strip() for s in args.channels.split(",") if s.strip()}

    directory = json.loads(DIRECTORY_PATH.read_text())["entries"]
    channels = [
        e for e in directory
        if e.get("youtubeChannel") and e.get("youtubeConfidence") != "none"
        and (not only or e["slug"] in only)
    ]
    print(f"{len(channels)} channels with a known YouTube URL")

    existing = json.loads(OUT_PATH.read_text()) if OUT_PATH.exists() else {}
    existing_ids = {v["videoId"] for vids in existing.values() for v in vids if v.get("videoId")}
    channel_ids = json.loads(CHANNEL_IDS_PATH.read_text()) if CHANNEL_IDS_PATH.exists() else {}
    result = dict(existing)
    new_ids: list[str] = []
    failed_tabs = 0

    pulled: dict[str, dict[str, list[dict] | None]] = {}
    for i, entry in enumerate(channels, 1):
        slug = entry["slug"]
        print(f"[{i}/{len(channels)}] {slug} -> {entry['youtubeChannel']}")
        fetched: dict[str, list[dict] | None] = {}
        for tab in TABS:
            listing = fetch_tab(channel_tab_url(entry["youtubeChannel"], tab), tab)
            if listing is None:
                fetched[tab] = None
                failed_tabs += 1
                continue
            fetched[tab], channel_id = listing
            if channel_id:
                channel_ids[slug] = channel_id
            print(f"  {tab}: {len(fetched[tab])}")
        if all(v is None for v in fetched.values()):
            print(f"  nothing fetched, keeping existing {len(existing.get(slug, []))}")
            continue
        pulled[slug] = fetched

    # Videos no tab lists any more: one gone-check per id, shared across
    # channels that list the same uploads (e.g. devcon and devconnect).
    unlisted_by_slug = {slug: unlisted_ids(existing.get(slug, []), f) for slug, f in pulled.items()}
    candidates = [vid for ids in unlisted_by_slug.values() for vid in ids]
    gone = set() if args.no_prune else find_gone(candidates)
    retained_total = 0

    for slug, fetched in pulled.items():
        videos = merge_tabs(existing.get(slug, []), fetched, gone)
        result[slug] = videos
        retained = sum(1 for vid in unlisted_by_slug[slug] if vid not in gone)
        dropped = len(unlisted_by_slug[slug]) - retained
        retained_total += retained
        note = f", kept {retained} no tab lists any more" if retained else ""
        if dropped:
            note += f", dropped {dropped} YouTube says are gone"
        print(f"  {slug}: {len(videos)} videos (was {len(existing.get(slug, []))}{note})")
        new_ids.extend(
            v["videoId"] for v in videos
            if v.get("videoId") and v["videoId"] not in existing_ids
        )

    OUT_PATH.write_text(json.dumps(result, indent=None, separators=(",", ":")))
    total = sum(len(v) for v in result.values())
    print(f"\nWrote {OUT_PATH} — {len(result)} channels, {total} videos total")

    CHANNEL_IDS_PATH.write_text(json.dumps(channel_ids, indent=1, sort_keys=True))
    print(f"Wrote {CHANNEL_IDS_PATH} — {len(channel_ids)} channel ids")

    NEW_IDS_PATH.write_text(json.dumps(new_ids))
    print(f"Wrote {NEW_IDS_PATH} — {len(new_ids)} newly-discovered video IDs this run")
    if failed_tabs:
        print(f"{failed_tabs} channel tabs failed to list (kept their previous entries)")
    print(
        f"{retained_total} stored videos no tab lists any more were kept (unlisted); "
        f"{len(gone)} confirmed gone on YouTube were dropped: {sorted(gone)}"
    )


if __name__ == "__main__":
    main()
