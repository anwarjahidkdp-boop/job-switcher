-- More public job sources: Ashby, SmartRecruiters, Workable, Recruitee boards, free job APIs and keyed job-search APIs.
alter table public.ingestion_sources drop constraint if exists ingestion_sources_kind_check;
alter table public.ingestion_sources add constraint ingestion_sources_kind_check check (kind in ('jsonld','greenhouse','lever','ashby','smartrecruiters','workable','recruitee','remotive','arbeitnow','adzuna','jooble'));
create unique index if not exists ingestion_sources_kind_token_key on public.ingestion_sources (kind, board_token) where board_token is not null;
