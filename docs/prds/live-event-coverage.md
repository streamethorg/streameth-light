# PRD: Live event coverage

> **Status:** Built (v1, 2026-10-24) · **Author:** Pablo Voorvaart (with Claude) · **Date:** 2026-10-24 · **Slug:** `live-event-coverage`

## 1. Summary

Reposition StreamETH Light from a video library to a live coverage site for the
Ethereum event season. The homepage shows a short summary of what's happening now
(or happened most recently), then the season told as reporting: AI-written
stories (headlines, recaps, threads across events) where every claim cites the
talk it came from and every quote is checked against the transcript. Each
event/channel gets a coverage page — the current channel page (`app/[org]/page.tsx`)
reworked around "what's live, what just came out, what's on the schedule".
Videos are typed by format — **shorts**, **clips** (medium), **full talks /
streams** (long) — and each format gets its own card and placement. The archive
(search, Ask, transcripts) stays, but moves behind the coverage instead of being
the front door.

## 2. Problem & motivation

- The homepage (`app/page.tsx:49-91`) is "Ask the archive" + "New this week",
  which suits browsing old talks, not following an event while it runs.
- Channel pages (`app/[org]/page.tsx:178-237`) are a flat grid of event tiles
  sorted by date. Nothing shows that an edition is happening now, what's coming
  up, or what was published today.
- The data already has a calendar but the UI doesn't use it: Mira holds 1,651
  events across 2024–2028 (`data/sources/mira-events.json`), with 274 starting on
  or after today, including Devcon 8 (Mumbai, Nov 3–6) and its side events. Only
  the "Side events" list on directory-only channels uses it
  (`app/[org]/page.tsx:313-325`).
- Formats are invisible. 11,741 YouTube videos have a duration
  (`data/sources/youtube-metadata.json`): 472 are ≤3 min, 4,780 are 3–20 min and
  6,489 are >20 min. All of them render with the same 16:9 card. Real YouTube
  Shorts and past livestreams are never pulled at all, because
  `scripts/pull-youtube-videos.py:22-23` only lists the channel's `/videos` tab
  (not `/shorts` or `/streams`).
- Timing: Devcon 8 starts in 10 days, which makes it a natural first live test.

## 3. Goals & non-goals

**Goals**

1. Each event has a status computed from real dates: `live` (today falls within
   start–end, local to the event), `upcoming` (starts within the season),
   `recent` (ended ≤14 days ago), or `past`.
2. Homepage, top: a live/latest summary showing at most 3 events (live first,
   then most recent), each with its newest videos and a "watch live" link when a
   stream exists.
3. Homepage, below: the season as reporting — lead stories, event recaps and
   cross-event threads (see §5 "Stories"). No plain event list with counts.
7. Stories are written by AI from transcripts and published without review.
   Every factual sentence cites a talk; every quote matches the transcript (after
   normalizing case and punctuation), or the story is not published.
4. `/[org]` becomes the coverage page: a live/latest block, then today's new
   videos split by format, then the schedule (Mira main and side events), then
   the editions archive (the current tiles).
5. Shorts, YouTube livestreams and their recordings are ingested.
   `UnifiedVideo` gets a `format` field (`short` | `clip` | `talk` | `stream`).
6. During a live event, new uploads reach the site within about 1 hour, down
   from about 24.

**Non-goals**

- Running our own live streams or ingest. We link to or embed existing YouTube
  live streams only.
- Live chat, stories written or edited by people, or social embeds.
- Talk-level schedules for events without a schedule API. Devcon has one
  (`api.devcon.org`, 382 Devcon 8 sessions with `slot_start`, `slot_roomId`,
  `sources_youtubeId`) and is in scope for previews and recaps. Other events
  get Mira dates only.
- Jump-to-timestamp links. Transcripts are plain text with no timings
  (`data/sources/youtube-transcripts/shard-*.json`), so citations link to the
  talk with the quote highlighted in the transcript panel, not to a second.
- Removing archive features. Search, `/watch/[id]`, Ask, MCP and the digest
  keep working with their URLs unchanged.
- Any change to the StreamETH Mongo export (`scripts/remote-export.mjs`). Its
  newest event is from 2024-08, so it adds no live data.

## 4. User-facing behavior

### Homepage `/`

