#!/usr/bin/env python3
# Transcribes a video for fast-consume (src/archive.ts) with faster-whisper:
# one line per Whisper segment, with word timings, as the JSON that
# `fast-consume --transcript` reads ([{startS, endS, text, words: [...]}]).
#
#   python3 -I transcribe.py <video> <out.json>
#
# Needs ffmpeg on PATH and `pip install faster-whisper`. FAST_CONSUME_WHISPER_MODEL
# picks the model (default "small": on an M3 Pro CPU it transcribes a
# 20-minute talk in a few minutes, with the punctuation the cut needs).
import json
import os
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("usage: transcribe.py <video> <out.json>")
    src, out = sys.argv[1], sys.argv[2]
    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
        check=True,
        capture_output=True,
    ).stdout
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768.0
    model = WhisperModel(os.environ.get("FAST_CONSUME_WHISPER_MODEL", "small"), device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        audio, language="en", vad_filter=True, word_timestamps=True, condition_on_previous_text=False
    )
    rows = []
    shown = -1
    for s in segments:
        text = s.text.strip()
        if not text:
            continue
        rows.append(
            {
                "startS": round(s.start, 3),
                "endS": round(s.end, 3),
                "text": text,
                "words": [
                    {"startS": round(w.start, 3), "endS": round(w.end, 3), "text": w.word.strip()}
                    for w in (s.words or [])
                    if w.word.strip()
                ],
            }
        )
        minute = int(s.end // 60)
        if minute != shown:
            shown = minute
            print(f"\rtranscribed {minute} of {info.duration / 60:.0f} min", end="", flush=True)
    print()
    with open(out, "w") as f:
        json.dump(rows, f)
    print(f"{len(rows)} segments")


if __name__ == "__main__":
    main()
