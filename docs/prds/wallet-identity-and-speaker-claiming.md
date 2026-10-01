# PRD: Wallet identity, paid comments, attestations & speaker claiming

> **Status:** Draft · **Author:** Pablo Voorvaart · **Date:** 2026-09-29 · **Slug:** `wallet-identity-and-speaker-claiming`

## 1. Summary

Replace email sign-in with Ethereum wallet sign-in (mainnet). Signed-in users can
comment on talks. Each comment costs 0.0001 ETH, paid in advance by buying comment
credits with one mainnet transfer to the StreamETH treasury, which keeps spam down.
Viewers get an offchain-signed "I watched this talk" attestation (EAS, mainnet
domain) that they can publish onchain themselves. Speakers can claim their
auto-generated `/speakers/[speaker]` page, verify who they are, edit their bio,
pin talks, and their comments on their own talks carry a "Speaker" badge. There is
no tipping.

Order: wallet sign-in (phase 1), claiming (phase 2), comments and credits (phase 3), attestations (phase 4).

## 2. Problem & motivation

- Speaker pages are derived only from session data (`lib/people.ts:28-86`). Nobody
  owns them. Bios are whatever the first session had (`lib/people.ts:50`), and a
  speaker can't correct them.
- A talk has no discussion, and viewers have no way to reach its speaker.
- Free comments on a public archive attract spam. A small onchain cost is a spam
  filter that fits an Ethereum audience, and it needs no captcha or moderation queue.
- The audience is Ethereum-native, but the only sign-in is an email magic link
  (`components/SignInForm.tsx:17`).
- Viewers have no persistent record of what they've watched.

## 3. Goals & non-goals

**Goals**

1. A user signs in with an injected wallet (EIP-4361 / SIWE). This is the **only**
   sign-in method: email magic links are removed.
2. One account = one wallet address, and the address is the user's identity.
3. A user buys comment credits with one ETH transfer on mainnet to
   `COMMENT_TREASURY_ADDRESS`. The server credits the account only after checking
   the receipt. 1 credit = 1 comment = 0.0001 ETH (`COMMENT_PRICE_WEI`).
4. A user with credits can post a comment, or a one-level reply, on any
   `/watch/[id]` page. Each post spends exactly one credit, atomically.
5. A speaker can claim a speaker page, either through X (Twitter) OAuth that matches
   the handle on record or through a manual review.
6. A verified speaker can edit their bio, company and photo URL and pin up to 3
   talks, and the changes appear within 60 seconds. On talks they're a speaker on,
   their comments carry a "Speaker" badge. They pay for comments like everyone else.
7. A viewer who plays at least 80% of a talk gets a "Watched" attestation signed
   offchain by the StreamETH attester key. They can optionally publish it onchain on
   mainnet and pay the gas themselves.

**Non-goals**

- Tipping or paying speakers, or splitting revenue.
- Refunds of credits (for deleted, hidden or unused comments).
- Any chain other than mainnet, and any token other than ETH.
- Replies nested more than one level, reactions, votes, editing a posted comment,
  or timestamped comments.
- Email sign-in, email accounts, or linking several wallets to one account.
- Automatically merging speakers who share a name or appear under several spellings.
- Tamper-proof watch verification. A "Watched" attestation means StreamETH saw the
  client report 80% playback. It is not proof.
- Claiming YouTube channels or organizations.

## 4. User-facing behavior

**Wallet sign-in** (`/signin`)
- `SignInForm` is replaced by a single "Connect wallet" button. The email form and
  `app/auth/callback/route.ts` (the magic-link exchange) are deleted.
- Flow: detect an injected provider through EIP-6963 → connect → sign the SIWE
  message (chain ID 1) → Supabase session → redirect to `next`.
- States: no wallet found (link to install one), the user rejected the signature
  (inline "Signature cancelled"), and a generic error.

**Account menu** (`AuthStatus`)
- Shows the ENS name (resolved on mainnet), or else the shortened address, plus the
  credit balance ("12 comments"). Adds a "Settings" link.
- `/settings` shows the address, credit balance and purchase history, claimed
  speaker pages, and attestations, with a "Publish onchain" action on each.