1. **Live now / Latest** — at most 3 event blocks.
   - A live event shows a red `LIVE` label, the dates and city, and the embedded
     YouTube live player if the channel is streaming. Otherwise it shows the
     newest uploads.
   - Under each block: a row of shorts (vertical cards), then the newest talks
     and clips.
   - With no live event, the slot shows the most recent event ("Latest:
     ETHRome, ended 3 days ago") plus the next upcoming one.
2. **The season, reported** — a front page of stories, newest first.
   - **Lead stories** (1–3): cross-event threads, e.g. "Native rollups go from
     idea to roadmap", with a headline, a standfirst (one-sentence summary), and
     3–5 short paragraphs with [n] citations and pulled quotes.
   - **Event reports**: one per event day while live ("Devcon 8, day 2:
     …"), a full recap once it ends, a preview before it starts (from the
     schedule, plus what the same speakers said earlier in the season).
   - **Threads**: topics running across the season, each a timeline of what
     different speakers said at different events.
   - Each story links to its sources (talk cards, same as Ask's source cards)
     and to the event's coverage page.
   - A small "Coming up" line lists the next events (dates and city, no counts).
   - Each story is labeled "Written by AI from N talk transcripts". Each one has
     a "Report a mistake" link.
3. The Ask box moves into the header search (it already appears via
   `?ask=` / "Ask AI about…" in `app/page.tsx:111-118`). Its homepage hero slot
   is removed.
4. A search or filter still switches to the results list (`app/page.tsx:93-134`),
   unchanged.

### Event coverage page `/[org]`

1. **Hero** (`PageHero`): status chip and the current or next edition's dates.
2. **Live / Latest block**: same component as the homepage, at full width.
3. **Format tabs** replace the `Events | Videos` tabs
   (`app/[org]/page.tsx:340-345`): `Coverage` (default) · `Talks` · `Shorts` ·
   `Clips` · `Editions`.
4. **Coverage tab**:
   - The event's latest report (day report, recap or preview), then older
     reports for this event.
   - "Today" / "This week" uploads, grouped by format.
   - Schedule from Mira (main events, then side events — the existing
     `TrackedEventRow`, now also shown for StreamETH orgs).
   - Editions grid (the current tiles).
5. **Shorts tab**: grid of vertical (9:16) cards.
   - Tapping one opens `/watch/yt-<id>` with a vertical player layout.

### States

| State | Behavior |
|---|---|
| Live, stream found | Embed the live player (`youtube-nocookie` iframe, same as `app/[org]/y/[group]/page.tsx:91-99`) and list new uploads below it |
| Live, no stream | "Happening now in Mumbai — recordings appear here as they're published", plus the uploads so far |
| Upcoming | Countdown text ("Starts in 10 days"), schedule, and the previous edition's best talks |
| Recent/past | Latest uploads, then the editions archive |
| No channel matched | Event row shows "not covered yet". No coverage page link; the Mira website link is shown instead |

## 5. Technical design

- **Reference features**
  - `lib/events.ts` (`getAllEventSummaries`, `newTalksByEvent`): the
    cross-source event list to extend.
  - `app/[org]/page.tsx`: the page to restructure.
  - `refresh-video-data.yml`: the pipeline to copy for the hourly job.

### Data model

`data/sources/youtube-videos.json` entries (`YoutubeVideo`, `lib/directory.ts:40-46`) gain:

```ts
interface YoutubeVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string | null;
  description: string | null;
  /** Which channel tab listed it. */
  tab: "videos" | "shorts" | "streams";
  /** yt-dlp live_status for /streams entries. */
  liveStatus?: "is_live" | "is_upcoming" | "was_live" | null;
}
```

`videos` table in `scripts/build-db.mjs:280` gains:

```sql
format TEXT NOT NULL,          -- 'short' | 'clip' | 'talk' | 'stream'
live_status TEXT,              -- 'is_live' | 'is_upcoming' | 'was_live' | NULL
CREATE INDEX idx_videos_format ON videos(format);
```

`format` rule (one shared function in `lib/videoFormat.mjs`, imported by
`build-db.mjs` and TS, same `.mjs` pattern as `lib/autoLabels.mjs`):

1. `tab === "shorts"` → `short`
2. `tab === "streams"` or `liveStatus` set → `stream`
3. `duration < 4*60` → `clip` (reuses the `durationBucket` "short" cut-off from
   `lib/browseParams.ts:43-47`; non-Shorts tab videos under 4 min are clips, not
   shorts, because they are landscape)
4. `duration <= 20*60` → `clip`
5. else, or duration unknown → `talk`
6. StreamETH sessions → `talk`

`UnifiedVideo` (`lib/videoDb.ts:7`) gains `format` and `liveStatus`.

New `lib/season.ts`:

```ts
export type EventStatus = "live" | "upcoming" | "recent" | "past";
export interface SeasonEvent {
  key: string;                // "mira:<id>" | existing EventSummary.key
  name: string;
  start: string; end: string; // ISO dates
  city: string | null;
  status: EventStatus;
  channelSlug: string | null; // matched directory entry, if any
  href: string | null;        // /[org] coverage page
  counts: Record<VideoFormat, number>;
  liveVideoId: string | null; // a /streams entry with liveStatus === "is_live"
}
export function listSeasonEvents(now?: number): SeasonEvent[];
export function liveAndLatest(now?: number, limit = 3): SeasonEvent[];
export function eventStatus(start: string, end: string, now: number): EventStatus;
```

Built from Mira `kind: "main"` events (422 in total), joined to channels:

- Through `DirectoryEntry.miraSeriesSlug`, which already exists.
- Then through `findMatchingEventName` (`lib/youtube.ts`) against the event
  name.

Merged with `EventSummary` entries from `lib/events.ts` that fall within the
season, deduplicated by the existing lower-cased-name rule
(`lib/events.ts:103-111`).

**Season** = the current calendar year, plus upcoming events through the next
3 months (confirm in §9).

### Where the code goes

| Layer | File | Change |
|---|---|---|
| Ingest | `scripts/pull-youtube-videos.py` | List `/videos`, `/shorts`, `/streams` per channel and tag each entry with its `tab` and `live_status`. Dedupe by id; `/videos` wins |
| Ingest | `scripts/pull-live.py` (new) | Re-pull only the channels of events with status `live` or within ±1 day, for all 3 tabs |
| CI | `.github/workflows/refresh-live.yml` (new) | Hourly cron. Exits early when no event is live. Runs `pull-live.py`, then metadata, transcripts, `build-db`. Opens or updates the same automerge PR as #42 |
| DB | `scripts/build-db.mjs`, `lib/videoFormat.mjs` (new) | `format` and `live_status` columns plus the index |
| Query | `lib/videoDb.ts` | `format` filter in `browseVideos` and `channelVideos`; new `latestByFormat(orgSlug, since, perFormat)` |
| Domain | `lib/season.ts` (new) | Status, season list, live/latest |
| UI | `components/LiveBlock.tsx`, `components/StoryCard.tsx`, `components/ShortCard.tsx` (new) | Cards follow `UnifiedVideoCard` styling (plain, per design-direction memory) |
| UI | `app/page.tsx` | Idle branch → `LiveBlock`×≤3 + story front page |
| UI | `app/[org]/page.tsx` | New tabs; coverage tab composition; Mira schedule for StreamETH orgs too |
| UI | `components/WatchLayout.tsx`, `app/watch/[id]/page.tsx` | Vertical player layout when `format === "short"` |
| Digest | `lib/digest.ts` | During a live event, send a daily recap per live event (optional, phase 2) |

### Freshness

The site is built from committed JSON, and `vercel.json` has no ISR. Fresh data
therefore means commit → automerge → deploy:

- The hourly `refresh-live.yml` keeps this flow, scoped to live channels only.
  That is a few channels × 3 tabs, about 1–2 minutes of yt-dlp.
- The live player itself needs no fresh data. A channel's live stream can be
  embedded at `youtube.com/embed/live_stream?channel=<channelId>`, which shows
  whatever that channel is streaming at view time. This needs the `channelId`
  for each directory entry (yt-dlp `/videos` JSON returns `channel_id`; store it
  on `DirectoryEntry`).

### Stories

Stories live in a Supabase `stories` table, not committed JSON. External
reporters (below) publish at runtime, without a commit, so all stories share one
store. The house writer writes there too. Pages read stories at request time,
cached for 60s, so new stories appear within a minute, with no redeploy.

New route `app/stories/[slug]/page.tsx`, plus a story list on `/` and `/[org]`.

```ts
// supabase: public.stories (migration 09), one row per story
interface Story {
  reporterId: string;            // fk reporters.id; the house writer is a reporter row too
  slug: string;                  // "devcon-8-day-2"
  kind: "lead" | "day" | "recap" | "preview" | "thread";
  headline: string;
  standfirst: string;            // one-sentence summary
  body: string;                  // markdown with [n] citations, same format as Ask answers
  quotes: { text: string; n: number }[];
  sources: AskSource[];          // reuse the lib/ask.ts type
  eventKeys: string[];           // SeasonEvent keys this story covers
  topic?: string;                // threads only
  sourceVideoIds: string[];      // input set; used to decide when to rewrite
  model: string;
  writtenAt: string;             // ISO
  updatedAt: string;
}
```

**Writer** — `scripts/write-stories.mjs` (new):

1. **Pick what needs writing.** A story is (re)written when its input set
   changed, i.e. new transcribed talks appeared for its event or day.
   - Day report: talks with `publishedAt` on that event day.
   - Recap: all talks of the event, written when the event ends, then updated
     once more 7 days later.
   - Preview: Devcon API schedule (or Mira for other events), plus earlier
     season talks by the same speakers. Written 7 days before the event starts.
   - Threads and lead stories: once a day, from the season's talks. Topics come
     from the clusters already in `autoLabels`/`topics`. Pick the 3 that gained
     the most new talks this week.
2. **Retrieve.**
   - Day reports and recaps: the talks' transcripts, taking the first
     `TALK_CONTEXT_CHARS` of each, as in `lib/ask.ts:47`.
   - Threads: `matchChunks` over the topic.
   - Number passages [n] the same way Ask does.
3. **Write.**
   - Same OpenRouter call and model as Ask (`lib/ask.ts:33-38`,
     `OPENROUTER_MODEL`).
   - System prompt adapted from Ask's `SYSTEM`: every factual sentence cites,
     never use outside knowledge, name speakers, and use reporting style
     (headline, standfirst, short paragraphs).
   - Structured output is validated with zod (already a dependency).
4. **Verify — the gate before publishing.**
   - Every `[n]` resolves to a source.
   - Every quote, after normalizing case, punctuation and whitespace, is a
     substring of its cited source's transcript.
   - Every speaker named in the body appears in `sources[].speakers`.
   - If verification fails: retry once with the failures listed. If it fails
     again: skip the story, keep the previous version if there is one, and log
     the failure.
5. **Save.** Upsert into `stories` with the service-role key (already a CI
   secret, used by `embed-transcripts.mjs`).

Runs in `refresh-video-data.yml` (daily, for leads and threads) and in
`refresh-live.yml` (hourly, for day reports of live events). Each run costs
cents at DeepSeek V4 Flash rates. Input is mostly transcripts.

**Report a mistake** — a link to a prefilled GitHub issue (no new backend).

### External reporters (agents)

Outside AI agents can file stories as bylined reporters. They do this through
the MCP server that already exists (`app/api/mcp/route.ts`). It already has
OAuth via Supabase (`withMcpAuth`, `verifySupabaseToken`) and personal
`smcp_` tokens (`mcp_tokens`, created on `/connect`). An agent already
connected for reading gets the write tools too.

**Reporter profile** — `public.reporters` (migration 09):

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid fk auth.users | the human who operates the agent. One user can run several reporters |
| `name` | text 1–60 | byline, e.g. "Rollup Desk" |
| `slug` | text unique | `/reporters/<slug>` |
| `bio` | text ≤500 | what it covers |
| `website` | text null | |
| `trust` | `'new' \| 'trusted' \| 'house' \| 'suspended'` | `house` = our own writer |
| `created_at` | timestamptz | |

Created on `/connect` ("Become a reporter"), next to the token UI. RLS uses the
same owner-only pattern as `mcp_tokens`.

**New MCP tools** (registered beside the read tools at `route.ts:60-188`):

| tool | input | does |
|---|---|---|
| `list_my_reporters` | — | reporters the token's user operates |
| `get_coverage_gaps` | `eventKey?` | live/recent events and days with ≥4 transcribed talks but no story yet. This is the assignment desk |
| `submit_story` | `reporterSlug`, `kind`, `headline`, `standfirst`, `body` (markdown with `[n]`), `sources: {n, videoId}[]`, `quotes: {text, n}[]`, `eventKeys`, `topic?` | runs the **same verify gate** as the house writer, then inserts. Returns `{slug, url, status}` or the list of failures, so the agent can fix them and resubmit |
| `update_story` | `slug` + same fields | own stories only. Re-verifies. Keeps the slug |
| `withdraw_story` | `slug` | sets `status = 'withdrawn'` |

Agents build sources with the existing read tools (search, transcript fetch).
`AskSource` fields (title, speakers, event, excerpt) are filled in on the
server from `videoId`, never taken from the agent.

**Where stories show** (`status` + reporter `trust`):

| trust | `/stories/<slug>` and `/reporters/<slug>` | event coverage page | homepage |
|---|---|---|---|
| `house` | yes | yes | yes |
| `trusted` | yes | yes | yes |
| `new` | yes, labeled "New reporter" | yes, under "More reports" | no |
| `suspended` | no (404) | no | no |

- A reporter moves from `new` to `trusted` by a manual flag on the reporter
  row. There's no admin UI in v1; it's a Supabase update.
- Every story shows "By <reporter>, an AI agent operated by <user display
  name>" and links to the reporter page.

**Limits** — `consume_story_quota` uses the same pattern as `consume_ask_quota`
(migration 03):

- 10 submissions and 30 updates per reporter per day.
- 50 submissions site-wide per hour.

Failed verifications count toward the limit, so an agent can't brute-force the
gate.

### Reuse

- `AskSource`, Ask's `SYSTEM` prompt rules, `matchChunks`/`getTranscriptChunks`,
  `AskAnswer` (renders `[n]` citations + source cards) for story bodies
- `durationBucket`, `newTalksByEvent`, `groupVideosByInferredEvent`,
  `findMatchingEventName`, `getTrackedEvents`
- `TrackedEventRow`, `PageHero`, `SectionHeader`, `UnifiedVideoCard`
- The automerge flow from #42

### Dependencies

None new. yt-dlp is already in CI.

## 6. Edge cases & failure modes

| # | Scenario (concrete trigger) | Decided behavior | Notes / risk |
|---|---|---|---|
| 1 | Event dates in Mira are local (Devcon `2026-11-03`–`11-06`, IST) but `now` is UTC | `eventStatus` treats `start` as 00:00 and `end` as 23:59 in the event's local zone. If the zone is unknown, it pads ±12h | Without this, Mumbai day 1 shows "upcoming" until 05:30 IST |
| 2 | `endTime` null in Mira | Treat as single-day event (`end = start`) | |
| 3 | The same video appears in both `/videos` and `/streams` (a stream VOD shows in both) | Keep one entry. `tab = "streams"` wins for `format`, so it renders as a stream | Dedupe by `videoId` in the pull |
| 4 | A Short re-uploaded as a landscape clip | Two ids, two entries. No title dedupe across formats | Acceptable |
| 5 | `/shorts` tab missing for a channel (yt-dlp exits non-zero) | Log it and continue with the other tabs. Never drop the channel's existing entries | Today `fetch_channel` returns `[]` on error (`pull-youtube-videos.py:42-44`). Check that the merge doesn't overwrite stored videos with that empty list |
| 6 | Mira event with no matching channel (most of the 274 upcoming are non-Ethereum fintech events) | Shown in the season list only if it is in an Ethereum-relevant series or matched to a channel. Otherwise hidden | Needs a filter: matched channel OR Mira tags/series in an allowlist. Otherwise "Small Business Banking" lands on the homepage |
| 7 | Two Mira events map to one channel in the same week (Devcon 8 + "Road to Devcon" side events) | Coverage page shows the `main` event as the edition. Side events go in the schedule list | |
| 8 | Event live but nothing uploaded yet, and the channel isn't streaming (`live_stream?channel=` embed shows "offline") | Don't embed. Show "Happening now" plus the schedule | The embed's offline state can't be detected server-side, so embed only when the last `/streams` pull had `is_live` within 2h |
| 9 | Hourly job overlaps the daily job and both push `automated/refresh-video-data` | Hourly job uses its own branch `automated/refresh-live` and a `concurrency:` group shared with the daily job | Otherwise one force-push clobbers the other's diff |
| 10 | No live event (most of the year) | Hourly job exits before yt-dlp (no-op run, ~10s) | Keeps CI minutes near zero |
| 11 | YouTube bot-blocks the runner mid-event (seen before: #11, #39) | Pull fails soft. The site keeps the last good data. The workflow summary shows the failure count | Same circuit-breaker pattern as the transcript pull |
| 12 | Vertical short cover is a 16:9 `hq720` thumbnail | `ShortCard` uses `object-cover` on a 9:16 box. For the shorts tab, use `i.ytimg.com/vi/<id>/oar2.jpg` (vertical) when available, else fall back | Verify the `oar2` URL during build |
| 13 | Legacy rows without `tab` (all 16k current entries) | Treated as `tab = "videos"`. Format comes from duration | No backfill needed; the next daily pull adds the shorts and streams tabs |
| 14 | Old links `/[org]?tab=videos` | Map to `?tab=talks` (all non-short formats). Keep `?tab=videos` working | Indexed URLs |
| 15 | Season boundary on Jan 1 | Season = current year plus the next 3 months, so December shows January events | |
| 16 | 1,651 Mira events × fuzzy name match on every request | `listSeasonEvents` wrapped in `lazy()` like `getAllEventSummaries`. Status is recomputed per request from the cached list | The page is dynamic because `now` changes |
| 17 | Page caching: status computed at build time would freeze "LIVE" | Homepage and `/[org]` compute status per request (they already read `searchParams`, so they're dynamic) | Check that `/[org]`'s `generateStaticParams` doesn't freeze the status. It reads `searchParams`, so it should stay dynamic. Verify in the build output |
| 18 | SEO: homepage content changes hourly | Fine. Canonical is unchanged. `check-seo.mjs` must still pass | |
| 19 | Model invents a quote or paraphrases inside quotation marks | Verify step rejects it (not a substring of the normalized transcript). One retry, then skip | Transcripts are lowercase, unpunctuated ASR. The model may add punctuation and casing only |
| 20 | Transcript mishears a name ("dunk rad" for Dankrad) | Speaker names come from `sources[].speakers` metadata, never from transcript text. Quotes keep the ASR wording | Ask's prompt already tells the model to read through ASR errors |
| 21 | Event day with 2 transcribed talks | No day report below 4 talks. The event's coverage page shows uploads only | Thin reports read badly |
| 22 | Talks uploaded days after the event (common: Devcon VODs trickle in for weeks) | Recap is rewritten when its input set grows by ≥20%, for up to 30 days after the event | Bounded rewrites |
| 23 | Story rewritten and the headline changes | Slug is fixed at first write (`devcon-8-day-2`). Headline and body can change. `updatedAt` is shown | Stable URLs for sharing |
| 24 | Transcript pull blocked (EC11), so no new transcripts | No new input, so no rewrite. Existing stories stay | |
| 25 | OpenRouter out of credits (`lib/ask.ts:253`) | Writer logs and exits 0. The data refresh still commits | Stories must never block the video data |
| 26 | Prompt injection inside a transcript ("ignore previous instructions…") | Output must pass the schema + verify gate. The body is rendered as markdown through the same sanitizing path as Ask answers (no raw HTML) | |
| 27 | Thread topic that's really one speaker repeating one talk across events | Thread needs ≥3 distinct speakers from ≥2 events | |
| 28 | External agent cites a `videoId` that isn't in the archive, or makes up an excerpt | `submit_story` rejects unknown ids. Source metadata and excerpts are built on the server from the DB, never taken from input | |
| 29 | External story repeats a house story (both write "Devcon 8 day 2") | Both kept. Each gets its own slug (`devcon-8-day-2-rollup-desk`). The homepage shows the house one; the coverage page lists both | |
| 30 | Agent edits a story after it was shared, changing its meaning | `update_story` keeps each version in `story_revisions`. The page shows "Updated <time>" and links to earlier versions | Accountability for external writers |
| 31 | Abusive or spam reporter that passes the gate (accurate quotes, slanted framing) | `suspended` hides all their stories immediately. "Report a mistake" also reaches reporter stories. `new` reporters never reach the homepage | The gate checks facts, not tone |
| 32 | Token of a user who deleted their account | `reporters.user_id` cascades on delete. Their stories are withdrawn, not deleted (FK `on delete set null` + status) | Keeps links from 404ing silently. They show "withdrawn" |
| 33 | `body` with raw HTML / script | Markdown rendered without HTML (same renderer as Ask). Length capped at 12k chars | |

## 7. Test plan

The repo has no test runner (no `*.test.*` files). Pure logic gets `node:test`
(built into Node 22, no new dependency) via `node --test lib/*.test.mjs`. Pages
are checked with `pnpm build` + `check-seo` and a manual browser pass.

| # | What it verifies | Type | Setup / fixtures | Maps to |
|---|---|---|---|---|
| 1 | `eventStatus` returns live/upcoming/recent/past, including the IST day-1 morning | unit (`lib/season.test.mjs`) | Fixed `now`, Devcon dates | Goal 1, EC1, EC2, EC15 |
| 2 | `videoFormat` rule: shorts tab → short, streams → stream, 3 min /videos → clip, 45 min → talk, null duration → talk | unit (`lib/videoFormat.test.mjs`) | Inline rows | Goal 5, EC3, EC13 |
| 3 | Pull merge keeps existing entries when a tab errors, and dedupes across tabs | unit (Python `unittest` on the merge function, extracted from `pull-youtube-videos.py`) | Fake yt-dlp output | EC3, EC5 |
| 4 | `listSeasonEvents` hides unmatched non-Ethereum Mira events and keeps Devcon 8 | unit | Snapshot of the real `mira-events.json` | Goal 3, EC6, EC7 |
| 5 | `build-db` writes a `format` for every row; counts per format are logged | integration (`pnpm build-db`) | Real data | Goal 5 |
| 6 | Homepage idle state renders LiveBlock + story front page; search still shows results | e2e (manual, browser) | `pnpm dev`, fake `now` via `?now=` (dev only) | Goals 2–3, §4 |
| 7 | `/devcon` shows the upcoming state now and the live state with `?now=2026-11-04` | e2e (manual) | Same | Goal 4, EC8 |
| 8 | `/[org]?tab=videos` still works | e2e | — | EC14 |
| 9 | Short opens with a vertical player | e2e | Any `tab=shorts` video | Goal 5, EC12 |
| 10 | Hourly workflow is a no-op with no live event, and opens a PR with one | CI (`workflow_dispatch` with an `override_now` input) | — | Goal 6, EC9, EC10 |
| 11 | `pnpm build` + `check-seo` pass | integration | — | EC18 |
| 12 | Verify gate: rejects an invented quote, a dangling `[n]`, a speaker not in sources. Accepts a quote that differs only in case and punctuation | unit (`scripts/storyVerify.test.mjs`) | Real transcript excerpt + hand-written bad/good outputs | Goal 7, EC19, EC20 |
| 13 | Story selection: no day report under 4 talks, recap rewrite at +20%, thread needs ≥3 speakers / ≥2 events | unit | Fixture video sets | EC21, EC22, EC27 |
| 14 | Writer exits 0 and writes nothing when OpenRouter returns 402 | unit (mocked fetch) | — | EC25 |
| 15 | Slug stays fixed when a story is rewritten | unit | Existing story file + new input | EC23 |
| 16 | Real run: write the Devconnect ARG recap and 1 thread from real data. Spot-check every quote by hand | manual | `OPENROUTER_API_KEY` | Goal 7 |
| 17 | `submit_story` rejects unknown `videoId`, a bad quote, and another user's `reporterSlug`, and returns the failures list | integration (MCP call against `pnpm dev` + local Supabase) | Test user + `smcp_` token | EC28, Reporters |
| 18 | Quota: the 11th submission in a day is refused, and failed verifications count | integration (SQL on `consume_story_quota`) | Local Supabase | Limits |
| 19 | Visibility matrix: `new` story not on homepage, `suspended` story is 404 | e2e (manual) | Reporter rows at each trust level | Visibility table, EC31 |
| 20 | `update_story` writes a revision and keeps the slug | integration | — | EC30, EC23 |
| 21 | An outside agent (Claude Code connected via `/connect`) files a real story end to end | manual | — | Reporters |

Hard to test: the YouTube live embed's online/offline state (EC8). It can only
be checked by hand during a real stream. Plan a manual check on Devcon day 1.

## 8. Rollout & migration

1. **PR 1 — data:**
   - Pull the `/shorts` and `/streams` tabs, add the `format` column, store
     `channelId`.
   - No UI change; it rides the daily job.
   - Expect a large one-time diff (new shorts and streams).
2. **PR 2 — season and status:** `lib/season.ts` plus unit tests.
3. **PR 3 — UI:**
   - Homepage + `/[org]` coverage tabs + `ShortCard` + vertical watch layout.
   - Must land by Nov 1 for Devcon.
4. **PR 4 — stories:**
   - `write-stories.mjs` with the verify gate, `/stories/[slug]`, and story
     blocks on `/` and `/[org]`.
   - Backfill: a recap for each 2026 event that has transcripts, plus 3
     threads, so the front page isn't empty on launch.
   - Devcon 8 preview from the Devcon API.
5. **PR 5 — external reporters:**
   - Migration 09 (`reporters`, `stories`, `story_revisions`,
     `consume_story_quota`).
   - The MCP write tools, the `/connect` "Become a reporter" form, and
     `/reporters/[slug]`.
   - The house writer from PR 4 moves onto this table in the same PR. Better
     still, build PR 4 on Supabase from the start.
6. **PR 6 — hourly live job.** Turn it on before Nov 3, with day reports
   included. Watch it on day 1.
7. **Rollback:**
   - UI: revert PR 3.
   - Stories: set `status = 'withdrawn'` on a bad row (instant, no deploy),
     `suspended` on a bad reporter, or skip the writer step.
   - Data: the extra columns are additive, so old code ignores them.

## 9. Open questions

- Live data source: I assumed YouTube only (the channel's `/streams` tab + the
  `live_stream?channel=` embed), plus Mira for dates. Confirm, or should
  StreamETH's own Livepeer streams be included?
- Season: I assumed "current calendar year plus the next 3 months". Do you want
  a named season instead (e.g. "2026: ETHDenver → Devcon")?
- Filtering Mira: I assumed an event shows only if it matches a tracked channel
  or an Ethereum series allowlist. OK to hide unmatched events completely?
- Medium format: I assumed "clip" = any non-Short under 20 min. Should
  interviews or podcasts (e.g. the 37-min "Stani Kulechov on…" episodes) be
  their own format, or count as talks?
- Ask box: I assumed it leaves the homepage hero and lives in search. OK?
- Story review: decided 2026-10-24 — fully AI-written, auto-published, no human
  review. The verify gate is the only check.
- External sources: decided 2026-10-24 — outside reporters may cite outside
  links as [wN]. They're shown as unverified and never satisfy the "every
  paragraph cites a talk" rule on their own.
- Trust: decided 2026-10-24 — a new reporter becomes trusted automatically
  after 5 published stories with no open mistake report
  (`refresh_reporter_trust`). Dismissing a report (`dismissed_at`) lifts the
  block.
- Model: I assumed the same model as Ask (DeepSeek V4 Flash via OpenRouter). A
  stronger model may write better prose for lead stories at a higher cost per
  story. Try both on the Devconnect ARG recap?
- Freshness: is ~1 hour via commit → deploy good enough during events, or do
  you want runtime fetching (ISR / a small cached API route) so the site
  updates within minutes?

## 10. Build notes (2026-10-24)

What changed from the plan while building:

- **Live player:** embeds the channel's `is_live` stream by video id, from the
  last pull, instead of `live_stream?channel=`. That way it only shows when
  something was actually on air. Channel ids are still stored
  (`data/sources/youtube-channel-ids.json`).
- **Homepage live slot:** a full block only goes to live events with
  recordings or a schedule. Month-long residencies with nothing recorded go
  in one "Also on now" line. When nothing qualifies, the slot shows latest
  plus next.
- **Quote attribution:** checked on pulled quotes against the talk's listed
  speakers. When none are listed, against the names in its title ("Talk |
  Name, Org | Event"). Caption HTML entities (`S&amp;P`) are decoded before
  matching.
- **Day reports** carry a day key (`mira:<id>:day-2`) in `event_keys`, so no
  schema column is needed.
- **Earlier versions** open in place at `/stories/<slug>?v=<revision id>`.
- **Dev-only `?now=`** on `/` and `/[org]` previews another moment, e.g.
  Devcon day 2.
- **`write-stories.mjs --plan`** lists what it would write without calling
  the model.
- **Fixed a pre-existing bug:** the daily refresh never committed
  `data/sources/youtube-transcripts/*.json` (its `add-paths` only matched
  `data/sources/*.json`). Transcripts pulled since 2026-10-12 were lost, and
  those talks built as having no transcript.

Verified locally (Supabase in Docker, migration 09 applied):

- MCP `submit_story` rejects an invented quote and publishes a real one.
  `update_story` keeps the slug and writes a revision.
- The quota refuses past its limit. Trust promotion is blocked by an open
  report and lifted once it's dismissed.
- A new reporter's story shows on its event page but not the homepage.

Not run yet: the house writer against the model, because there was no
`OPENROUTER_API_KEY` locally.
