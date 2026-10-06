-- Personal MCP access tokens: a signed-in user generates one on /connect and
-- pastes it into their AI app as `Authorization: Bearer smcp_…`. Only a
-- SHA-256 hash is stored — the token itself is shown once and never again.
create table if not exists public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  token_hash text not null unique,
  -- Last 4 characters, so the list can tell tokens apart without revealing them.
  token_hint text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists mcp_tokens_user_id_idx on public.mcp_tokens (user_id);

alter table public.mcp_tokens enable row level security;

create policy "Users can view their own MCP tokens"
  on public.mcp_tokens for select
  using (auth.uid() = user_id);

create policy "Users can create MCP tokens for themselves"
  on public.mcp_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can revoke their own MCP tokens"
  on public.mcp_tokens for delete
  using (auth.uid() = user_id);

-- The MCP endpoint has no user session, only the bearer token, so it can't
-- read the table through RLS. This looks a token up by hash and returns its
-- owner — only for wallet accounts, matching the app's sign-in model — and
-- records when it was last used (at most once a minute, to avoid a write on
-- every tool call).
create or replace function public.verify_mcp_token(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_id uuid;
  v_user_id uuid;
  v_last_used timestamptz;
begin
  select t.id, t.user_id, t.last_used_at
    into v_token_id, v_user_id, v_last_used
  from public.mcp_tokens t
  where t.token_hash = p_token_hash
    and exists (
      select 1 from auth.identities i
      where i.user_id = t.user_id and i.provider = 'web3'
    );

  if v_token_id is null then
    return null;
  end if;

  if v_last_used is null or v_last_used < now() - interval '1 minute' then
    update public.mcp_tokens set last_used_at = now() where id = v_token_id;
  end if;

  return v_user_id;
end;
$$;

revoke all on function public.verify_mcp_token(text) from public;
grant execute on function public.verify_mcp_token(text) to anon, authenticated;
