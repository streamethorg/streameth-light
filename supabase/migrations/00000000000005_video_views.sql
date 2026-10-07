-- Video watch analytics. One row per playback: the player creates it on the
-- first play and reports progress while it plays (/api/views). `mode` is
-- 'video' for the watch-page player and 'audio' for Listen mode.
-- watched_seconds counts seconds of the talk actually played (seeking
-- doesn't count); max_position is the furthest point reached.
--
-- Only the server touches this table, with the service-role key: RLS is on
-- with no policies, so the public anon key can't read or write it.
create table if not exists public.video_views (
  id uuid primary key,
  video_id text not null check (char_length(video_id) between 1 and 64),
  source text not null check (source in ('streameth', 'youtube')),
  mode text not null check (mode in ('video', 'audio')),
  user_id uuid references auth.users (id) on delete set null,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  max_position integer not null default 0 check (max_position >= 0),
  duration integer check (duration > 0),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_views_video_idx on public.video_views (video_id, started_at);
create index if not exists video_views_started_idx on public.video_views (started_at);

alter table public.video_views enable row level security;

-- Creates or advances a view. Progress only moves forward (a late or
-- repeated report can't lower it), and watched time can't exceed the
-- wall-clock time since the view started (plus slack for 2x playback and
-- clock skew), so a forged report can't claim hours of watching.
create or replace function public.record_video_view(
  p_id uuid,
  p_video_id text,
  p_source text,
  p_mode text,
  p_user_id uuid,
  p_watched_seconds integer,
  p_max_position integer,
  p_duration integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.video_views as v
    (id, video_id, source, mode, user_id, watched_seconds, max_position, duration)
  values
    -- Normally the first report (watched = 0); if it was lost, a later one
    -- creates the row, capped like an update one minute in.
    (p_id, p_video_id, p_source, p_mode, p_user_id, least(greatest(p_watched_seconds, 0), 60),
     greatest(p_max_position, 0), p_duration)
  on conflict (id) do update set
    watched_seconds = greatest(
      v.watched_seconds,
      least(p_watched_seconds, (extract(epoch from now() - v.started_at) * 2)::integer + 60)
    ),
    max_position = greatest(v.max_position, least(p_max_position, coalesce(p_duration, v.duration, p_max_position))),
    duration = coalesce(p_duration, v.duration),
    user_id = coalesce(v.user_id, p_user_id),
    updated_at = now()
  where v.video_id = p_video_id;
end;
$$;

revoke all on function public.record_video_view(uuid, text, text, text, uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.record_video_view(uuid, text, text, text, uuid, integer, integer, integer) to service_role;

-- Per-video totals. security_invoker makes it obey video_views' RLS, so it's
-- just as closed to the anon key as the table.
create or replace view public.video_view_stats
with (security_invoker = true) as
select
  video_id,
  source,
  count(*) as plays,
  count(distinct user_id) as signed_in_viewers,
  round(sum(watched_seconds) / 60.0, 1) as watched_minutes,
  round(avg(watched_seconds) / 60.0, 1) as avg_minutes_per_play,
  round(avg(least(max_position::numeric / nullif(duration, 0), 1)) * 100) as avg_percent_reached,
  max(started_at) as last_played_at
from public.video_views
group by video_id, source;
