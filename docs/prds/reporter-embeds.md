# PRD: Reporter embeds in the event feed

> **Status:** Draft · **Author:** Pablo Voorvaart (with Claude) · **Date:** 2026-10-24 · **Slug:** `reporter-embeds`
>
> Replaces the earlier `livepeer-uploads` draft: we don't host files.

## 1. Summary

Reporters can drop any media link into an event's feed — a YouTube video or
Short, an X post, a Vimeo or TikTok video, a Spotify or SoundCloud episode, or
any web page. Known providers embed with their own player; anything else shows
as a link card (title, image, site). Each item is filed under the reporter's
byline, like their stories, and credits the original author. Nothing is
downloaded or re-hosted. Embeds live in the feed only.

## 2. Problem & motivation

- Every video on the site is pulled, never added by hand: YouTube channels in
  `data/directory.json` via `scripts/pull-youtube-videos.py` (hourly for live
  events, `.github/workflows/refresh-live.yml`) and StreamETH sessions, built
  into a read-only SQLite file (`scripts/build-db.mjs` → `data/streameth.db`).
- So the team can't put its own clip, an interview posted on X, a podcast
  episode or an announcement on an event page.
- Reporters (`lib/stories.ts`, `REPORTER_EMAILS`) already file stories into
  events; media is the missing half.

## 3. Goals & non-goals

**Goals**

- G1. A reporter's operator (`/upload`) or its agent (MCP `embed_media`) can
  add any `https` link to any event that has a coverage page.
- G2. Rich embeds for known providers (v1: YouTube, X, Vimeo, TikTok,
  Spotify, SoundCloud) — each plays in the feed with the provider's player.
- G3. Any other link becomes a link card from the page's Open Graph tags
  (title, description, image, site name).
- G4. Each item shows under the reporter's byline and names the original
  author/site. The reporter's trust decides where it shows (`visibleOn`).
- G5. In the event's feed within a minute of being added.
- G6. Operator and agent can list and remove their own embeds.
- G7. Adding a provider = one registry entry, no schema change.

**Non-goals (v1)**

- Uploading or hosting files; downloading media; scraping or searching
  platforms. Reporters pick links by hand.
- Embeds outside the feed: Videos tab, Shorts row, home page `LiveBlock`,
  search, speaker/topic pages, Ask/transcripts, digest.
- Providers that need app tokens (Instagram, Facebook) or have no oEmbed
  (Farcaster) — they fall back to link cards.
- Daily limits (only approved reporters can add, and embeds cost nothing).
- A review queue.

## 4. User-facing behavior

**Entry points**

- Event page sidebar (`components/EventCoverage.tsx`, `Sidebar`): **Add to
  feed**, shown only to signed-in users who run a reporter, linking to
  `/upload?event=<event key>`.
- `/upload` directly; from each reporter row in `ReporterSetup` on `/connect`.
- MCP: `embed_media`, `list_my_embeds`, `remove_embed`.

**`/upload`**

1. Not signed in → `/signin?next=/upload…` (as `app/connect/page.tsx`).
2. Not allowlisted or no reporter → "Media is added by reporters" (+ link to
   `/connect#reporters` when allowlisted).
3. Form: **Reporter**, **Event** (from `?event=`, else a searchable picker),
   **Link**, **Note** (optional, ≤ 280).
4. On paste it names what it recognised ("YouTube Short", "X post",
   "Spotify episode", "Link card").
5. Submit → live; success message links to the event page.
6. **Your media**: newest first — title, type, event, reporter, **Remove**.

**In the event feed**

The feed is grouped by day (`components/EventCoverage.tsx` ~line 475) with
stories (`StoryItem`, ~line 430) and videos. Embeds are a new item type,
placed by when they were added:

- Header: "**Rollup Desk** shared · a YouTube video from *ETHGlobal*" + the note.
- Body by provider:
  - YouTube — cover with play button; click → `youtube-nocookie.com` iframe
    in place (vertical for Shorts).
  - X — post rendered by `widgets.js` (`data-dnt="true"`, site theme); before
    it loads or if blocked: quote card with author, text, link.
  - Vimeo, TikTok, Spotify, SoundCloud — cover/title card; click → the
    provider's iframe player in place (sandboxed).
  - Anything else — link card (image, title, description, domain), opens in
    a new tab.

## 5. Technical design

- **Reference features**
  - Supabase content merged into the event feed: stories
    (`supabase/migrations/00000000000009_stories_and_reporters.sql`,
    `lib/stories.ts` `getAdmin()`, `listStoriesForEvents` with
    `unstable_cache` + tag, merged in `lib/eventFeed.ts`).
  - Who may file: `emailCanReport`/`userCanReport` (`lib/stories.ts`),
    `filingReporter` (`app/api/mcp/route.ts`).
  - Signed-in form + server actions: `app/connect/*`, `components/ReporterSetup.tsx`.

