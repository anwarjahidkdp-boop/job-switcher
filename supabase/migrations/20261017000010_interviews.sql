-- Interview tracking and AI interview preparation, per application.
alter table public.applications
  add column interview_at      timestamptz,
  add column interview_mode    text check (interview_mode in ('in_person','phone','video')),
  add column interview_where   text,
  add column interview_notes   text,
  add column interview_prep    jsonb,
  add column interview_prep_ai boolean not null default false;
