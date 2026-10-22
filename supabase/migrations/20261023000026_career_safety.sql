alter table public.profiles add column if not exists deal_breakers jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists answer_library jsonb not null default '{}'::jsonb;
comment on column public.profiles.deal_breakers is 'User-controlled hard eligibility filters; never inferred by AI.';
comment on column public.profiles.answer_library is 'User-confirmed reusable screening/application answers; unknown values stay absent.';