**Buying credits** (from the comment box or from `/settings`)
- Packs: 10 comments (0.001 ETH), 50 (0.005 ETH), 100 (0.01 ETH). The modal shows
  the pack price plus an estimated gas cost from `estimateGas` × the current fee.
- The wallet switches to mainnet if needed. The user sends one plain ETH transfer
  to the treasury, and the UI shows "Confirming…" until there are 2 confirmations,
  then "+50 comments".
- A pending tx hash is saved in `localStorage` and checked again after a reload.

**Comments** (`/watch/[id]`, below the speakers section)
- The list is newest first, with replies indented under their parent. Each comment
  shows the ENS name or short address, a relative time and the text. Verified
  speakers of this talk get a "Speaker" badge.
- Signed out: the list is readable and the box says "Connect wallet to comment".
- Signed in with 0 credits: the box is visible, and "Post" becomes "Buy credits to post".
- Signed in with credits: "Post · 1 credit". After posting, the comment appears
  immediately and the balance goes down.
- The author can delete their own comment (it shows as "[deleted]" if it has
  replies). Admins can hide a comment. Neither refunds the credit.

**Claiming a page** (`/speakers/[speaker]`)
- Unclaimed page: an "Is this you? Claim this page" link goes to `/speakers/[speaker]/claim`.
  - The speaker has a `twitter` handle on record (464 of 2,233 speakers) → "Verify
    with X". This runs Supabase `linkIdentity({ provider: 'x' })`. If the handle
    matches, the claim is instantly `verified`.
  - Otherwise, or if the handles don't match → a request form with a free-text
    proof field. The claim is saved as `pending` and an admin reviews it at `/admin/claims`.
- Claimed page: a "Verified" badge, the speaker's overrides replace the derived
  fields, and pinned talks show first. The owner sees an "Edit page" link.

**Watched attestation** (`/watch/[id]`)
- The players report unique seconds played. At 80%,
  `POST /api/attestations/watched` is called and a "Watched ✓" chip appears next to `SaveButton`.
- Signed out: nothing is tracked or shown.

## 5. Technical design

**Reference features**
- Auth and session: `lib/supabase/{client,server,middleware}.ts`, `proxy.ts`.
- Per-user rows with RLS, and the client component that toggles them: `saved_videos`, `components/SaveButton.tsx`.
- Signed-in-only page: `app/saved/page.tsx`.
- Action buttons: `components/ActionButton.tsx` (`actionButtonClass`).
- The watch page section layout: `app/watch/[id]/page.tsx` (the speakers grid at `:143`).

**Speaker identity key (critical).** Speakers have no stable ID. `lib/people.ts:36`
groups them by `name.trim().toLowerCase()`. Slugs get a `-2`, `-3` suffix in
iteration order (`lib/people.ts:60-69`), so a slug can change after `pnpm export-db`.
All claim data is keyed by **`speaker_key` = the lowercase name**. Export
`speakerKey(name)` from `lib/people.ts` and use it in both places.

**Data model** (one migration per phase, under `supabase/migrations/`)

```sql
-- phase 2
create table public.admins (user_id uuid primary key references auth.users(id));

create table public.speaker_claims (
  id uuid primary key default gen_random_uuid(),
  speaker_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('x_oauth','manual')),
  status text not null check (status in ('pending','verified','rejected','revoked')),
  evidence text check (char_length(evidence) <= 2000),
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index speaker_claims_one_verified
  on public.speaker_claims (speaker_key) where status = 'verified';
create unique index speaker_claims_one_open_per_user
  on public.speaker_claims (speaker_key, user_id) where status = 'pending';

create table public.speaker_profiles (
  speaker_key text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  bio text check (char_length(bio) <= 2000),
  company text check (char_length(company) <= 120),
  photo_url text check (photo_url ~ '^https://' and char_length(photo_url) <= 2048),
  pinned_video_ids text[] not null default '{}' check (cardinality(pinned_video_ids) <= 3),
  updated_at timestamptz not null default now()
);

-- phase 3
create table public.credit_purchases (
  tx_hash text primary key check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_address text not null,
  value_wei numeric not null check (value_wei > 0),
  credits int not null check (credits > 0),
  block_number bigint not null,
  created_at timestamptz not null default now()
);

create table public.comment_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance int not null default 0 check (balance >= 0)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id text not null,                  -- same id space as saved_videos.video_id
  parent_id uuid references public.comments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  author_address text not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  is_speaker boolean not null default false,
  status text not null default 'visible' check (status in ('visible','deleted','hidden')),
  created_at timestamptz not null default now()
);
create index comments_video_created on public.comments (video_id, created_at desc);

-- phase 4
create table public.watch_attestations (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  recipient text not null,
  uid text not null,
  payload jsonb not null,
  onchain_tx text,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
```

