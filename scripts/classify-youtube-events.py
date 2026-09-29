#!/usr/bin/env python3
# Some channels host thousands of videos from one recurring conference brand
# (or a handful of well-known ones) with the edition named right there in the
# title — "... | Devcon SEA", "ETHGlobal San Francisco 2024", "TOKEN2049
# Singapore 2025", "EthCC[7]" — but data/sources/youtube-event-groups.json
# (the one-off LLM classification pass) only ever covered a handful of these
# per channel, leaving the rest to fall into an undifferentiated
# "More uploads" bucket (see lib/youtube.ts). This does pattern-based
# extraction of the *real* event name for the channels below, using a
# curated whitelist of known conference/hackathon brands — never inventing a
# name, only reading one that's already in the title — and merges the result
# into the same event-groups file the app already reads, without touching
# groups the earlier classification pass already produced.
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VIDEOS_PATH = ROOT / "data" / "sources" / "youtube-videos.json"
GROUPS_PATH = ROOT / "data" / "sources" / "youtube-event-groups.json"

# (compiled pattern, label template using match groups) — order matters,
# first match wins. Every pattern requires the brand name to literally
# appear in the title; nothing here is guessed from context.
PATTERNS = [
    (re.compile(r"Devconnect\s*([A-Za-zÀ-ſ]+)?", re.I), lambda m: f"Devconnect {m.group(1)}".strip() if m.group(1) else "Devconnect"),
    (re.compile(r"Devcon\s*(SEA|Bogot[aá]|\d)\b", re.I), lambda m: f"Devcon {m.group(1)}"),
    (re.compile(r"\bDevcon(\d)\b", re.I), lambda m: f"Devcon {m.group(1)}"),
    (re.compile(r"EthCC\s*\[?(\d+)\]?", re.I), lambda m: f"EthCC[{m.group(1)}]"),
    (re.compile(r"Les Amis d.Ethereum France\s*#?(\d+)?", re.I), lambda m: f"Les Amis d'Ethereum France #{m.group(1)}" if m.group(1) else "Les Amis d'Ethereum France"),
    (re.compile(r"ETHGlobal\s+([A-Za-zÀ-ſ]+(?:\s[A-Za-zÀ-ſ]+)?)\s*(20\d\d)", re.I), lambda m: f"ETHGlobal {m.group(1).title()} {m.group(2)}"),
    (re.compile(r"\bHackFS\s*(20\d\d)?", re.I), lambda m: f"HackFS {m.group(1)}" if m.group(1) else "HackFS"),
    (re.compile(r"\bHackMoney\s*(20\d\d)?", re.I), lambda m: f"HackMoney {m.group(1)}" if m.group(1) else "HackMoney"),
    (re.compile(r"\bETHOnline\s*(20\d\d)?", re.I), lambda m: f"ETHOnline {m.group(1)}" if m.group(1) else "ETHOnline"),
    (re.compile(r"\bPragma\s+([A-Za-zÀ-ſ]+)", re.I), lambda m: f"Pragma {m.group(1).title()}"),
    # City + year is the canonical tag; a title can also *start* with an
    # unrelated "TOKEN2049 <word>" segment (e.g. "TOKEN2049 Origins Hackathon
    # Demos - TOKEN2049 Singapore 2025"), so this must require the real
    # signal (a known host city and a year) rather than matching loosely.
    (re.compile(r"TOKEN2049\s+(Singapore|Dubai|London)\s+(20\d\d)", re.I), lambda m: f"TOKEN2049 {m.group(1).title()} {m.group(2)}"),
    (re.compile(r"TOKEN2049\s+(20\d\d)", re.I), lambda m: f"TOKEN2049 {m.group(1)}"),
]

# Channels where every upload is realistically that one brand (verified by
# eyeballing a sample of titles — no other conference name ever appears), so
# a video that matches no explicit pattern above still gets a real label
# built from the brand name + its upload year, rather than a generic dump.
SINGLE_BRAND_CHANNELS = {
    "ethereum-denver": "ETHDenver",
    "token2049": "TOKEN2049",
}


def classify_video(title: str):
    for pattern, label_fn in PATTERNS:
        # A canonical event tag is conventionally appended at the end of the
        # title (e.g. "... - TOKEN2049 Singapore 2025") — prefer the
        # right-most match over an earlier, unrelated mention of the brand
        # name within the talk title itself.
        matches = list(pattern.finditer(title))
        if matches:
            return label_fn(matches[-1])
    return None


def main() -> None:
    videos_by_slug = json.loads(VIDEOS_PATH.read_text())
    existing = json.loads(GROUPS_PATH.read_text()) if GROUPS_PATH.exists() else {}

    target_slugs = set(SINGLE_BRAND_CHANNELS) | {
        "devcon", "devconnect", "ethglobal", "pragma-ethglobal",
        "token2049", "ethereum-paris", "ethereum-france",
    }

    for slug in target_slugs:
        videos = videos_by_slug.get(slug, [])
        if not videos:
            continue
        already_classified = {
            vid for g in existing.get(slug, []) for vid in g["videoIds"]
        }

        new_groups: dict[str, list[str]] = {}
        for v in videos:
            if v["videoId"] in already_classified:
                continue
            label = classify_video(v["title"])
            if not label and slug in SINGLE_BRAND_CHANNELS:
                year = v["publishedAt"][:4] if v.get("publishedAt") else None
                if year:
                    label = f"{SINGLE_BRAND_CHANNELS[slug]} {year}"
            if label:
                new_groups.setdefault(label, []).append(v["videoId"])

        if not new_groups:
            continue
        existing.setdefault(slug, [])
        by_label = {g["label"]: g for g in existing[slug]}
        for label, video_ids in new_groups.items():
            if label in by_label:
                by_label[label]["videoIds"].extend(video_ids)
            else:
                new_group = {"label": label, "videoIds": video_ids}
                existing[slug].append(new_group)
                by_label[label] = new_group
        print(f"{slug}: +{len(new_groups)} groups, {sum(len(v) for v in new_groups.values())} videos classified")

    GROUPS_PATH.write_text(json.dumps(existing, separators=(",", ":"), ensure_ascii=False))
    print(f"Wrote {GROUPS_PATH}")


if __name__ == "__main__":
    main()
