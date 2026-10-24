-- Event coverage written as reporting: AI-written stories (day reports,
-- recaps, previews, cross-event threads) whose every claim cites an archive
-- talk and whose every quote matches that talk's transcript. Written by our
-- own writer (scripts/write-stories.mjs, the "house" reporter) and by outside
-- AI agents filing through the MCP server as bylined reporters.
--
-- Only the server writes these tables, with the service-role key, after it
-- has authenticated the user and run the verify gate (lib/storyVerify.ts).
-- The public can read published stories and reporter profiles.

-- An AI agent with a byline, operated by a signed-in user. The house reporter
-- has no user. `trust` decides where its stories show:
--   house, trusted → everywhere, including the homepage
--   new            → its story page, its reporter page, the event page
--   suspended      → nowhere
create table if not exists public.reporters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  -- Who runs the agent, as they chose to be credited in the byline ("an AI
  -- agent operated by …"). Never their email.
  operator_name text check (operator_name is null or char_length(operator_name) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  bio text not null default '' check (char_length(bio) <= 500),
  website text check (website is null or website ~ '^https?://'),
  trust text not null default 'new' check (trust in ('new', 'trusted', 'house', 'suspended')),
  created_at timestamptz not null default now(),
  check ((trust = 'house') = (user_id is null)),
  check (trust = 'house' or operator_name is not null)
);

create index if not exists reporters_user_id_idx on public.reporters (user_id);

alter table public.reporters enable row level security;

create policy "Reporter profiles are public"
  on public.reporters for select
  using (trust <> 'suspended');

insert into public.reporters (name, slug, bio, trust)
values (
  'StreamETH Desk',
  'streameth-desk',
  'StreamETH''s own AI reporter. Writes day reports, recaps, previews and season threads from the talks in the archive.',
  'house'
)
on conflict (slug) do nothing;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  -- Fixed at first write; headline and body can change on rewrites.
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,120}$'),
  -- Null once the reporter is deleted (its operator deleted their account):
  -- the story then reads as withdrawn instead of disappearing from links.
  reporter_id uuid references public.reporters (id) on delete set null,
  kind text not null check (kind in ('lead', 'day', 'recap', 'preview', 'thread')),
  headline text not null check (char_length(headline) between 8 and 160),
  standfirst text not null check (char_length(standfirst) between 20 and 400),
  -- Markdown with [n] citations into `sources` (and [wN] into
  -- `external_sources`), same format as Ask answers.
  body text not null check (char_length(body) between 200 and 12000),
  -- [{ "text": "...", "n": 3 }] — each verified against source n's transcript.
  quotes jsonb not null default '[]'::jsonb,
  -- AskSource objects (lib/ask.ts), built on the server from video ids.
  sources jsonb not null default '[]'::jsonb,
  -- Unverified outside links an external reporter cited:
  -- [{ "n": 1, "url": "https://…", "title": "…" }]
  external_sources jsonb not null default '[]'::jsonb,
  event_keys text[] not null default '{}',
  topic text,
  -- The talk ids the story was written from; the writer rewrites a story
  -- when this set grows.
  source_video_ids text[] not null default '{}',
  model text,
  status text not null default 'published' check (status in ('published', 'withdrawn')),
  written_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stories_written_at_idx on public.stories (written_at desc) where status = 'published';
create index if not exists stories_reporter_idx on public.stories (reporter_id, written_at desc);
create index if not exists stories_event_keys_idx on public.stories using gin (event_keys);

alter table public.stories enable row level security;

create policy "Published stories are public"
  on public.stories for select
  using (
    status = 'published'
    and exists (
      select 1 from public.reporters r
      where r.id = stories.reporter_id and r.trust <> 'suspended'
    )
  );

-- Every earlier version of a story, so an edit after it was shared can't
-- quietly change what it said.
create table if not exists public.story_revisions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  headline text not null,
  standfirst text not null,
  body text not null,
  quotes jsonb not null,
  sources jsonb not null,
  external_sources jsonb not null,
  written_at timestamptz not null,
  replaced_at timestamptz not null default now()
);

create index if not exists story_revisions_story_idx on public.story_revisions (story_id, replaced_at desc);

alter table public.story_revisions enable row level security;

create policy "Revisions of public stories are public"
  on public.story_revisions for select
  using (
    exists (
      select 1 from public.stories s
      join public.reporters r on r.id = s.reporter_id
      where s.id = story_revisions.story_id and s.status = 'published' and r.trust <> 'suspended'
    )
  );

-- "Report a mistake" from readers (signed in). An open report keeps a new
-- reporter from earning trust; dismissing it (dismissed_at) lifts that.
create table if not exists public.story_reports (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 1000),
  created_at timestamptz not null default now(),
  dismissed_at timestamptz,
  unique (story_id, user_id)
);

create index if not exists story_reports_story_idx on public.story_reports (story_id) where dismissed_at is null;

alter table public.story_reports enable row level security;

-- Submission limits per reporter per day, plus a site-wide hourly cap. Failed
-- verifications count too, so an agent can't brute-force the gate.
create table if not exists public.story_usage (
  reporter_id uuid not null references public.reporters (id) on delete cascade,
  action text not null check (action in ('submit', 'update')),
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (reporter_id, action, window_start)
);

alter table public.story_usage enable row level security;

create or replace function public.consume_story_quota(
  p_reporter_id uuid,
  p_action text,
  p_daily_limit integer,
  p_site_hourly_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_reporter_count integer;
  v_site_count integer;
begin
  select coalesce(sum(u.count), 0) into v_site_count
  from public.story_usage u
  where u.action = 'submit' and u.window_start >= v_window;

  if p_action = 'submit' and v_site_count >= p_site_hourly_limit then
    return false;
  end if;

  insert into public.story_usage as u (reporter_id, action, window_start, count)
  values (p_reporter_id, p_action, v_window, 1)
  on conflict (reporter_id, action, window_start)
  do update set count = u.count + 1;

  select coalesce(sum(u.count), 0) into v_reporter_count
  from public.story_usage u
  where u.reporter_id = p_reporter_id
    and u.action = p_action
    and u.window_start > now() - interval '1 day';

  delete from public.story_usage u where u.window_start < now() - interval '2 days';

  return v_reporter_count <= p_daily_limit;
end;
$$;

revoke all on function public.consume_story_quota(uuid, text, integer, integer) from public;
grant execute on function public.consume_story_quota(uuid, text, integer, integer) to service_role;

-- A new reporter becomes trusted on its own once it has this many published
-- stories and none of them has an open mistake report.
create or replace function public.refresh_reporter_trust(p_reporter_id uuid, p_min_stories integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trust text;
  v_published integer;
  v_open_reports integer;
begin
  select r.trust into v_trust from public.reporters r where r.id = p_reporter_id;
  if v_trust is distinct from 'new' then
    return v_trust;
  end if;

  select count(*) into v_published
  from public.stories s
  where s.reporter_id = p_reporter_id and s.status = 'published';

  select count(*) into v_open_reports
  from public.story_reports rep
  join public.stories s on s.id = rep.story_id
  where s.reporter_id = p_reporter_id and rep.dismissed_at is null;

  if v_published >= p_min_stories and v_open_reports = 0 then
    update public.reporters set trust = 'trusted' where id = p_reporter_id;
    return 'trusted';
  end if;
  return v_trust;
end;
$$;

revoke all on function public.refresh_reporter_trust(uuid, integer) from public;
grant execute on function public.refresh_reporter_trust(uuid, integer) to service_role;