**Spending a credit atomically.** Comments are posted through a
`security definer` Postgres function `post_comment(p_video_id, p_parent_id, p_body, p_is_speaker)`,
called by the route handler with the user's session. In one transaction it:
1. Runs `update comment_credits set balance = balance - 1 where user_id = auth.uid() and balance > 0`
   and raises `insufficient_credits` if no row was updated. Every comment is paid,
   speakers included.
2. Inserts the comment. `p_is_speaker` only sets the badge, and the route handler
   passes true only after checking the caller's verified claim against the video's speakers.

The `balance > 0` guard in the same statement means two posts sent at once can't
both spend the last credit.

**RLS**
- `comments` (only rows where `status = 'visible'`, plus deleted-with-replies
  placeholders through a view), `speaker_profiles` and `speaker_claims` where
  `status = 'verified'`: anyone can select.
- `comment_credits`, `credit_purchases`, `watch_attestations`, and the owner's own
  claims: the owner can select.
- Every insert and update goes through route handlers (using the service role) or
  `post_comment`. The browser can't write any of these tables directly, unlike
  `saved_videos`.

**Contracts** (route handlers in `app/api/**/route.ts`; read the route-handler guide
in `node_modules/next/dist/docs/` first)

| Endpoint | Body | Server check | Result |
|---|---|---|---|
| `POST /api/credits/purchase` | `{ txHash }` | mainnet receipt `status=success`, ≥ 2 confirmations; `tx.from == getUserAddress(user)`; `tx.to == COMMENT_TREASURY_ADDRESS`; `tx.value >= COMMENT_PRICE_WEI` | purchase row + `balance += floor(value / price)` in one transaction; `202` if pending |
| `GET /api/comments?videoId=` | – | video exists | visible comments + replies, capped at 200 |
| `POST /api/comments` | `{ videoId, parentId?, body }` | session; video exists; parent has the same `video_id` and no parent itself; rate limit | `post_comment` → 201, or 402 `insufficient_credits` |
| `DELETE /api/comments/[id]` | – | author or admin | author sets `deleted`, admin sets `hidden` |
| `POST /api/speakers/[key]/claim` | `{ method, evidence? }` | `x_oauth`: X identity `user_name` equals the stored `twitter` (case-insensitive, without `@`) | claim row |
| `PATCH /api/speakers/[key]/profile` | profile fields | caller has the verified claim | upsert, then `revalidatePath` |
| `POST /api/admin/claims/[id]` | `{ decision }` | caller is in `admins` | status change |
| `POST /api/attestations/watched` | `{ videoId, secondsWatched }` | session, video exists, `secondsWatched >= 0.8 * duration` | EAS offchain attestation |
| `POST /api/attestations/[videoId]/onchain` | `{ txHash }` | mainnet receipt has an `Attested` event from the EAS contract with a matching `refUID` | `onchain_tx` set |

**Auth.** Wallet sign-in uses Supabase's native Web3 auth,
`supabase.auth.signInWithWeb3({ chain: 'ethereum' })`, enabled in the dashboard (it
goes next to `[auth.web3.solana]` in `supabase/config.toml:322`). Cookies, the
session and the refresh in `proxy.ts` stay unchanged. `lib/userAddress.ts` exports
`getUserAddress(user)`, which reads the lowercased address from the web3 identity
(confirm the exact field in `user.identities[].identity_data` after `pnpm install`).
Server code never trusts an address sent from the client. Turn off the Email
provider in the Supabase dashboard.

