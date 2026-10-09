-- Sign-in moved from Ethereum wallets to email codes and Google. MCP tokens
-- now belong to accounts with one of those identities; tokens owned by
-- leftover wallet accounts stop verifying (the rows stay, revocable as before).
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
      where i.user_id = t.user_id and i.provider in ('email', 'google')
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
