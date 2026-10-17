-- Optional "send from my Gmail": the user connects Gmail (gmail.send scope only) and then sends each
-- application themselves by pressing Apply. The refresh token is AES-GCM encrypted by the app
-- (key only in Worker secrets). RLS is on with no policies: only the server (service role) reads this table.
create table public.gmail_connections (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  google_email      text not null,
  refresh_token_enc text not null,
  scope             text not null default '',
  connected_at      timestamptz not null default now(),
  last_sent_at      timestamptz
);
alter table public.gmail_connections enable row level security;
