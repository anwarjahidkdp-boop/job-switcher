-- The AI check's overall score (profession, must-haves, experience, industry, level, duties); replaces the rule score once set.
alter table public.matches add column if not exists ai_score int check (ai_score between 0 and 100);
