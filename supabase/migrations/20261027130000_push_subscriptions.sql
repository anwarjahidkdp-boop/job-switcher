-- Phone notifications (Web Push). The bell keeps working as before; these tables only let the server also ring the
-- person's phone or computer. Both are read and written by the server (service role) only.

-- One row per browser or installed app that said "Allow". The endpoint is the address the browser's push service gave us.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;

-- The site's own signing key pair (VAPID), made by the server on first use, so nobody has to paste keys into settings.
create table if not exists public.push_keys (
  id smallint primary key default 1 check (id = 1),
  public_key text not null,
  private_jwk jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_keys enable row level security;
revoke all on table public.push_keys from anon, authenticated;
