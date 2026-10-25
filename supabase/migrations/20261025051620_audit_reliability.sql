-- Failed/abandoned AI holds expire; no usage record is deleted.
create or replace function public.expire_ai_reservations() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update public.ai_usage set model='__expired_unknown__',cost_micro_usd=0,ok=false
 where model='__reserved__' and created_at<now()-interval '10 minutes';
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.expire_ai_reservations() from public,anon,authenticated;
grant execute on function public.expire_ai_reservations() to service_role;

-- Reserve the remaining allowance while one request runs. Serializes per user across
-- Workers and cron; a lost provider result remains reserved for operator reconciliation.
create or replace function public.reserve_ai_call(p_user uuid,p_feature text,p_provider text) returns bigint
language plpgsql security definer set search_path='' as $$
declare b record; cap bigint; recent int; usage_id bigint;
begin
 perform public.expire_ai_reservations();
 perform 1 from public.subscriptions where user_id=p_user for update;
 if not found then raise exception 'over_cap'; end if;
 if exists(select 1 from public.ai_usage where user_id=p_user and model='__reserved__') then raise exception 'unresolved'; end if;
 select * into b from public.ai_budget(p_user);
 if not found then raise exception 'over_cap'; end if;
 if b.status='trialing' and (b.trial_ends_at is null or b.trial_ends_at<=now()) then raise exception 'trial_expired'; end if;
 if b.status='active' and b.current_period_end is not null and b.current_period_end<=now() then raise exception 'plan_expired'; end if;
 if b.status not in ('trialing','active') then raise exception 'plan_expired'; end if;
 cap:=b.cap_micro_usd;
 if b.plan_code='pro' and exists(select 1 from public.profiles where id=p_user and home_country<>'BD') then cap:=greatest(cap,2000000); end if;
 if b.spent_micro_usd>=cap then raise exception 'over_cap'; end if;
 select count(*) into recent from public.ai_usage where user_id=p_user and created_at>=now()-interval '10 minutes';
 if p_feature not in ('match_check','alert_parse') and recent>=30 then raise exception 'rate_limited'; end if;
 insert into public.ai_usage(user_id,feature,provider,model,cost_micro_usd,ok)
 values(p_user,'__reservation__',p_provider,'__reserved__',cap-b.spent_micro_usd,false) returning id into usage_id;
 return usage_id;