**Why `tx.from` must equal the sign-in address.** Transactions are public. Without
this check, anyone could send someone else's purchase tx hash first and take the credits.

**Attestations** (EAS on mainnet: EAS `0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587`,
SchemaRegistry `0xA7b39296258348C78294F95B872b282326A97BDF`; check both on
etherscan before use)
- Schema: `string videoId, string title, string[] speakerKeys, uint64 watchedAt`,
  registered once through `scripts/register-eas-schema.mjs`.
- The server signs offchain attestations (EIP-712, chainId 1) with
  `EAS_ATTESTER_PRIVATE_KEY`. That key has no funds and only signs.
- To publish onchain, the user calls `EAS.attest` with `refUID` set to the offchain
  UID. Mainnet gas makes this a few dollars, so it's opt-in and clearly labeled.

**Speaker page overlay.** `app/speakers/[speaker]/page.tsx` stays static. It reads
`speaker_profiles` through `lib/speakerProfiles.ts`, and edits call
`revalidatePath`. Check the Next 16 caching docs before choosing `revalidate` or tags.

**Comments UI.** `components/Comments.tsx` is a client component that follows
`SaveButton`'s auth subscription pattern. It renders the list from
`GET /api/comments`, which keeps the watch page static.
`components/BuyCreditsModal.tsx` handles the purchase flow.

**Watch tracking.** `lib/useWatchProgress.ts` merges played ranges, so seeking
ahead isn't counted. `SessionPlayer` (`timeupdate`) and `YoutubeSessionPlayer`
(Plyr) feed it, and so does Listen mode through `PodcastPlayerProvider`.

**Dependencies and env**
- Add `viem`: receipts, ENS lookups, EIP-712 signing and client transfers. No wagmi
  (EIP-6963 plus `createWalletClient(custom(provider))`), and no EAS SDK (it pulls in ethers v6).
- Env: `SUPABASE_SERVICE_ROLE_KEY`, `ETH_RPC_URL`, `COMMENT_TREASURY_ADDRESS`,
  `COMMENT_PRICE_WEI=100000000000000`, `EAS_ATTESTER_PRIVATE_KEY`, `EAS_SCHEMA_UID`.

## 6. Edge cases & failure modes