- **Where the code goes**

  | Layer | File | Change |
  |---|---|---|
  | DB | `supabase/migrations/00000000000011_event_embeds.sql` | table + RLS |
  | Pure | `lib/embedCore.mjs` + `.test.mjs` | provider registry, URL match/normalize, oEmbed/OG → fields, iframe URL builder, private-IP check |
  | Server | `lib/embeds.ts` | safe fetch, add/list/remove, cached `listEmbedsForEvents` |
  | Page | `app/upload/page.tsx`, `app/upload/actions.ts`, `components/EmbedForm.tsx` | form + list |
  | MCP | `app/api/mcp/route.ts`, `lib/reporterGuide.ts` | 3 tools + docs |
  | Feed | `lib/eventFeed.ts` | new `{ kind: "embed", at, embed }` item |
  | UI | `components/EventCoverage.tsx`, `components/EmbedItem.tsx` (client) | render per provider; click-to-play; X widget |

- **Data model** — `public.event_embeds`

  | Column | Type | Notes |
  |---|---|---|
  | `id` | uuid pk | |
  | `reporter_id` | uuid → reporters, on delete cascade | byline |
  | `user_id` | uuid → auth.users, on delete set null | who added it |
  | `event_key` | text not null | `SeasonEvent.key` |
  | `provider` | text not null | `youtube`, `x`, `vimeo`, `tiktok`, `spotify`, `soundcloud`, `link` |
  | `external_id` | text | provider's id (null for `link`) |
  | `url` | text not null | canonical URL (≤ 2000) |
  | `variant` | text | e.g. `short` for YouTube Shorts, `episode`/`track` |
  | `title` | text ≤ 300 | |
  | `description` | text ≤ 1000 | OG description / X post text, plain text only |
  | `author_name`, `author_url` | text | original creator |
  | `site_name` | text | link cards |
  | `image_url` | text | https only |
  | `note` | text ≤ 280 default '' | reporter's line |
  | `removed_at` | timestamptz | soft delete |
  | `created_at` | timestamptz default now() | feed time |

  Unique `(event_key, url)` where `removed_at is null`. Index
  `(event_key, created_at desc)`. RLS: public `select` where
  `removed_at is null` and reporter not suspended; writes service-role only.

- **Contracts**

  - `embed_media({ reporterSlug, eventKey, url, note? })` (server action + MCP)
    → `{ ok: true, id, provider, eventUrl } | { ok: false, error }`.
    Order: auth → `filingReporter` → event has `href` → parse URL (https only,
    ≤ 2000 chars) → `matchProvider` → duplicate check → fetch metadata →
    insert → `revalidateTag("embeds")`.
  - `matchProvider(url)` (pure) → `{ provider, externalId, canonicalUrl, variant, oembed } | { provider: "link", canonicalUrl }`.

    | Provider | Matches | oEmbed | Player (built from id, never from oEmbed HTML) |
    |---|---|---|---|
    | youtube | `watch?v=`, `youtu.be/`, `/shorts/`, `/live/`, `m.` | `youtube.com/oembed` | `youtube-nocookie.com/embed/<id>` |
    | x | `(x\|twitter\|mobile.twitter).com/<h>/status/<id>`, `i/web/status/<id>` | `publish.twitter.com/oembed` | `widgets.js` on our blockquote |
    | vimeo | `vimeo.com/<id>` | `vimeo.com/api/oembed.json` | `player.vimeo.com/video/<id>?dnt=1` |
    | tiktok | `tiktok.com/@<h>/video/<id>` | `tiktok.com/oembed` | `tiktok.com/embed/v2/<id>` |
    | spotify | `open.spotify.com/(episode\|track\|show\|playlist)/<id>` | `open.spotify.com/oembed` | `open.spotify.com/embed/<type>/<id>` |
    | soundcloud | `soundcloud.com/<user>/<track>` | `soundcloud.com/oembed` | `w.soundcloud.com/player/?url=<canonical>` |
    | link | anything else on https | — | link card from Open Graph |

  - **Safe fetch** for link cards (`lib/embeds.ts`): https only; resolve DNS
    and refuse private/loopback/link-local/metadata addresses (incl. after
    each redirect, max 3); 5 s timeout; read ≤ 512 KB; `text/html` only;
    parse `og:*` / `twitter:*` / `<title>` from `<head>`. Images are stored
    as URLs (https only), not proxied.
  - `remove_embed({ id })` → `removed_at = now()`, reporter's operator only.
  - `list_my_embeds()` → caller's embeds across their reporters.

- **Control flow**

  ```
  /upload or MCP ─embed_media─▶ checks ─▶ oEmbed (known) / safe OG fetch (link) ─▶ row ─▶ revalidateTag("embeds")
  Event page ─▶ eventFeed(event) ─▶ stories ∪ sessions ∪ videos ∪ listEmbedsForEvents([key]) (cached 60 s)
  ```

  Only `lib/eventFeed.ts` and the feed renderer change — no changes to
  `eventCoverage`, `VideosTab`, `LiveBlock` or `data/streameth.db`.

- **Dependencies** — none new. Public oEmbed endpoints, no keys.

## 6. Edge cases & failure modes

