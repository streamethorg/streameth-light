-- Media reporters add to an event's feed by link: a YouTube video, an X
-- post, a Spotify episode, any web page. Nothing is downloaded — the feed
-- embeds the provider's own player, or shows a link card for other sites.
-- Filed under a reporter byline, like stories (migration 09).
--
-- Only the server writes this table, with the service-role key, after it has
-- checked the user runs the reporter and is on the reporter list.

create table if not exists public.event_embeds (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.reporters (id) on delete cascade,
  -- Who added it; kept when the account goes so the embed stays credited
  -- to its reporter.
  user_id uuid references auth.users (id) on delete set null,
  -- A season event key (lib/season.ts): "mira:…", "streameth:…", "youtube:…".
  event_key text not null check (char_length(event_key) between 1 and 300),
  -- A provider in lib/embedCore.mjs, or "link" for a plain link card.
  provider text not null check (provider ~ '^[a-z]{1,20}$'),
  -- The provider's id for the item (YouTube video id, X status id, …);
  -- null for link cards.
  external_id text check (external_id is null or char_length(external_id) <= 200),
  url text not null check (url ~ '^https://' and char_length(url) <= 2000),
  -- e.g. "short" for a YouTube Short, "episode" for Spotify.
  variant text check (variant is null or char_length(variant) <= 20),
  title text not null default '' check (char_length(title) <= 300),
  description text not null default '' check (char_length(description) <= 1000),
  author_name text check (author_name is null or char_length(author_name) <= 200),
  author_url text check (author_url is null or (author_url ~ '^https://' and char_length(author_url) <= 2000)),
  site_name text check (site_name is null or char_length(site_name) <= 200),
  image_url text check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 2000)),
  note text not null default '' check (char_length(note) <= 280),
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists event_embeds_unique_url
  on public.event_embeds (event_key, url) where removed_at is null;
create index if not exists event_embeds_event_idx
  on public.event_embeds (event_key, created_at desc) where removed_at is null;
create index if not exists event_embeds_reporter_idx
  on public.event_embeds (reporter_id, created_at desc);

alter table public.event_embeds enable row level security;

create policy "Embeds from active reporters are public"
  on public.event_embeds for select
  using (
    removed_at is null
    and exists (
      select 1 from public.reporters r
      where r.id = event_embeds.reporter_id and r.trust <> 'suspended'
    )
  );
