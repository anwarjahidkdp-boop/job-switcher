-- Security audit 2026-11-12: close three ways one signed-in account could cost money or take the app down.

-- 1. An AI call whose outcome is unknown (cut off, timed out, Worker cancelled) may still be billed by the provider.
--    It used to count as US$0, so a script could start calls and drop them without using its allowance.
--    It now counts as a fixed estimate (US$0.05), or the rest of the allowance when less is left.
create or replace function public.unknown_ai_cost_micro_usd() returns bigint
language sql immutable set search_path='' as $$ select 50000::bigint $$;

create or replace function public.expire_ai_reservations() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update public.ai_usage set model='__expired_unknown__',
   cost_micro_usd=least(greatest(cost_micro_usd,0),public.unknown_ai_cost_micro_usd()),ok=false
 where model='__reserved__' and created_at<now()-interval '3 minutes';
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.expire_ai_reservations() from public,anon,authenticated;
grant execute on function public.expire_ai_reservations() to service_role;

-- 2. All free-trial accounts together share a daily AI budget (US$5 per 24 hours), so many throwaway
--    signups cannot drain the prepaid AI credit. Pro users and the daily background checks are not affected.
--    To change it, replace this one function with a new number (micro-dollars).
create or replace function public.trial_ai_daily_budget_micro_usd() returns bigint
language sql immutable set search_path='' as $$ select 5000000::bigint $$;

create index if not exists ai_usage_created_idx on public.ai_usage(created_at);

CREATE OR REPLACE FUNCTION public.reserve_ai_call(p_user uuid, p_feature text, p_provider text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare b record; cap bigint; recent int; usage_id bigint; trial_spent bigint;
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
 if b.plan_code='pro' and exists(select 1 from public.profiles where id=p_user and home_country<>'BD') then cap:=greatest(cap,3000000); end if;
 if b.spent_micro_usd>=cap then raise exception 'over_cap'; end if;
 select count(*) into recent from public.ai_usage where user_id=p_user and created_at>=now()-interval '10 minutes';
 if p_feature not in ('match_check','alert_parse') and recent>=30 then raise exception 'rate_limited'; end if;
 if b.status='trialing' and p_feature not in ('match_check','alert_parse') then
  select coalesce(sum(u.cost_micro_usd),0) into trial_spent
    from public.ai_usage u join public.subscriptions s on s.user_id=u.user_id and s.status='trialing'
   where u.created_at>=now()-interval '24 hours' and u.model<>'__reserved__';
  if trial_spent>=public.trial_ai_daily_budget_micro_usd() then raise exception 'busy'; end if;
 end if;
 insert into public.ai_usage(user_id,feature,provider,model,cost_micro_usd,ok)
 values(p_user,'__reservation__',p_provider,'__reserved__',cap-b.spent_micro_usd,false) returning id into usage_id;
 return usage_id;
end $function$;
revoke all on function public.reserve_ai_call(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_ai_call(uuid,text,text) to service_role;

-- 3. Pasted jobs written straight through the API had no size or count limit, so one account could fill the
--    500 MB database. Signed-in users now get at most 300 own jobs of up to 128 KB each (the app writes ~25 KB).
--    The daily ingest (service role, no signed-in user) is not affected.
create or replace function public.guard_user_jobs() returns trigger language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); n bigint;
begin
 if u is null then return new; end if;
 if octet_length(to_jsonb(new)::text)>131072 then raise exception 'This job is too large (maximum 128 KB).' using errcode='P0001'; end if;
 if tg_op='INSERT' then
  perform 1 from public.profiles where id=u for update;
  select count(*) into n from public.jobs where owner_id=u;
  if n>=300 then raise exception 'You have saved the maximum of 300 pasted jobs. Remove some to add more.' using errcode='P0001'; end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_user_jobs() from public,anon,authenticated;
drop trigger if exists jobs_user_limit on public.jobs;
create trigger jobs_user_limit before insert or update on public.jobs for each row execute function public.guard_user_jobs();

-- 4. CV file storage: at most 120 files per person (CV uploads are capped at 100 records, plus photos),
--    so one account cannot fill the 1 GB free storage.
create or replace function public.cv_file_count() returns bigint
language sql stable security definer set search_path='' as $$
 select count(*) from storage.objects where bucket_id='cv-files' and (storage.foldername(name))[1]=(select auth.uid())::text
$$;
revoke all on function public.cv_file_count() from public,anon,authenticated;
grant execute on function public.cv_file_count() to authenticated,service_role;

drop policy if exists cv_files_insert on storage.objects;
create policy cv_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'cv-files' and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.cv_file_count() < 120);
