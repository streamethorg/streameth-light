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

Signed-in users can generate a personal token on `/connect` ("Connect to
MCP" in the sidebar) and pass it as `Authorization: Bearer smcp_…`. Only a
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
