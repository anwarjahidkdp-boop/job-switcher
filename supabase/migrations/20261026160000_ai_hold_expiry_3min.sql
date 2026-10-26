-- An AI call times out after 2 minutes, so a hold older than 3 minutes belongs to a request that was cut off.
-- Releasing it after 3 (was 10) minutes lets the person carry on sooner.
create or replace function public.expire_ai_reservations() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update public.ai_usage set model='__expired_unknown__',cost_micro_usd=0,ok=false
 where model='__reserved__' and created_at<now()-interval '3 minutes';
 get diagnostics n=row_count; return n;
end $$;
revoke all on function public.expire_ai_reservations() from public,anon,authenticated;
grant execute on function public.expire_ai_reservations() to service_role;
