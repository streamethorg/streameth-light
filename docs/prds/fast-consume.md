# PRD: Fast consume

> **Status:** v1 built (`packages/fast-consume`); tested on one real talk · **Author:** Pablo Voorvaart · **Date:** 2026-10-24 · **Slug:** `fast-consume`

## 1. Summary

A CLI that turns any talk in the archive into the shortest version that still
tells its argument. It downloads the video, transcribes it with Whisper, has the
LLM write the argument as a chain of steps and keep only the sentences that state
each step, has a second LLM call check the cut as a newcomer would hear it, and
re-encodes just those passages, in order, into one MP4. A Remotion pass then adds a
name strap, burned-in captions, a progress line and a closing card with the talk's
thesis. A 20-minute talk becomes 4–5 minutes.

It started in streameth-studio (venue clips); this is the archive version.

## 2. Goals & non-goals

**Goals**

- One command, `pnpm fast-consume --video <id or URL>`, for any video on the site: StreamETH sessions and tracked YouTube uploads alike.
- No fixed length. The argument decides it; the cut drops evidence, examples and anecdotes, and keeps each step of the argument.
- Cuts land on sentence boundaries, never mid-word (word timings, see §4 "Sentences").
- Passages stay in talk order, so it still reads as the same talk.

**Non-goals**

- Not on the site yet: no "fast version" on watch pages, no hosting for the MP4s. Output is a local file.
- No batch mode.
- The Next app doesn't depend on the package; it's a workspace package that builds, lints and tests on its own.

## 3. Usage

```
pnpm fast-consume --video yt-bXe3ass7I-o                       # an archive id
pnpm fast-consume --video https://streameth.org/watch/yt-bXe3ass7I-o
pnpm fast-consume --video https://www.youtube.com/watch?v=bXe3ass7I-o
pnpm fast-consume --video 65b8f60ca5b2d09b88ec0c8f --speed 1.25  # a StreamETH session
pnpm fast-consume --video … --music track.mp3                  # a bed under the cut
pnpm fast-consume --video … --plain                            # the cut alone, no graphics
pnpm fast-consume --video … --dry-run                          # print the chosen passages, don't render
pnpm fast-consume graphics fast/yt-bXe3ass7I-o.fast.mp4        # redo only the graphics, no LLM call
pnpm fast-consume --file talk.mp4 --transcript talk.json --title "…" --speakers "…"   # any video
```

Output: `fast/<id>.fast.mp4` (gitignored) with `<id>.fast.json` beside it, and
`<id>.fast.plain.mp4`, the cut without graphics. `--out` puts it elsewhere.
`--title`, `--speakers`, `--event` and `--url` override what goes on screen.

**Needs:** ffmpeg, yt-dlp (YouTube videos), Python with `faster-whisper`
(`pip install faster-whisper`; `FAST_CONSUME_PYTHON` points at a venv), an LLM
key in `.env.local` (`OPENROUTER_API_KEY`, the one Ask uses, or `ANTHROPIC_API_KEY`),
and `data/streameth.db` (`pnpm build-db`, which `pnpm dev` runs anyway).

| Env | Default | |
|---|---|---|
| `FAST_CONSUME_CACHE` | `~/.cache/fast-consume` | downloaded videos and Whisper transcripts, one folder per id |
| `FAST_CONSUME_PYTHON` | `python3` | a Python that can import `faster_whisper` |
| `FAST_CONSUME_WHISPER_MODEL` | `small` | |
| `FAST_CONSUME_MODEL` | Sonnet 5.5 | |
| `FAST_CONSUME_SITE_URL` | `NEXT_PUBLIC_SITE_URL`, else `https://streameth.org` | for the "Full talk" link on the closing card |

## 4. Technical design

| File | Responsibility |
|---|---|
| `src/index.ts` | argv parsing, orchestration, exit codes |
| `src/archive.ts` | `--video`: look the id up in `data/streameth.db`, download, transcribe; both cached |
| `scripts/transcribe.py` | faster-whisper with word timings → the `--transcript` JSON format |
| `src/source.ts` | `--file`: read and validate a transcript JSON |
| `src/select.ts` | the two LLM calls (draft, review) and validating their answers |
| `src/ranges.ts` | pure: sentences, line indices → padded, merged `{startS, endS}` |
| `src/render.ts` | the ffmpeg cut |
| `src/captions.ts` | pure: word timings remapped onto the cut, for the captions |
| `src/graphics.ts`, `src/graphics/` | the Remotion pass and composition |
| `src/llm.ts` | OpenRouter or Anthropic client |

**Why Whisper, when the archive has transcripts.** They can't drive a cut. `data/transcripts.json` and `data/sources/youtube-transcripts/` are plain text with no timings, and the YouTube ones have no punctuation either, so there are no sentences to cut on. The old StreamETH `.vtt` files with timings were on the DigitalOcean bucket that's gone.

