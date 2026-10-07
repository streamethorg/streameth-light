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

The homepage feed's search/filtering queries `data/streameth.db` — a SQLite
database with an FTS5 full-text index (including transcripts) unifying
StreamETH sessions and tracked YouTube videos into one `videos` table (see
`scripts/build-db.mjs`, `lib/videoDb.ts`). It's generated from the committed
JSON, not itself committed — `pnpm dev`/`pnpm build` run `pnpm build-db`
automatically via `predev`/`prebuild`. Uses Node's built-in `node:sqlite`
(Node 22.5+, no native compilation), so it runs anywhere the app's Node
runtime does.

## MCP server

`/api/mcp` is a read-only [MCP](https://modelcontextprotocol.io) endpoint
(Streamable HTTP, `app/api/mcp/route.ts`) over the same search index, so AI
agents can search the archive and read transcripts. Tools: `search_videos`,
`get_video`, `get_transcript` (paged), `list_channels`, `list_topics`.

```bash
claude mcp add --transport http streameth https://<your-domain>/api/mcp
```

Signed-in users get a personal token on `/connect` ("Connect with MCP"
in the top bar) and pass it as `Authorization: Bearer smcp_…`. A user with no
tokens gets one created automatically on their visit, since the page is the
only place a token can be shown; they can add more per app. Only a
SHA-256 hash is stored (`mcp_tokens`, `supabase/migrations/`); `/api/mcp`
checks it through the `verify_mcp_token` database function. Users can revoke
tokens on the same page.

Apps that support OAuth (e.g. Claude.ai connectors) can connect without a
token, still as a signed-in wallet account. Supabase Auth's OAuth 2.1 server
is the authorization server: `/.well-known/oauth-protected-resource/api/mcp`
points clients at it, the client registers itself (dynamic client
registration), and the user signs in with their wallet and approves on
`/oauth/consent`. The MCP route then verifies the Supabase access token
(`lib/supabase/mcpAuth.ts`).

On the hosted project, in **Authentication → OAuth Server**: enable it, set
the authorization path to `/oauth/consent`, and allow dynamic client
registration. The project's Site URL must be this app's domain, since
Supabase builds the consent URL from it. Locally, `supabase/config.toml`
already has these set.

## Ask the archive (AI answers)

The home page's question box (`components/AskBox.tsx`) posts to `/api/ask`,
which runs a model through [OpenRouter](https://openrouter.ai) (default
`deepseek/deepseek-v4-flash`, `lib/ask.ts`) with one tool,
`search_archive`: an any-term FTS5 search over the same index that returns
the best-matching talks (transcripts first) with numbered passages. The model
searches a few times, then writes an answer citing passages as `[n]`; the
route streams search steps, sources and answer text as NDJSON, and the UI
turns `[n]` into links to the talks. `/?ask=<question>` links ask on open.

With `JEV_API_KEY` set, each search's passages first go through TypeSafe
AI's Jev decision model (`lib/jev.ts`): one yes/no question per passage —
does it help answer the question? — and passages below the threshold are
dropped before the answering model sees them. If Jev is unset, slow (>5s) or
errors, all passages are kept.

Asking requires signing in (the boxes show for everyone; asking while signed
out shows a sign-in prompt that returns to the question). `/api/ask` is rate
limited through Supabase (`consume_ask_quota`, migration
`…03_ask_rate_limit.sql`): per user per hour and site-wide per day. In production the route refuses to answer
if the limit can't be checked.

| Env var | |
| --- | --- |
| `OPENROUTER_API_KEY` | Required — Ask is disabled without it |
| `OPENROUTER_MODEL` | Any OpenRouter model with tool calling (default `deepseek/deepseek-v4-flash`) |
| `JEV_API_KEY` | Optional — [BeatAPI](https://beatapi.io/jev-api) key for the Jev relevance filter |
| `JEV_MODEL` | Jev model (default `jev-1.13`; `jev-1.13-free` is limited to 1 request/min) |
| `JEV_THRESHOLD` | Minimum relevance probability to keep a passage (default 0.3) |
| `ASK_HOURLY_LIMIT` | Questions per user per hour (default 20) |
| `ASK_DAILY_LIMIT` | Questions per day across the site (default 2000) |

## Weekly email digest

Visitors can subscribe on the home page to a Monday email of the past week's
new talks, grouped by event (`lib/digest.ts`). It's double opt-in: the
confirmation link opens `/digest/confirm`, where a button (not the page load,
so link-scanning mail filters can't confirm) activates the subscription.
Every email has an unsubscribe link and RFC 8058 one-click
`List-Unsubscribe` headers. Subscribers live in `digest_subscribers`
(migration `…04_digest_subscribers.sql`), readable only with the service-role
key. A Vercel cron (`vercel.json`, Mondays 09:00 UTC) calls
`/api/digest/send`; mail goes out through [Resend](https://resend.com).

| Env var | |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, for `digest_subscribers` |
| `RESEND_API_KEY` | Resend API key |
| `DIGEST_FROM` | Sender, e.g. `StreamETH <digest@streameth.org>` (domain verified in Resend) |
| `CRON_SECRET` | Vercel sends it with cron requests; `/api/digest/send` rejects anything else |

## Watch analytics

The players report plays and watch time to `/api/views` (`lib/viewTracking.ts`):
one row per playback in `video_views` (migration `…05_video_views.sql`), with
seconds actually played (seeking excluded), the furthest point reached, and
the viewer if signed in. `mode` is `video` for the watch page and `audio` for
Listen mode. Per-video totals are in the `video_view_stats` view. Both are
readable only with the service-role key (SQL editor or `supabase` CLI); it
uses the same `SUPABASE_SERVICE_ROLE_KEY` as the digest.

## Accounts (wallet sign-in, saved videos)

Accounts are Ethereum wallets: sign-in is Sign in with Ethereum (EIP-4361)
through Supabase's native Web3 auth — the user signs a message, no
transaction or gas. There is no email sign-in. Supabase (Postgres + Auth) is
the one persistent, writable piece of an otherwise read-only/static app.
Schema lives in `supabase/migrations/`; `saved_videos` rows are protected by
row-level security so a user can only see/write their own.

Environment variables (`.env.local`, and the Vercel project):

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon/publishable key |
| `ETH_RPC_URL` | production | Mainnet RPC for ENS names; falls back to viem's rate-limited public RPC |

New environment (e.g. a fresh Supabase project): `supabase link --project-ref
<ref>` then `supabase db push` to apply the migrations. Then in the dashboard:

- Authentication → Sign In / Providers → **Web3 Wallet → Ethereum: on**.
- Authentication → Sign In / Providers → **Email: off** (no email accounts).
- Authentication → URL Configuration: the site URL (and any preview domains)
  must be allowed, or signatures are rejected with "message was signed for
  another app".

Local stack: `supabase start` uses `supabase/config.toml`, which already
enables Ethereum sign-in and disables email signup.

## Search engines and AI crawlers

Every video should be indexable by Google and quotable by AI answer engines:

- `/sitemap.xml` lists channels, events, speakers and topics; `/watch/sitemap/<n>.xml`
  are video sitemaps covering every watch page (5,000 per file). `/robots.txt`
  lists them all and explicitly allows the major AI crawlers.
- Watch pages carry `VideoObject` + `BreadcrumbList` JSON-LD, a canonical URL,
  and the full transcript in the server-rendered HTML. Videos without a cover
  image get a generated thumbnail at `/watch/<id>/poster.png`.
- `/llms.txt` maps the archive for AI assistants, and `/watch/<id>.md` is a
  plain-markdown copy of any talk (metadata, description, transcript).
- `pnpm build` runs `scripts/check-seo.mjs` afterwards and fails if any watch
  page or sitemap entry is missing what indexing needs.

Set `NEXT_PUBLIC_SITE_URL` to the production domain if it differs from Vercel's
production URL — canonical URLs, sitemaps and JSON-LD are built from it. Set
`GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` to verify the site in
Google Search Console / Bing Webmaster Tools, then submit `/robots.txt`'s
sitemaps there and watch the Video indexing report.

## Development

```bash
pnpm install
pnpm dev
```

## Deploy

Deployed on Vercel. `data/*.json` is committed to git, so the video archive
itself needs no environment variables or database — `data/streameth.db` is
rebuilt from it during `pnpm build`. Accounts need the env vars above set in the
Vercel project.

## License

[MIT](LICENSE)
