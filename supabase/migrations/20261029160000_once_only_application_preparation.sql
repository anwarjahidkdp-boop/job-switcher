-- Claim AI preparation once per job, including simultaneous browser requests.
-- Old prepared packs remain untouched and available to download.
alter table public.applications
  add column if not exists preparation_token uuid,
  add column if not exists preparation_started_at timestamptz;

create or replace function public.claim_application_preparation(p_job uuid,p_token uuid)
returns boolean language plpgsql security invoker set search_path to ''
as $$
declare u uuid := (select auth.uid()); claimed uuid;
begin
  if u is null then raise exception 'Sign in to prepare an application.'; end if;
  if p_token is null then raise exception 'Invalid preparation request.'; end if;
  insert into public.applications(user_id,job_id,status)
    values(u,p_job,'preparing') on conflict(user_id,job_id) do nothing;
  update public.applications
     set preparation_token=p_token,preparation_started_at=now(),status='preparing'
   where user_id=u and job_id=p_job
     and pack is null and applied_at is null
     and status not in ('applied','interview','offer','closed','withdrawn')
     and (preparation_started_at is null or preparation_started_at < now()-interval '4 minutes')
   returning id into claimed;
  return claimed is not null;
end;
$$;
revoke all on function public.claim_application_preparation(uuid,uuid) from public;
grant execute on function public.claim_application_preparation(uuid,uuid) to authenticated;
