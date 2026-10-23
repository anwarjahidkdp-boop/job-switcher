-- Owner decision: billing country is fixed after initial country setup; one active job-search country.
-- No CV files, career facts, applications, payment records or subscriptions are deleted.
alter table public.profiles add column billing_country_locked boolean not null default false;
alter table public.profiles add column search_country_version integer not null default 0;
update public.profiles set billing_country_locked = true where onboarding_step <> 'country' or exists (select 1 from public.payments where user_id=profiles.id);

create or replace function public.lock_home_country() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.billing_country_locked and new.home_country is distinct from old.home_country then
    raise exception 'Your subscription country is fixed after initial setup.' using errcode = 'P0001';
  end if;
  new.billing_country_locked := old.billing_country_locked or new.onboarding_step <> 'country';
  return new;
end $$;
drop trigger if exists profiles_lock_home_country on public.profiles;
create trigger profiles_lock_home_country before update on public.profiles
for each row execute function public.lock_home_country();

create or replace function public.reset_search_country() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.target_country is distinct from old.target_country then
    new.preferences := '{"roles":"","locations":"","salaryMin":null,"salaryMax":null,"notice":null,"mode":"Any"}'::jsonb;
    new.personal := '{}'::jsonb;
    new.cv_style := jsonb_build_object('tpl', (select default_template from public.country_rules where code = new.target_country));
    new.search_country_version := old.search_country_version + 1;
    new.needs_visa := new.target_country <> new.home_country;
    if old.onboarding_step in ('prefs','reveal','done') then
      new.onboarding_step := 'prefs';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.reset_search_country() from public, anon, authenticated;
create trigger profiles_reset_search_country before update of target_country on public.profiles
for each row execute function public.reset_search_country();

-- A delayed AI response for a previous destination must never become the current country's CV.
create function public.publish_country_master_cv(
 p_content jsonb,p_flags text[],p_ai boolean,p_model text,p_document_id uuid,
 p_country text,p_revision integer,p_complete_setup boolean default false
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare m uuid;
begin
 perform 1 from public.profiles where id=auth.uid() and target_country=p_country
   and search_country_version=p_revision for update;
 if not found then
   raise exception 'Your job-search country changed. Complete setup for the current country and try again.' using errcode='P0001';
 end if;
 m := public.replace_master_cv(p_content,p_flags,p_ai,p_model,p_document_id);
 if p_complete_setup then
   update public.profiles set onboarding_step=case when onboarding_step='done' then 'done' else 'reveal' end where id=auth.uid();
 end if;
 return m;
end $$;
revoke all on function public.publish_country_master_cv(jsonb,text[],boolean,text,uuid,text,integer,boolean) from public,anon;
grant execute on function public.publish_country_master_cv(jsonb,text[],boolean,text,uuid,text,integer,boolean) to authenticated;