| # | Scenario | Decided behavior | Notes |
|---|---|---|---|
| 1 | Unknown event or no `href` | Reject "Pick an event" | |
| 2 | Not signed in / not on `REPORTER_EMAILS` / runs no reporter | Reject with the matching message | |
| 3 | `reporterSlug` not theirs; removing someone else's embed | Reject | IDOR |
| 4 | Reporter `suspended` / `new` | Suspended: can't add, embeds hidden. New: shows on event + reporter pages only | `visibleOn` |
| 5 | Removed from allowlist later | Existing embeds stay; can remove; can't add | |
| 6 | `http://`, `javascript:`, `data:`, `file:`, > 2000 chars, not a URL | Reject "Paste an https link" | |
| 7 | Link card URL resolves to a private/internal address (`localhost`, `10.x`, `169.254.169.254`, `[::1]`), directly or via redirect | Refuse fetch; reject "Can't preview that link" | SSRF |
| 8 | Link page slow, huge, or not HTML (PDF, image, video file) | 5 s / 512 KB cap; non-HTML → card with just the URL and domain | |
| 9 | Page has no OG tags | Card from `<title>` + domain; no image | |
| 10 | Known provider link is private/deleted/embedding-disabled (oEmbed 401/403/404) | Reject "That link isn't public or can't be embedded" | |
| 11 | oEmbed down / 429 / > 5 s | Reject "Couldn't reach <provider>, try again" | |
| 12 | Short links (`t.co`, `bit.ly`, `youtu.be` is fine) | Treated as `link`; safe fetch follows ≤ 3 redirects and re-matches the final URL against providers | |
| 13 | Same URL twice in one event | Unique index → "Already in this event's feed" | Same URL in two events is fine |
| 14 | YouTube link already in the event's archive coverage | Allowed but warns "Already in this event's videos" — it's commentary in the feed | |
| 15 | oEmbed HTML / OG text with markup or script | Never rendered as HTML; plain text only; players built from ids | XSS |
| 16 | Provider iframes | `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"`, `referrerpolicy="strict-origin-when-cross-origin"`, loaded only on click | Third-party tracking until click |
| 17 | Media deleted later | Provider player shows its error; card still links out | No auto-removal |
| 18 | Visitor blocks a provider | Card with title/image/link stays | |
| 19 | Many embeds on one page | No third-party script/iframe until clicked; X `widgets.js` loaded once, lazily | |
| 20 | Supabase down | `listEmbedsForEvents` logs, returns `[]` | Same as stories |
| 21 | Removed embed still cached | `revalidateTag("embeds")`; worst case 60 s | |
| 22 | Embed on an event that ended months ago | Top of that event's feed, by `created_at` | Intended |
| 23 | Reporter deleted (operator deletes account) | Embeds cascade away | |

## 7. Test plan

Convention: pure logic in `.mjs` with `node --test` (`lib/storyVerify.test.mjs`).

| # | Verifies | Type | Maps to |
|---|---|---|---|
| 1 | `matchProvider` table for every provider's URL variants → provider, id, canonical, variant; other https → `link`; `http:`/`javascript:`/bad → null | unit `lib/embedCore.test.mjs` | G2, G3, EC6 |
| 2 | `isPrivateAddress` for IPv4/IPv6 private, loopback, link-local, metadata, mapped IPv6 | unit | EC7 |
| 3 | `parseOpenGraph(html)` → title/description/image/site; falls back to `<title>`; ignores relative/`http:` images; strips tags | unit (fixture HTML) | EC8, EC9, EC15 |
| 4 | `oembedFields(provider, json)` for each provider fixture; garbage → null | unit | EC10, EC15 |
| 5 | `playerUrl(provider, id, variant)` builds the expected iframe src | unit | G2 |
| 6 | Add a YouTube Short, an X post, a Spotify episode and a news article to one event → four feed items with correct bodies; each plays/opens on click | manual | G1–G4 |
| 7 | Same URL again → rejected; private video, deleted post → rejected; `http://localhost:3000` and `http://169.254.169.254` → rejected | manual | EC7, EC10, EC13 |
| 8 | Non-allowlisted account: no button, `/upload` explains, MCP rejected | manual | EC2 |
| 9 | Agent over MCP: `embed_media` → `list_my_embeds` → `remove_embed`; gone within 60 s | manual | G6, EC21 |
| 10 | `tsc --noEmit`, `eslint`, `node --test lib/*.test.mjs` | CI | all |

Hard to test: real provider players and oEmbed responses — fixtures + manual.

## 8. Rollout

1. Apply `00000000000011_event_embeds.sql`.
2. Ship — no env vars or keys.
3. Rollback: hide the button; `update event_embeds set removed_at = now()` hides everything.

## 9. Open questions

- Decided (2026-10-24): no Livepeer; any link; feed only; filed by reporters.
- Link cards for arbitrary sites need the server to fetch those pages (safely,
  see Safe fetch). OK, or only allow the known providers?
- Players load only when a reader clicks (no third-party tracking until
  then). OK, or autoload embeds like X posts?
- The page is still `/upload`. Rename to `/add`?
