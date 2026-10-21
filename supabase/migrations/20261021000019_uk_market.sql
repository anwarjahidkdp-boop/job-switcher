-- UK market: Reed.co.uk as an ingestion source, and the GOV.UK register of licensed visa sponsors (Open Government Licence).
alter table public.ingestion_sources drop constraint if exists ingestion_sources_kind_check;
alter table public.ingestion_sources add constraint ingestion_sources_kind_check check (kind in ('jsonld','greenhouse','lever','ashby','smartrecruiters','workable','recruitee','remotive','arbeitnow','adzuna','jooble','reed'));

create table if not exists public.uk_sponsors (
  name_norm text primary key,
  name text not null,
  town text,
  routes text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.uk_sponsors enable row level security;
drop policy if exists uk_sponsors_read on public.uk_sponsors;
create policy uk_sponsors_read on public.uk_sponsors for select to authenticated using (true);