**Where the video comes from.** The `videos` row decides: a YouTube upload goes through yt-dlp at ≤720p; a session uses its `download_url` (an MP4) when it has one, else its HLS `content_url` copied with ffmpeg. Downloads land as `.partial` files and are renamed, so a cached `video.mp4` is always whole.

**Titles.** YouTube titles carry everything ("Haseeb Qureshi - Agents + Crypto: What's Real & What's Cope - TOKEN2049 Singapore 2026"), and most uploads have no speakers in the archive. The draft call also returns `displayTitle`, `speakers` and `event`, used for YouTube videos only (sessions have real fields). A name is taken only from the title, the speaker list or the speaker themself, never guessed. The strap falls back to the archive's org name for the event.

**What testing on a real talk changed** (Haseeb Qureshi, TOKEN2049 2026, 19:35):

- *No length target; draft, then review.* Every version that aimed at 10% played as disjointed fragments: the target forced out the sentences linking one point to the next. Now the draft keeps the sentences that state each step of the argument, and the review reads the cut back as heard and fixes dangling references ("what he points out") by dropping lines, not by restoring examples.
- *Sonnet by default.* Haiku's pick lost the whole second half of the talk.
- *`tool_choice: auto`.* Sonnet 5.5 rejects a forced tool choice with a 400.
- *Sentences.* Whisper segments break mid-sentence ("…you do. And I'm going to"). With word timings, `toSentences` rebuilds the transcript as one line per sentence, so every cut is a whole sentence. Padding stops halfway to the next line, so the next sentence's first word never bleeds in.

**Graphics.** The ffmpeg cut is written as `<out>.plain.mp4`, then Remotion (pinned 4.0.534) renders `<out>.mp4` at the cut's size and frame rate. The look is broadcast, not motion-template: no gradients, glows or pills; Inter, as on the site; StreamETH purple (`#6426EF`) as the only color.

- The talk starts on the first frame, with a name strap over the opening 6s: the speaker on a white bar, title · event on a purple bar.
- A small white StreamETH mark top right.
- Plain white captions, one line at a time, narrow enough to clear venue logos in the bottom corners.
- A white hairline along the bottom showing progress.
- A 5s closing card in solid purple: the thesis, the speaker, the logo and the watch page URL.
- `--music <file>`: 0.06 under the speaker, up to 0.5 on the closing card. No track ships with the repo; bring a cleared one.

The graphics pass reads only the plain cut and the sidecar, so `fast-consume graphics <out.mp4>` redoes it without an LLM call, and a failed graphics render leaves the cut in place. The first render downloads Chrome Headless Shell (~170 MB).

**Workspace.** The repo is now a pnpm workspace (`packages/*`). The root `tsconfig.json` and ESLint config skip `packages/`, which has its own `tsconfig.json`; the Next app's install, build and deploy are unchanged apart from installing the package's dependencies. `pnpm-workspace.yaml` allows esbuild's install script (tsx and Remotion's bundler need it; the earlier placeholder made `pnpm install` fail once esbuild was in the tree).

## 5. Edge cases

| # | Scenario | Behavior |
|---|---|---|
| 1 | Id not in the archive, or `data/streameth.db` not built | Exit 2, says which (and `pnpm build-db`) |
| 2 | A URL that isn't a watch page or YouTube | Exit 1 |
| 3 | yt-dlp missing, video private or removed, CDN 404 | Exit 3 with the tool's last error line; no partial file left |
| 4 | Python can't import faster_whisper | Exit 4, says to install it or set `FAST_CONSUME_PYTHON` |
| 5 | Video under 2 min, or no audio | Exit 5 |
| 6 | No LLM key | Exit 6 |
| 7 | LLM returns bad indices | Dropped and warned; nothing usable twice → exit 6 |
| 8 | Render fails | Exit 7; `.partial` deleted; for graphics, the cut and a retry command are kept |
| 9 | Re-run on the same id | Reuses the cached video and transcript; picks passages again |
| 10 | Over 4000 sentences (~3h) | Exit 5; one LLM call can't take it |

## 6. Tests

`pnpm --filter @streameth/fast-consume test` (`node:test` via tsx): ranges, sentence rebuilding, the ffmpeg args, caption remapping, transcript parsing, LLM answer handling with a scripted model, and the archive lookup (`parseVideoRef`, `findVideo` against a temp SQLite DB). Whether a cut is *good* is judgment; it's checked by watching real outputs.

## 7. Open questions

1. Put fast versions on the site: where the MP4s live (Livepeer upload, Supabase storage, the VPS) and how a watch page finds one.
2. Batch mode, e.g. every new talk from the daily data refresh.
3. Music: the test track's license is unknown; pick a cleared one before anything is published.
