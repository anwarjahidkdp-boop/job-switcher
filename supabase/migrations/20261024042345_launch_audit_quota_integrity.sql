-- Preserve sent-history quota across direct REST mutation and serialize distinct-job confirmations.
-- No existing applications, trial dates, prices or user data are rewritten.
create or replace function public.guard_application_limits() returns trigger
language plpgsql security definer set search_path='' as $$
declare total int; daily int; first_confirmation boolean;
begin
 if tg_op='DELETE' then
  if auth.uid() is not null and (old.applied_at is not null or old.sending_at is not null or old.status in ('applied','interview','offer','closed','withdrawn')) then
   raise exception 'Submitted application history cannot be deleted to reset your allowance.' using errcode='P0001';
  end if;
  return old;
 end if;
 if tg_op='UPDATE' and old.applied_at is not null then new.applied_at:=old.applied_at; end if;
 first_confirmation := (tg_op='INSERT' or old.applied_at is null)
   and (new.status in ('applied','interview','offer','closed','withdrawn') or new.applied_at is not null);
 if first_confirmation then
  -- Browser-supplied past/future timestamps cannot move consumption outside the daily window.
  if auth.uid() is not null then new.applied_at:=now(); end if;
  perform 1 from public.profiles where id=new.user_id for update;
  if not public.is_pro(new.user_id) then
   if exists(select 1 from public.applications a where a.user_id=new.user_id and a.id<>new.id and a.sending_at is not null and a.status not in ('applied','interview','offer','closed','withdrawn')) then
    raise exception 'A previous send attempt is unresolved. Check Gmail Sent before retrying to avoid a duplicate email.' using errcode='P0001';
   end if;
   select count(*),count(*) filter(where a.applied_at>now()-interval '24 hours') into total,daily
    from public.applications a where a.user_id=new.user_id and a.applied_at is not null and a.id<>new.id;
   if daily>=1 or total>=5 then
    raise exception 'Your free trial includes one application a day. Go Pro to apply to more jobs today.' using errcode='P0001';
   end if;
  end if;
 end if;
 return new;
end $$;
revoke execute on function public.guard_application_limits() from public,anon,authenticated;
grant execute on function public.guard_application_limits() to service_role;
drop trigger if exists applications_guard_limits on public.applications;
create trigger applications_guard_limits before insert or update or delete on public.applications
 for each row execute function public.guard_application_limits();
