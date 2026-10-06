-- Rate limit for the "Ask the archive" endpoint (/api/ask), which calls a
-- paid LLM API (signed-in users only). One row per user per hour window,
-- keyed by a SHA-256 hash of the user id. The table is only reachable
-- through the function.
create table if not exists public.ask_usage (
  client_hash text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (client_hash, window_start)
);

alter table public.ask_usage enable row level security;

-- Counts one question for the client and returns whether it's within both
-- the per-client hourly limit and the site-wide daily limit. Also prunes
-- windows older than two days so the table stays small.
create or replace function public.consume_ask_quota(
  p_client_hash text,
  p_hourly_limit integer,
  p_daily_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_client_count integer;
  v_daily_count integer;
begin
  select coalesce(sum(u.count), 0) into v_daily_count
  from public.ask_usage u
  where u.window_start > now() - interval '1 day';

  if v_daily_count >= p_daily_limit then
    return false;
  end if;

  insert into public.ask_usage as u (client_hash, window_start, count)
  values (p_client_hash, v_window, 1)
  on conflict (client_hash, window_start)
  do update set count = u.count + 1
  returning u.count into v_client_count;

  delete from public.ask_usage u where u.window_start < now() - interval '2 days';

  return v_client_count <= p_hourly_limit;
end;
$$;

revoke all on function public.consume_ask_quota(text, integer, integer) from public;
grant execute on function public.consume_ask_quota(text, integer, integer) to anon, authenticated;
