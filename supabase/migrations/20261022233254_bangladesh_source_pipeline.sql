-- Public Bangladesh ingestion only. Preserve job IDs and all private user data.
alter table public.ingestion_sources drop constraint ingestion_sources_kind_check;
alter table public.ingestion_sources add constraint ingestion_sources_kind_check check(kind in ('jsonld','greenhouse','lever','ashby','smartrecruiters','workable','recruitee','remotive','arbeitnow','adzuna','jooble','reed','brac','bdweb'));
alter table public.jobs drop constraint jobs_source_kind_check;
alter table public.jobs add constraint jobs_source_kind_check check(source_kind in ('paste','email_alert','jsonld','greenhouse','lever','curated','sample','ashby','smartrecruiters','workable','recruitee','remotive','arbeitnow','adzuna','jooble','reed','brac','bdweb'));
alter table public.ingestion_sources add column source_type text, add column cursor_url text;
create table public.job_canonical_keys(id text primary key,job_id uuid not null references public.jobs(id) on delete cascade);
create index job_canonical_keys_job on public.job_canonical_keys(job_id);
alter table public.job_canonical_keys enable row level security;
revoke all on public.job_canonical_keys from anon,authenticated;
grant all on public.job_canonical_keys to service_role;
create table public.job_source_occurrences (
 id uuid primary key default gen_random_uuid(),job_id uuid not null references public.jobs(id) on delete cascade,
 source_id uuid not null references public.ingestion_sources(id) on delete cascade,external_id text not null,
 discovered_url text not null,original_source_url text,evidence text not null,
 first_seen_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),unique(source_id,external_id)
);
create index job_source_occurrences_job on public.job_source_occurrences(job_id);
alter table public.job_source_occurrences enable row level security;
revoke all on public.job_source_occurrences from anon,authenticated;
grant select on public.job_source_occurrences to authenticated;grant all on public.job_source_occurrences to service_role;
create policy job_source_occurrences_visible on public.job_source_occurrences for select to authenticated using(exists(select 1 from public.jobs j where j.id=job_id));
-- Document or schema ambiguity is held outside the jobs/matching table, never counted as an active vacancy.
create table public.source_documents (
 id uuid primary key default gen_random_uuid(),source_id uuid not null references public.ingestion_sources(id) on delete cascade,
 url text not null,title text not null,kind text not null check(kind in ('article','pdf','image')),
 state text not null check(state in ('needs_review','fetch_failed','processed')),reason text,
 published_at date,extracted_text text,content_sha256 text,attempts int not null default 0,
 first_seen_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),unique(source_id,url)
);
create index source_documents_retry on public.source_documents(source_id,state);
alter table public.source_documents enable row level security;
revoke all on public.source_documents from anon,authenticated;grant all on public.source_documents to service_role;
create function public.ingest_public_jobs(p_source uuid,p_rows jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare src public.ingestion_sources; r jsonb; data public.jobs; jid uuid; existing public.jobs; inserted int:=0; occurrences int:=0; k text;
begin
 select * into src from public.ingestion_sources where id=p_source and active for update;
 if not found then raise exception 'active source required'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>500 then raise exception 'invalid ingestion batch'; end if;
 for r in select value from jsonb_array_elements(p_rows) order by value->>'canonical_key' loop
  k=r->>'canonical_key';if k is null or k!~'^[a-f0-9]{64}$' then raise exception 'invalid canonical identity';end if;
  data=jsonb_populate_record(null::public.jobs,r->'data');
  if data.owner_id is not null or data.is_sample or data.title is null or data.company is null or data.country<>'BD' then raise exception 'public Bangladesh jobs only';end if;
  if data.deadline is not null and data.deadline<current_date then continue;end if;
  perform pg_advisory_xact_lock(hashtextextended(k,0));
  jid:=null;
  select o.job_id into jid from public.job_source_occurrences o where o.source_id=p_source and o.external_id=data.external_id;
  if jid is null then select j.id into jid from public.jobs j where j.source_id=p_source and j.external_id=data.external_id and j.owner_id is null;end if;
  if jid is null then select c.job_id into jid from public.job_canonical_keys c where c.id=k;end if;
  if jid is null then
   insert into public.jobs(owner_id,source_id,source_kind,source_label,external_id,country,title,company,industry,category,location,employment_type,salary_min,salary_max,min_years,max_years,seniority,education,required_skills,preferred_skills,certs,visa_sponsorship,deadline,published_at,apply_method,apply_target,url,responsibilities,description,raw,active)
   values(null,p_source,src.kind,src.name,data.external_id,'BD',data.title,data.company,data.industry,data.category,data.location,data.employment_type,data.salary_min,data.salary_max,data.min_years,data.max_years,data.seniority,data.education,coalesce(data.required_skills,'{}'),coalesce(data.preferred_skills,'{}'),coalesce(data.certs,'[]'),data.visa_sponsorship,data.deadline,data.published_at,coalesce(data.apply_method,'unknown'),data.apply_target,data.url,coalesce(data.responsibilities,'{}'),data.description,data.raw,true) returning id into jid;
   inserted:=inserted+1;
  else
   select * into existing from public.jobs where id=jid for update;
   if existing.owner_id is not null then raise exception 'canonical mapping points to private job';end if;
   -- Secondary aggregators cannot overwrite an authoritative source's requirements.
   if existing.source_id=p_source or src.source_type in ('employer','government') then
    update public.jobs set title=data.title,company=data.company,location=data.location,category=data.category,industry=data.industry,employment_type=data.employment_type,salary_min=data.salary_min,salary_max=data.salary_max,min_years=data.min_years,max_years=data.max_years,seniority=data.seniority,education=data.education,required_skills=coalesce(data.required_skills,'{}'),preferred_skills=coalesce(data.preferred_skills,'{}'),certs=coalesce(data.certs,'[]'),visa_sponsorship=data.visa_sponsorship,deadline=data.deadline,published_at=data.published_at,apply_method=coalesce(data.apply_method,'unknown'),apply_target=data.apply_target,description=data.description,raw=data.raw,active=true,updated_at=now() where id=jid;
   end if;
  end if;
  insert into public.job_canonical_keys(id,job_id) values(k,jid) on conflict(id) do nothing;
  insert into public.job_source_occurrences(job_id,source_id,external_id,discovered_url,original_source_url,evidence)
  values(jid,p_source,data.external_id,r->>'discovered_url',r->>'original_url',coalesce(r->>'evidence','source'))
  on conflict(source_id,external_id) do update set last_seen_at=now(),original_source_url=coalesce(excluded.original_source_url,public.job_source_occurrences.original_source_url),evidence=excluded.evidence;
  occurrences:=occurrences+1;
 end loop;
 return jsonb_build_object('inserted',inserted,'occurrences',occurrences);
end $$;
revoke all on function public.ingest_public_jobs(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_public_jobs(uuid,jsonb) to service_role;
