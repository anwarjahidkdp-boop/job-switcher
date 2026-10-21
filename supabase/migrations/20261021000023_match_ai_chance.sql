-- The AI check's shortlist chance, so reachable jobs rank before long shots of the same score.
alter table public.matches add column if not exists ai_chance text check (ai_chance in ('high', 'medium', 'low'));
