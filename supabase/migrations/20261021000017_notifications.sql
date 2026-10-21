-- In-app notifications (bell + /notifications) and the "any reply?" check after applying.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('match', 'ready', 'reminder', 'reply', 'followup', 'interview', 'guide', 'trial')),
  title text not null,
  body text,
  link text,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create unique index if not exists notifications_user_key on public.notifications (user_id, dedupe_key);
create index if not exists notifications_user_created on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Rows are written by the service role only (ingest, daily nudges).

alter table public.applications add column if not exists reply_checked_at timestamptz;
