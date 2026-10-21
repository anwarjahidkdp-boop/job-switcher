-- AI check of the top matches: after the deterministic score, the job description and the Master CV are read
-- together and the job is confirmed (strong), flagged (partial) or hidden (no) for this person.
alter table public.matches
  add column if not exists ai_fit text check (ai_fit in ('strong', 'partial', 'no')),
  add column if not exists ai_reason text,
  add column if not exists ai_checked_at timestamptz;
