#!/usr/bin/env python3
# Shared read/write for data/sources/youtube-transcripts/ — the backfilled
# transcript text (13k+ videos, ~21KB average) outgrew a single
# youtube-transcripts.json: at full backfill it reaches ~300MB, over
# GitHub's hard 100MB-per-file limit (confirmed: a push was rejected with
# "File ... exceeds GitHub's file size limit of 100.00 MB" once the dataset
# passed roughly 5,000 real transcripts). Sharded by a stable hash of
# videoId into SHARD_COUNT files so each stays comfortably under the limit
# as the dataset keeps growing.
import hashlib
import json
from pathlib import Path

SHARD_COUNT = 10
TRANSCRIPTS_DIR_NAME = "youtube-transcripts"


def transcripts_dir(data_dir: Path) -> Path:
    return data_dir / "sources" / TRANSCRIPTS_DIR_NAME


def shard_for(video_id: str) -> int:
    return int(hashlib.md5(video_id.encode()).hexdigest(), 16) % SHARD_COUNT


def shard_path(data_dir: Path, n: int) -> Path:
    return transcripts_dir(data_dir) / f"shard-{n:02d}.json"


def load_shard(data_dir: Path, n: int) -> dict:
    p = shard_path(data_dir, n)
    if not p.exists():
        return {}
    return json.loads(p.read_text())


def load_all(data_dir: Path) -> dict:
    """Legacy single-file data/sources/youtube-transcripts.json (if it still
    exists, e.g. right after migrating) is merged in too, so callers don't
    need special-case handling during the transition."""
    result = {}
    legacy_path = data_dir / "sources" / "youtube-transcripts.json"
    if legacy_path.exists():
        result.update(json.loads(legacy_path.read_text()))
    for i in range(SHARD_COUNT):
        result.update(load_shard(data_dir, i))
    return result


def save_shard(data_dir: Path, n: int, shard_data: dict) -> None:
    transcripts_dir(data_dir).mkdir(parents=True, exist_ok=True)
    shard_path(data_dir, n).write_text(
        json.dumps(shard_data, separators=(",", ":"), ensure_ascii=False)
    )
