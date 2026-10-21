-- jobs.source_kind only allowed the first sources (greenhouse, lever), so jobs from every board added later
-- (ashby, smartrecruiters, workable, recruitee, remotive, arbeitnow, adzuna, jooble, reed) were rejected on save.
alter table public.jobs drop constraint if exists jobs_source_kind_check;
alter table public.jobs add constraint jobs_source_kind_check check (source_kind in ('paste','email_alert','jsonld','greenhouse','lever','curated','sample','ashby','smartrecruiters','workable','recruitee','remotive','arbeitnow','adzuna','jooble','reed'));