| # | Scenario | Decided behavior |
|---|---|---|
| 1 | A wallet-only user has no email, so `AuthStatus.tsx:18` stores `null` and shows "Sign in" | Switch on `user` rather than `email`. Show ENS, or else the short address. |
| 2 | Someone posts another user's purchase tx hash first | `tx.from` ≠ caller's address → 403. |
| 3 | The same tx hash is posted twice (double-click, retry, two tabs) | `tx_hash` is the primary key. The insert and the balance change run in one transaction, and the conflict returns the existing result without crediting twice. |
| 4 | The tx is pending, or has fewer than 2 confirmations | 202 `{ pending: true }`. The client retries every 12 seconds and after a reload using the hash in `localStorage`. |
| 5 | A reorg drops the tx after it was credited | Very unlikely at 2 confirmations. Accepted risk, since at most 0.01 ETH per purchase is exposed. |
| 6 | The tx reverted, went to the wrong address, or was sent on another chain | The receipt check fails (on another chain, mainnet simply has no receipt) → 422, with a message naming the exact problem. |
| 7 | The user sends a non-pack amount, or less than one credit's worth | Credited `floor(value / price)`, and any remainder isn't refunded. Less than one credit → 422, recorded, with a note to contact support. The UI only offers packs. |
| 8 | Funds arrive through a contract wallet or a smart account (Safe, 4337) | `tx.from` is the bundler or relayer, not the user → rejected. v1 supports EOAs only, and the modal says so. |
| 9 | The user posts from two tabs with 1 credit left | The `balance > 0` guard in the same statement lets exactly one succeed. The other gets 402. |
| 10 | Posting fails after the credit is spent | Impossible: the spend and the insert run in one transaction. |
| 11 | A reply to a reply, or to a comment on a different video | 422 (one level only, and the parent must be on the same video). |
| 12 | Empty, whitespace-only or 2,001-character body | 400, enforced by the database `check` and in the UI. |
| 13 | The body contains HTML, script or markdown | Rendered as plain text with `whitespace-pre-line`. Links are auto-linked with `rel="nofollow ugc noopener"`, never through `dangerouslySetInnerHTML`. |
| 14 | A spammer with money floods a talk | The fee already makes this costly. Add a limit of 10 comments per user per minute (429) and admin hide. Hidden comments don't refund. |
| 15 | A verified speaker comments on a talk they're not a speaker on | No badge. (Every comment is paid either way.) |
| 16 | A speaker's claim is revoked after they commented | Comments stay, but `is_speaker` is cleared so the badge goes away. |
| 17 | Deleting a comment that has replies | It shows as "[deleted]" and the replies stay. With no replies it disappears. No refund. |
| 18 | The user deletes their account | Credits and purchases cascade away. Comments keep `author_address` with `user_id` set to null. |
| 19 | Mainnet RPC is down or rate-limited | Purchase and onchain endpoints return 503, and the client retries with the saved hash. Commenting with existing credits still works. ENS falls back to the short address. |
| 20 | Wallet is on another network while buying | The UI calls `wallet_switchEthereumChain` to chain ID 1. If the user refuses, the UI says "Switch to Ethereum mainnet" and sends nothing. |
| 21 | Gas costs more than the pack | The modal shows the gas estimate next to the price. Packs are big enough that gas is paid once for many comments. |
| 22 | Two people share a speaker name | The first verified claim wins, and the other disputes it through manual review. |
| 23 | Two users claim at the same moment | The partial unique index rejects the second → 409. |
| 24 | Slug changes after `pnpm export-db` | No effect, because data is keyed by `speaker_key`. |
| 25 | `pnpm export-db` removes or renames a speaker | The profile has no page. The admin page lists claims whose key isn't in `listSpeakers()`. |
| 26 | Video removed from the catalog while it has comments | Comments stay in the database but aren't shown. `GET /api/comments` returns 404 for unknown videos. |
| 27 | The user loses their wallet | The account and its credits are gone, with no recovery in v1. Speakers re-claim through manual review. |
| 28 | A SIWE message is replayed or signed for another domain | Supabase rejects it (timestamp window, domain checked against allowed redirect URLs). |
| 29 | Someone fakes `secondsWatched` | Accepted limit. Cap at 30 per user per day, and the claimed seconds can't exceed the wall-clock time since a server nonce was issued at page load. |
| 30 | Video has no known duration | No attestation is offered. |
| 31 | The attester key leaks | Rotate it (new key, re-register the schema). It holds no funds, so nothing can be stolen. |
| 32 | Existing email accounts with `saved_videos` rows | Locked out once Email is off. Count them before phase 1. |
| 33 | No injected wallet, or several (EIP-6963) | None: link to a wallet install page. Several: show a picker. Mobile without a wallet browser is out of scope for v1. |
| 34 | The user rejects the signature or the tx | Inline "Cancelled" message and the button re-enables. Not logged as an error. |
| 35 | Silent failures (a failed receipt check, a failed OAuth match, `insufficient_credits` spikes) | Logged server-side with the reason. The admin page shows rejected purchases and pending claims. |

## 7. Test plan

The repo has **no test framework**. Add `vitest` for unit and route tests, and
`@playwright/test` for e2e with an injected EIP-1193 mock provider. Use
`anvil --fork-url $ETH_RPC_URL` for mainnet receipts and `supabase start` for the database.

