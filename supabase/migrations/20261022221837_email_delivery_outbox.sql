-- Durable email queue. Only service-role workers can read payloads or claim delivery.
create table public.email_deliveries (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
 dedupe_key text not null unique, payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','unresolved','failed')),
 attempts int not null default 0, next_attempt_at timestamptz not null default now(),
 provider_id text, last_error text, created_at timestamptz not null default now(), sent_at timestamptz
);
alter table public.email_deliveries enable row level security;
revoke all on public.email_deliveries from anon,authenticated;
grant all on public.email_deliveries to service_role;
create index email_deliveries_pending_idx on public.email_deliveries(next_attempt_at) where status='pending';
create index email_deliveries_user_idx on public.email_deliveries(user_id);
