-- Reserve the free application slot before contacting Gmail, across different jobs/tabs.
-- User-scoped invoker keeps RLS and never sends mail or marks anything applied.
create or replace function public.claim_gmail_application(p_application uuid) returns timestamptz
language plpgsql security invoker set search_path='' as $$
declare u uuid:=auth.uid(); t timestamptz:=clock_timestamp(); paid boolean; total int; daily int; claimed uuid;
begin
 if u is null then raise exception 'not signed in' using errcode='42501'; end if;
 perform 1 from public.profiles where id=u for update;
 if not found then raise exception 'profile missing'; end if;
 select exists(select 1 from public.subscriptions where user_id=u and plan_code='pro' and status='active'
   and (current_period_end is null or current_period_end>now())) into paid;
 if not paid then
   if exists(select 1 from public.applications where user_id=u and sending_at is not null and status not in ('applied','interview','offer','closed','withdrawn')) then
     raise exception 'A previous send attempt is unresolved. Check Gmail Sent before retrying to avoid a duplicate email.';
   end if;
   select count(*),count(*) filter(where applied_at>now()-interval '24 hours') into total,daily
     from public.applications where user_id=u and applied_at is not null;
   if total>=5 or daily>=1 then raise exception 'Your free trial includes one application a day. Go Pro to apply to more jobs today.'; end if;
 end if;
 update public.applications set sending_at=t where id=p_application and user_id=u and sending_at is null
   and status not in ('applied','interview','offer','closed','withdrawn') returning id into claimed;
 if claimed is null then raise exception 'A previous send attempt is unresolved. Check Gmail Sent before retrying to avoid a duplicate email.'; end if;
 return t;
end $$;
revoke all on function public.claim_gmail_application(uuid) from public,anon;
grant execute on function public.claim_gmail_application(uuid) to authenticated;
