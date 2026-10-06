-- Weekly "new talks" email digest. Visitors subscribe with just an email
-- (accounts are wallets, so there's no email on file); a confirmation link
-- has to be clicked before anything is sent (double opt-in). `token` is the
-- secret in the confirm and unsubscribe links.
--
-- Only the server touches this table, with the service-role key: RLS is on
-- with no policies, so the public anon key can't read or write it.
create table if not exists public.digest_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and char_length(email) <= 254),
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  confirm_sent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  last_sent_at timestamptz
);

create index if not exists digest_subscribers_active_idx
  on public.digest_subscribers (last_sent_at)
  where confirmed_at is not null and unsubscribed_at is null;

alter table public.digest_subscribers enable row level security;
