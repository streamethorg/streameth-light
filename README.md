# StreamETH Light

A read-only archive of the StreamETH video library. Browses organizations →
events → sessions, plus a searchable "all videos" view, all served from a
static JSON snapshot of the production database committed to `data/`.

- Public sessions only (`published: "public"`).
- No backend at runtime — pages read `data/*.json` at build/request time.
- Video playback resolves Livepeer `playbackId` to an HLS stream
  (`https://livepeercdn.studio/hls/{playbackId}/index.m3u8`), falling back to
  a raw `videoUrl` when present.

## Refreshing the data

The production Mongo isn't reachable directly from a laptop — it only exists
on the app's private Docker network on the VPS. `scripts/export-db.sh`
automates the whole round trip: SSHes in, starts the `mongodb` container if
it's stopped, runs the export inside a throwaway container on that network,
copies the resulting JSON into `data/`, and puts the container back the way
it found it.

```bash
cp scripts/.env.export.example scripts/.env.export  # fill in DB_PASSWORD
pnpm export-db
```

## Search index

The homepage feed and `/search` (deep search across transcripts and tracked
YouTube videos) both query `data/streameth.db` — a SQLite database with an
FTS5 full-text index unifying StreamETH sessions and YouTube videos into one
`videos` table (see `scripts/build-db.mjs`, `lib/videoDb.ts`). It's generated
from the committed JSON, not itself committed — `pnpm dev`/`pnpm build` run
`pnpm build-db` automatically via `predev`/`prebuild`. Uses Node's built-in
`node:sqlite` (Node 22.5+, no native compilation), so it runs anywhere the
app's Node runtime does.

## Development

```bash
pnpm install
pnpm dev
```

## Deploy

Deployed on Vercel. `data/*.json` is committed to git, so a normal Vercel
build (no environment variables, no database) is enough — `data/streameth.db`
is rebuilt from it during `pnpm build`.
