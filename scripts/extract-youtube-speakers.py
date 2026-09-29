#!/usr/bin/env python3
# YouTube-sourced videos carry no speaker field at all (see lib/directory.ts's
# YoutubeVideo type) — StreamETH's own sessions.json/speakers.json embed real
# speaker names for the same conference ecosystem, so a name that appears
# verbatim in a YouTube title is almost certainly that same real person
# presenting, not a guess. This builds that known-name dictionary from the
# StreamETH data, then does exact substring matching against YouTube titles
# — no LLM inference, no invented names, just exact matches against people
# already known to be real speakers in this dataset.
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

BAD_WORDS = {
    "panel", "discussion", "ceremony", "break", "workshop", "session", "team",
    "opening", "closing", "keynote", "fireside", "chat", "remarks", "ecosystem",
    "update", "overview", "summit", "welcome", "introduction", "announcement",
    "networking", "lunch", "coffee", "ask", "the", "and", "of", "sponsors",
    "hackathon", "office", "hours", "group", "various", "speakers", "tbd",
    "staff", "crew", "committee", "tickets",
}
PARTICLES = {"du", "de", "von", "der", "van", "la", "ibn", "al", "bin", "el", "di", "da", "dos", "das", "le"}
# Real people's names that happen to collide with common technical jargon in
# talk titles ("... Light Client ...") — a data-entry artifact upstream in
# speakers.json (bio: "Geth core developer" attached to the literal name
# "Light Client"), not a person. Matching it against titles is pure noise.
JARGON_BLOCKLIST = {"light client"}


def clean_name(raw: str) -> str:
    n = re.sub(r"\s+", " ", raw).strip()
    n = re.sub(r"^(PANEL|Panel)[:\-]\s*", "", n)
    n = re.sub(r"\s*\([^)]*\)\s*$", "", n).strip()
    return n


def looks_like_name(n: str) -> bool:
    if not n or len(n) < 6 or n.lower() in JARGON_BLOCKLIST:
        return False
    words = n.split(" ")
    if len(words) < 2 or len(words) > 4:
        return False
    if any(ch.isdigit() for ch in n) or ":" in n or "|" in n:
        return False
    for w in words:
        wl = w.lower().strip(".,")
        if wl in BAD_WORDS:
            return False
        if wl in PARTICLES:
            continue
        core = w.strip(".,")
        if not core or not core[0].isalpha() or not core[0].isupper():
            return False
        # ALL-CAPS word of 5+ letters reads as an acronym/shout, not a surname
        if core.isalpha() and core.isupper() and len(core) >= 5:
            return False
    return True


def build_known_names() -> set[str]:
    sessions = json.loads((DATA / "sessions.json").read_text())
    speakers = json.loads((DATA / "speakers.json").read_text())

    raw_names = set()
    for s in sessions:
        for sp in s.get("speakers", []):
            n = (sp.get("name") or "").strip()
            if n:
                raw_names.add(n)
    for sp in speakers:
        n = (sp.get("name") or "").strip()
        if n:
            raw_names.add(n)

    names = set()
    for n in raw_names:
        c = clean_name(n)
        if looks_like_name(c):
            names.add(c)
    return names


def extract_for_title(title: str, names_longest_first: list[str]) -> list[str]:
    found = [n for n in names_longest_first if n in title]
    # Drop a shorter match that's fully contained in a longer match already
    # found in the same title (e.g. "Afra Wang" inside "Afra Zhao Wang").
    return [n for n in found if not any(n != other and n in other for other in found)]


def main() -> None:
    names = build_known_names()
    names_longest_first = sorted(names, key=len, reverse=True)
    print(f"{len(names)} known real speaker names")

    youtube_videos = json.loads((DATA / "sources" / "youtube-videos.json").read_text())

    result: dict[str, dict[str, list[str]]] = {}
    total = 0
    hit = 0
    for slug, videos in youtube_videos.items():
        out = {}
        for v in videos:
            total += 1
            matched = extract_for_title(v["title"], names_longest_first)
            if matched:
                out[v["videoId"]] = matched
                hit += 1
        if out:
            result[slug] = out

    out_path = DATA / "sources" / "youtube-speakers.json"
    out_path.write_text(json.dumps(result, separators=(",", ":")))
    print(f"Wrote {out_path} — {hit}/{total} videos matched ({hit / total:.1%})")


if __name__ == "__main__":
    main()