end $$;
revoke all on function public.reserve_ai_call(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_call(uuid,text,text) to service_role;

select public.expire_ai_reservations();

alter table public.match_assessments add column assessment_day date;
update public.match_assessments set assessment_day=(computed_at at time zone 'UTC')::date;
delete from public.match_assessments a using public.match_assessments b
 where a.user_id=b.user_id and a.job_id=b.job_id and a.assessment_day=b.assessment_day and a.computed_at<b.computed_at;
alter table public.match_assessments alter column assessment_day set not null;
create unique index match_assessments_daily on public.match_assessments(user_id,job_id,assessment_day);
create or replace function public.record_match_assessment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (old.score,old.relevant,old.capped,old.gaps,old.ai_fit,(old.computed_at at time zone 'UTC')::date)
 is not distinct from (new.score,new.relevant,new.capped,new.gaps,new.ai_fit,(new.computed_at at time zone 'UTC')::date) then return new; end if;
 insert into public.match_assessments(user_id,job_id,computed_at,assessment_day,score,relevant,capped,gaps,ai_fit)
 values(new.user_id,new.job_id,new.computed_at,(new.computed_at at time zone 'UTC')::date,new.score,new.relevant,new.capped,new.gaps,new.ai_fit)
 on conflict(user_id,job_id,assessment_day) do update set computed_at=excluded.computed_at,score=excluded.score,relevant=excluded.relevant,capped=excluded.capped,gaps=excluded.gaps,ai_fit=excluded.ai_fit;
 return new;
end $$;
create or replace function public.prune_match_assessments() returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;begin delete from public.match_assessments where computed_at<now()-interval '60 days'; get diagnostics n=row_count; return n;end $$;
revoke all on function public.prune_match_assessments() from public,anon,authenticated;
grant execute on function public.prune_match_assessments() to service_role;
drop policy if exists matches_own on public.matches;
create policy matches_read_own on public.matches for select to authenticated using(user_id=(select auth.uid()));
revoke insert,update,delete on public.matches from authenticated;
-- Application history must not expose another user's private vacancy.
drop policy if exists jobs_select_applied on public.jobs;
create policy jobs_select_applied on public.jobs for select to authenticated using((owner_id is null or owner_id=(select auth.uid())) and exists(select 1 from public.applications a where a.job_id=jobs.id and a.user_id=(select auth.uid())));
-- Recording an external action is not spending an AI/send allowance.
create or replace function public.guard_application_limits() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if auth.uid() is not null and (old.applied_at is not null or old.sending_at is not null or old.status in ('applied','interview','offer','closed','withdrawn')) then raise exception 'Submitted application history cannot be deleted to reset your allowance.'; end if;
  return old;
 end if;
 if tg_op='UPDATE' and old.applied_at is not null then new.applied_at:=old.applied_at; end if;
 if (tg_op='INSERT' or old.applied_at is null) and (new.status in ('applied','interview','offer','closed','withdrawn') or new.applied_at is not null) and auth.uid() is not null then new.applied_at:=now(); end if;
 return new;
end $$;
create or replace function public.confirm_external_application(p_job uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); a public.applications;
begin
 if u is null then raise exception 'not signed in'; end if;
 perform 1 from public.jobs where id=p_job and (owner_id is null or owner_id=u);
 if not found then raise exception 'Job not found'; end if;
 perform 1 from public.profiles where id=u for update;
 select * into a from public.applications where user_id=u and job_id=p_job for update;
 if a.applied_at is not null then return a.id; end if;
 if a.sending_at>now()-interval '2 minutes' then raise exception 'A send is still in progress. Wait two minutes and check Gmail Sent before confirming.'; end if;
 insert into public.applications(user_id,job_id,status) values(u,p_job,'applied')
 on conflict(user_id,job_id) do update set status='applied',sending_at=null returning * into a;
 insert into public.application_events(application_id,user_id,event,status,actor) values(a.id,u,'You confirmed: applied externally','applied','user');
 delete from public.reminders where application_id=a.id and sent_at is null;
 return a.id;
end $$;
revoke all on function public.confirm_external_application(uuid) from public,anon;
grant execute on function public.confirm_external_application(uuid) to authenticated;

-- User-scoped invoker function: preserve RLS and column grants, with one rollback boundary.
create or replace function public.replace_cv(p_document jsonb,p_facts jsonb,p_profile jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare u uuid := auth.uid(); d uuid;
begin
  if u is null then raise exception 'not signed in' using errcode='42501'; end if;
  -- Serialize CV replacements for the same user; another account cannot acquire its row.
  perform 1 from public.profiles where id=u for update;
  if not found then raise exception 'profile missing'; end if;
  update public.cv_documents set is_current=false where user_id=u and is_current;
  insert into public.cv_documents(user_id,storage_path,file_name,mime_type,size_bytes,text_content,text_source,extraction,questions,is_demo,answers)
  values(u,p_document->>'storage_path',p_document->>'file_name',p_document->>'mime_type',(p_document->>'size_bytes')::int,
    p_document->>'text_content',p_document->>'text_source',p_document->'extraction',p_document->'questions',
    coalesce((p_document->>'is_demo')::boolean,false),coalesce(p_document->'answers','{}'::jsonb)) returning id into d;
  delete from public.career_facts where user_id=u ;
  insert into public.career_facts(user_id,cv_document_id,kind,data,provenance,verified,evidence)
  select u,d,f.kind,f.data,f.provenance,f.verified,f.evidence
  from jsonb_to_recordset(p_facts) as f(kind text,data jsonb,provenance text,verified boolean,evidence text);
  update public.profiles set full_name=p_profile->>'full_name',phone=p_profile->>'phone',city=p_profile->>'city',
    career_meta=p_profile->'career_meta',onboarding_step='questions' where id=u;
  return d;
end $$;
revoke all on function public.replace_cv(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.replace_cv(jsonb,jsonb,jsonb) to authenticated;


create or replace function public.reset_search_country() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.target_country is distinct from old.target_country then
    new.preferences := '{"roles":"","locations":"","salaryMin":null,"salaryMax":null,"notice":null,"mode":"Any"}'::jsonb;
    new.personal := old.personal;
    new.cv_style := jsonb_build_object('tpl', (select default_template from public.country_rules where code = new.target_country));
    new.search_country_version := old.search_country_version + 1;
    new.needs_visa := new.target_country <> new.home_country;
    if old.onboarding_step in ('prefs','reveal','done') then
      new.onboarding_step := 'prefs';
    end if;
  end if;
  return new;
end $$;

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
  'strong',(select count(*) from m where relevant and active and not capped and score>=90),
  'prepared',(select count(*) from a where pack is not null and (exists(select 1 from e where e.application_id=a.id and e.status='ready') or (a.created_at>=p_start and a.created_at<p_end and not exists(select 1 from public.application_events all_e where all_e.application_id=a.id and all_e.status='ready')))),
  'applied',(select count(*) from a where applied_at>=p_start and applied_at<p_end),
  'interviews',(select count(distinct application_id) from e where status='interview'),
  'offers',(select count(distinct application_id) from e where status='offer'),
  'top_gap',(select label from gap where label is not null group by label order by count(*) desc,label limit 1),
  'next_deadline',(select min(j.deadline) from a join public.jobs j on j.id=a.job_id where j.active and a.status in ('preparing','ready','reminder','waiting') and j.deadline>=p_end::date)
 ) into result;
 return result;
end $$;

-- Save confirmed updates and their matching facts together; reject a stale upload.
create function public.save_cv_answers(p_document uuid,p_answers jsonb,p_facts jsonb,p_extraction jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'not signed in'; end if;
 perform 1 from public.profiles where id=u for update;
 perform 1 from public.cv_documents where id=p_document and user_id=u and is_current for update;
 if not found then raise exception 'Your CV changed. Reload before saving answers.'; end if;
 update public.cv_documents set answers=p_answers,extraction=coalesce(p_extraction,extraction) where id=p_document and user_id=u;
 delete from public.career_facts where user_id=u and (p_extraction is not null or kind='answer');
 insert into public.career_facts(user_id,cv_document_id,kind,data,provenance,verified,evidence)
 select u,p_document,f.kind,f.data,f.provenance,f.verified,f.evidence from jsonb_to_recordset(p_facts) f(kind text,data jsonb,provenance text,verified boolean,evidence text);
 update public.profiles set onboarding_step='prefs' where id=u;
end $$;
revoke all on function public.save_cv_answers(uuid,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_cv_answers(uuid,jsonb,jsonb,jsonb) to authenticated;

create index if not exists ai_usage_open_holds on public.ai_usage(created_at) where model='__reserved__';
-- Bound direct API writes as well as application routes, without altering existing rows.
create function public.guard_user_content() returns trigger language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); n bigint; payload jsonb:=to_jsonb(new);
begin
 if octet_length(payload::text)>524288 then raise exception 'This record is too large (maximum 512 KB).'; end if;
 if tg_op='INSERT' and u is not null then
  perform 1 from public.profiles where id=u for update;
  execute format('select count(*) from public.%I where %I=$1',tg_table_name,tg_argv[0]) into n using u;
  if n>=tg_argv[1]::integer then raise exception 'Your saved-record limit has been reached. Remove unused records or contact support.'; end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_user_content() from public,anon,authenticated;
create trigger content_limit before insert or update on public.cv_documents for each row execute function public.guard_user_content('user_id','100');
create trigger content_limit before insert or update on public.master_cvs for each row execute function public.guard_user_content('user_id','1000');
create trigger content_limit before insert or update on public.career_facts for each row execute function public.guard_user_content('user_id','1000');
create trigger content_limit before insert or update on public.applications for each row execute function public.guard_user_content('user_id','5000');
create trigger content_limit before insert or update on public.application_events for each row execute function public.guard_user_content('user_id','20000');
create trigger content_limit before insert or update on public.reminders for each row execute function public.guard_user_content('user_id','1000');
create trigger content_limit before insert or update on public.profiles for each row execute function public.guard_user_content('id','1');
