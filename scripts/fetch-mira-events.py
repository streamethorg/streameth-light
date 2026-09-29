#!/usr/bin/env python3
# Refreshes data/sources/mira-events.json from miragather.com's own /events
# page. No API key exists for Mira (it's Airtable-backed with no documented
# public API) — but the page is server-rendered by Next.js, so the full
# event list is embedded verbatim in a __NEXT_DATA__ script tag. Curling the
# page and parsing that script tag is the same data an API would return,
# without needing credentials.
#
# The /events page only returns forward-looking events (from "today" at
# request time onward), so this merges into the existing file by id rather
# than overwriting it — past events already recorded stay recorded.
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "data" / "sources" / "mira-events.json"

URL = "https://miragather.com/events"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def fetch_next_data() -> dict:
    proc = subprocess.run(
        ["curl", "-sL", URL, "-H", f"User-Agent: {USER_AGENT}", "--max-time", "30"],
        capture_output=True,
        text=True,
        timeout=40,
    )
    proc.check_returncode()
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', proc.stdout, re.S)
    if not m:
        raise RuntimeError("__NEXT_DATA__ not found in miragather.com/events response")
    return json.loads(m.group(1))


def to_mira_event(raw: dict) -> dict:
    series = (raw.get("series") or [None])[0]
    return {
        "id": raw["id"],
        "kind": "main",
        "name": raw.get("event") or "",
        "description": raw.get("description"),
        "startTime": raw.get("startDate"),
        "endTime": raw.get("endDate"),
        "location": ", ".join(filter(None, [
            (raw.get("city") or [None])[0],
            (raw.get("country") or [None])[0],
        ])) or None,
        "city": (raw.get("city") or [None])[0],
        "country": (raw.get("country") or [None])[0],
        "organizer": raw.get("organizer"),
        "tags": raw.get("tags") or [],
        "topics": raw.get("topics") or [],
        "website": raw.get("link"),
        "imageUrl": raw.get("banner") or raw.get("logo"),
        "seriesSlug": series.get("slug") if series else None,
        "seriesName": series.get("title") if series else None,
    }


def main() -> None:
    data = fetch_next_data()
    raw_events = data["props"]["pageProps"]["allEvents"]
    fetched = [to_mira_event(e) for e in raw_events]
    print(f"Fetched {len(fetched)} upcoming events from {URL}")

    existing = json.loads(OUT_PATH.read_text()) if OUT_PATH.exists() else {
        "source": "miragather.com (formerly cryptonomads.org)",
        "series": [],
        "events": [],
    }
    by_id = {e["id"]: e for e in existing.get("events", [])}
    for e in fetched:
        by_id[e["id"]] = e

    series_by_slug = {
        s.get("slug"): {"id": s.get("id"), "title": s.get("title"), "slug": s.get("slug")}
        for raw in raw_events
        for s in (raw.get("series") or [])
        if s.get("slug")
    }
    existing_series = {s["slug"]: s for s in existing.get("series", []) if s.get("slug")}
    existing_series.update(series_by_slug)

    events = sorted(by_id.values(), key=lambda e: e.get("startTime") or "")
    result = {
        "source": "miragather.com (formerly cryptonomads.org)",
        "importedAt": __import__("datetime").date.today().isoformat(),
        "seriesCount": len(existing_series),
        "eventCount": len(events),
        "series": list(existing_series.values()),
        "events": events,
    }
    OUT_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Wrote {OUT_PATH} — {len(events)} total events ({len(fetched)} refreshed this run)")


if __name__ == "__main__":
    main()