| # | What it verifies | Type | Setup | Maps to |
|---|---|---|---|---|
| 1 | `speakerKey()` matches the grouping in `lib/people.ts`, and keys stay stable when slugs change | unit | fixture sessions | §5, EC24 |
| 2 | Wallet sign-in creates a session, the header shows the address and balance, and `/signin` has no email form | e2e | mock provider | G1, EC1 |
| 3 | `getUserAddress` returns the lowercased address, and endpoints ignore addresses in the body | unit + integration | fixture user | G2 |
| 4 | Purchase: valid tx credits `floor(value/price)`, and a repeat hash credits once | integration | anvil fork, send tx to treasury | G3, EC3, EC7 |
| 5 | Purchase: another user's tx → 403; revert, wrong recipient or underpay → 422; pending → 202 | integration | anvil fork | EC2, EC4, EC6, EC7 |
| 6 | Tx from a contract wallet → rejected | integration | anvil + deployed forwarder | EC8 |
| 7 | `post_comment`: spends 1 credit, returns 402 at 0, parallel posts with 1 credit give exactly one success | integration | local Supabase, `Promise.all` | G4, EC9, EC10 |
| 8 | Comment validation: empty, too long, nested reply, parent on another video | integration | – | EC11, EC12 |
| 9 | Comment body with `<script>` and a link renders as text with a nofollow link | e2e | seeded comment | EC13 |
| 10 | Rate limit: the 11th comment in a minute → 429 | integration | – | EC14 |
| 11 | Verified speaker comment on their own talk spends a credit and is badged; on another talk there's no badge | integration | seeded claim | G6, EC15 |
| 12 | Claim revoked → badge removed from that speaker's comments | integration | seeded | EC16 |
| 13 | Delete with replies → "[deleted]"; admin hide → gone; balance unchanged | integration | seeded | EC17 |
| 14 | RLS: anon reads visible comments and profiles, can't read balances, can't write any table | integration | anon client | §5 RLS |
| 15 | Account deletion cascades credits and nulls `comments.user_id` | integration | local Supabase | EC18 |
| 16 | X claim verified on a handle match (case, `@`), otherwise manual; concurrent claims give exactly one verified | integration | stubbed identities | G5, EC23 |
| 17 | Profile PATCH: non-owner 403, bad pin 422, oversized bio 400; edit appears after revalidation | integration + e2e | seeded claim | G6 |
| 18 | Watch-progress hook: seeking ahead doesn't count, fires once at 80% | unit | fake time events | G7, EC29 |
| 19 | Watched endpoint idempotent, rejects zero duration, rate-limited; attestation verifies against the EAS mainnet domain | unit + integration | fixed key | G7, EC30 |
| 20 | Onchain publish with matching `refUID` accepted, mismatch → 422 | integration | anvil fork | G7 |
| 21 | Buy modal: switches to mainnet, handles refusal, rejected tx re-enables the button | e2e | mock provider | EC20, EC34 |

Hard to test: real X OAuth (stub it), real wallets across MetaMask, Rabby and
Coinbase (manual QA checklist), real mainnet gas numbers (assert that the estimate is
shown, not its value), and the revalidation timing (assert on the call).

## 8. Rollout & migration

1. **Phase 1, wallet sign-in.** Count email accounts (EC32). Enable Web3 Ethereum
   auth and add the production domain to the allowed redirect URLs. Replace
   `SignInForm`, delete `app/auth/callback/route.ts`, fix `AuthStatus`, add
   `lib/userAddress.ts` and `/settings`. Turn off the Email provider after deploying.
2. **Phase 2, claiming.** Admins, claims, profiles, the X OAuth provider (with manual
   identity linking enabled), and the claim, edit and admin pages.
3. **Phase 3, comments and credits.** Set up the treasury address (a Safe is
   recommended, since it only receives). Set `COMMENT_PRICE_WEI` and `ETH_RPC_URL`.
   Add the purchase endpoint, `post_comment`, and the comments UI.
4. **Phase 4, attestations.** Register the schema from a funded deployer and set the
   attester key.
- Each phase is its own migration and PR. Rolling back means hiding the UI; the tables stay.
- Seed `admins` with Pablo's user id by hand.
- Update the README "Accounts" section with the env vars and Supabase dashboard steps.

## 9. Open questions

- Packs of 10, 50 and 100: OK, or should there be a single "top up any amount"?
- Contract wallets (Safe, smart accounts) can't buy credits in v1. Acceptable?
- I assumed **X OAuth and manual review** are the only ways to verify. Confirm.
- `signInWithWeb3` for Ethereum hasn't been checked against the installed
  `@supabase/supabase-js@^2.112` (no `node_modules` in this worktree).
- Should speaker profile edits sync back to the production StreamETH Mongo?
