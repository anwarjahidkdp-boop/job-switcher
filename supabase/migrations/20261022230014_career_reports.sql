-- Retain matching evidence before the next matching run overwrites matches.
create table public.match_assessments (
 user_id uuid not null references auth.users(id) on delete cascade, job_id uuid not null references public.jobs(id) on delete cascade,
 computed_at timestamptz not null, score integer not null, relevant boolean not null, capped boolean not null,
 gaps jsonb not null, ai_fit text, primary key(user_id,job_id,computed_at)
);
alter table public.match_assessments enable row level security;
revoke all on public.match_assessments from anon,authenticated;
grant select on public.match_assessments to authenticated;
grant all on public.match_assessments to service_role;
create policy match_assessments_own on public.match_assessments for select to authenticated using(user_id=(select auth.uid()));
create index match_assessments_period on public.match_assessments(user_id,computed_at desc);
insert into public.match_assessments select user_id,job_id,computed_at,score,relevant,capped,gaps,ai_fit from public.matches;
create function public.record_match_assessment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.match_assessments(user_id,job_id,computed_at,score,relevant,capped,gaps,ai_fit)
 values(new.user_id,new.job_id,new.computed_at,new.score,new.relevant,new.capped,new.gaps,new.ai_fit)
 on conflict(user_id,job_id,computed_at) do update set score=excluded.score,relevant=excluded.relevant,capped=excluded.capped,gaps=excluded.gaps,ai_fit=excluded.ai_fit;
 return new;
end $$;
revoke all on function public.record_match_assessment() from public,anon,authenticated;
create trigger match_assessment_history after insert or update on public.matches for each row execute function public.record_match_assessment();
-- User-period evidence, never global inventory presented as personal work.
create table public.career_reports (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('trial','weekly')), period_start timestamptz not null, period_end timestamptz not null,
 metrics jsonb not null, created_at timestamptz not null default now(), check(period_end>period_start),
 unique(user_id,kind,period_start)
);
alter table public.career_reports enable row level security;
revoke all on public.career_reports from anon,authenticated;
grant select on public.career_reports to authenticated;
grant all on public.career_reports to service_role;
create policy career_reports_own on public.career_reports for select to authenticated using(user_id=(select auth.uid()));
create index career_reports_user_created on public.career_reports(user_id,created_at desc);
create or replace function public.career_metrics(p_user uuid,p_start timestamptz,p_end timestamptz) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_start is null or p_end is null or p_end<=p_start then raise exception 'invalid report period'; end if;
 with m as (select distinct on(m.job_id) m.*,j.active,j.deadline from public.match_assessments m join public.jobs j on j.id=m.job_id
   where m.user_id=p_user and m.computed_at>=p_start and m.computed_at<p_end order by m.job_id,m.computed_at desc),
 a as (select * from public.applications where user_id=p_user),
 e as (select e.* from public.application_events e join a on a.id=e.application_id where e.user_id=p_user and e.created_at>=p_start and e.created_at<p_end),
 gap as (select case when jsonb_typeof(g)='string' then g#>>'{}' else g->>'t' end label
   from m cross join lateral jsonb_array_elements(case when jsonb_typeof(m.gaps)='array' then m.gaps else '[]'::jsonb end) g
   where m.relevant and m.active and coalesce(m.ai_fit,'')<>'no')
 select jsonb_build_object(
  'jobs_analysed',(select count(*) from m),
  'relevant',(select count(*) from m where relevant and active and coalesce(ai_fit,'')<>'no'),
  'strong',(select count(*) from m where relevant and active and not capped and (ai_fit='strong' or (ai_fit is null and score>=85))),
  'prepared',(select count(*) from a where pack is not null and (exists(select 1 from e where e.application_id=a.id and e.status='ready') or (a.created_at>=p_start and a.created_at<p_end and not exists(select 1 from public.application_events all_e where all_e.application_id=a.id and all_e.status='ready')))),
  'applied',(select count(*) from a where applied_at>=p_start and applied_at<p_end),
  'interviews',(select count(distinct application_id) from e where status='interview'),
  'offers',(select count(distinct application_id) from e where status='offer'),
  'top_gap',(select label from gap where label is not null group by label order by count(*) desc,label limit 1),
  'next_deadline',(select min(j.deadline) from a join public.jobs j on j.id=a.job_id where j.active and a.status in ('preparing','ready','reminder','waiting') and j.deadline>=p_end::date)
 ) into result;
 return result;
end $$;
revoke all on function public.career_metrics(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.career_metrics(uuid,timestamptz,timestamptz) to service_role;
create or replace function public.save_career_report(p_user uuid,p_kind text,p_start timestamptz,p_end timestamptz) returns public.career_reports
language plpgsql security invoker set search_path='' as $$
declare r public.career_reports;
begin
 select * into r from public.career_reports where user_id=p_user and kind=p_kind and period_start=p_start;
 if found then return r; end if;
 insert into public.career_reports(user_id,kind,period_start,period_end,metrics)
 values(p_user,p_kind,p_start,p_end,public.career_metrics(p_user,p_start,p_end)) on conflict do nothing returning * into r;
 if r.id is null then select * into r from public.career_reports where user_id=p_user and kind=p_kind and period_start=p_start; end if;
 return r;
end $$;
revoke all on function public.save_career_report(uuid,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.save_career_report(uuid,text,timestamptz,timestamptz) to service_role;
