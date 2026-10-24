#!/usr/bin/env python3
# Pulls talk-level schedules (title, speakers, stage, time slot, and the
# YouTube id once the recording is up) for events that publish one. Mira only
# has event dates; this is what lets a coverage page say what's on stage now
# and lets a day report link a scheduled talk to its recording by id instead
# of by guessing from titles.
#
# Only Devcon's API (api.devcon.org) for now — the other conferences we cover
# don't publish a public schedule feed. Add an entry to SOURCES for each new
# one. Keyed in the output by the Mira event name it belongs to, which is how
# lib/season.ts finds it.
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "data" / "sources" / "event-schedules.json"

SOURCES = [
    {"miraEventName": "Devcon 8", "channel": "devcon", "devconEventId": "devcon8"},
]

DEVCON_API = "https://api.devcon.org"
PAGE_SIZE = 500


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "streameth-light schedule pull"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read().decode("utf-8"))


def pull_devcon(event_id: str) -> dict:
    rooms = {r["id"]: r["name"] for r in get_json(f"{DEVCON_API}/events/{event_id}/rooms")["data"]}
    sessions = []
    page = 1
    while True:
        data = get_json(f"{DEVCON_API}/sessions?event={event_id}&size={PAGE_SIZE}&page={page}")["data"]
        items = data.get("items") or []
        sessions.extend(items)
        if not items or len(sessions) >= data.get("total", 0):
            break
        page += 1
    out = []
    # Speaker details by name, for the event's Speakers tab: the schedule's
    # own photo, short bio and handle, which our speaker records don't have
    # for most Devcon speakers.
    profiles: dict[str, dict] = {}
    for s in sessions:
        for sp in s.get("speakers") or []:
            name = sp.get("name")
            if not name or name in profiles:
                continue
            profiles[name] = {
                "avatar": sp.get("avatar") or None,
                "bio": (sp.get("description") or "").strip()[:600] or None,
                "twitter": (sp.get("twitter") or "").lstrip("@") or None,
            }
    for s in sessions:
        if not s.get("slot_start"):
            continue
        out.append(
            {
                "id": s["id"],
                "title": s.get("title") or "",
                "type": s.get("type") or "",
                "track": s.get("track") or "",
                "start": s["slot_start"],
                "end": s.get("slot_end") or s["slot_start"],
                "room": rooms.get(s.get("slot_roomId") or "", s.get("slot_roomId") or ""),
                "speakers": [sp.get("name") for sp in s.get("speakers") or [] if sp.get("name")],
                "youtubeId": s.get("sources_youtubeId") or None,
                "doNotRecord": bool(s.get("doNotRecord")),
            }
        )
    out.sort(key=lambda s: (s["start"], s["room"]))
    return {"rooms": sorted(set(rooms.values())), "sessions": out, "speakers": profiles}


def main() -> None:
    existing = json.loads(OUT_PATH.read_text()) if OUT_PATH.exists() else {}
    result = dict(existing)
    failures = 0
    for source in SOURCES:
        name = source["miraEventName"]
        try:
            schedule = pull_devcon(source["devconEventId"])
        except Exception as err:  # network/API errors keep the last good copy
            failures += 1
            print(f"{name}: ERROR {err} — keeping previous copy", file=sys.stderr)
            continue
        result[name] = {"channel": source["channel"], **schedule}
        recorded = sum(1 for s in schedule["sessions"] if s["youtubeId"])
        print(f"{name}: {len(schedule['sessions'])} scheduled sessions, {recorded} with a recording")
    OUT_PATH.write_text(json.dumps(result, indent=None, separators=(",", ":")))
    print(f"Wrote {OUT_PATH}")
    if failures == len(SOURCES):
        sys.exit(1)


if __name__ == "__main__":
    main()
