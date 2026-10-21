-- Audit fixes (2026-10-21): rules the app enforces are now enforced by the database too, so a signed-in user calling
-- the REST API with their own token cannot get around them. Additive: no data is deleted.

-- 1. Profiles: users may edit their own details, but not the email address the app sends mail to.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, city, target_country, home_country, needs_visa, personal, preferences, career_meta, cv_style,
              photo_path, onboarding_step, setup_steps, dismissed_job_ids, email_reminders) on public.profiles to authenticated;

-- The country you live in sets the price and the plan limits, so it stays fixed while a paid Pro period runs.
create or replace function public.lock_home_country() returns trigger language plpgsql set search_path = public as $$
begin
  if new.home_country is distinct from old.home_country and auth.uid() is not null
     and exists (select 1 from public.subscriptions s where s.user_id = new.id and s.plan_code = 'pro' and s.status = 'active'
                 and (s.current_period_end is null or s.current_period_end > now())) then
    raise exception 'You can change the country you live in after your Pro plan ends.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists profiles_lock_home_country on public.profiles;
create trigger profiles_lock_home_country before update of home_country on public.profiles
for each row execute function public.lock_home_country();

-- 2. Applications: once sent, the sent time is kept; the free plan's limit (1 a day, 5 in all) holds on every path.
create or replace function public.is_pro(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subscriptions s where s.user_id = p_user and s.plan_code = 'pro' and s.status = 'active'
                 and (s.current_period_end is null or s.current_period_end > now()));
$$;
revoke execute on function public.is_pro(uuid) from public, anon;
grant execute on function public.is_pro(uuid) to authenticated, service_role;

create or replace function public.guard_application_limits() returns trigger language plpgsql security definer set search_path = public as $$
declare total int; today int;
begin
  if tg_op = 'UPDATE' and old.applied_at is not null then new.applied_at = old.applied_at; end if;
  if new.status = 'applied' and (tg_op = 'INSERT' or old.status not in ('applied','interview','offer'))
     and not public.is_pro(new.user_id) then
    select count(*), count(*) filter (where applied_at > now() - interval '24 hours') into total, today
      from public.applications where user_id = new.user_id and applied_at is not null and id <> new.id;
    if today >= 1 or total >= 5 then
      raise exception 'Your free trial includes one application a day. Go Pro to apply to more jobs today.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists applications_guard_limits on public.applications;
create trigger applications_guard_limits before insert or update on public.applications
for each row execute function public.guard_application_limits();

-- Gmail send claims the row first, so a double press cannot email the employer twice.
alter table public.applications add column if not exists sending_at timestamptz;

-- 3. Jobs you applied to stay visible after the listing closes.
create index if not exists applications_job_id_idx on public.applications(job_id);
drop policy if exists jobs_select_applied on public.jobs;
create policy jobs_select_applied on public.jobs for select to authenticated
  using (exists (select 1 from public.applications a where a.job_id = jobs.id and a.user_id = (select auth.uid())));

-- 4. One current CV and one current master CV per person.
create unique index if not exists master_cvs_one_current on public.master_cvs(user_id) where is_current;
create unique index if not exists cv_documents_one_current on public.cv_documents(user_id) where is_current;

-- 5. Payments: the ledger outlives a deleted account; refunds have a status.
alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments add constraint payments_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check (status in ('initiated','pending','approved','rejected','failed','canceled','refunded'));

-- Extend (or shorten, for a refund) Pro in one statement, so two approvals at once never lose a period.
create or replace function public.extend_pro(p_user uuid, p_days int, p_provider text, p_ref text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare e timestamptz;
begin
  update public.subscriptions set
    plan_code = 'pro', status = 'active', payment_provider = p_provider, payment_ref = p_ref,
    current_period_end = case
      when p_days >= 0 then greatest(case when status = 'active' then coalesce(current_period_end, now()) else now() end, now()) + make_interval(days => p_days)
      else coalesce(current_period_end, now()) + make_interval(days => p_days) end
  where user_id = p_user
  returning current_period_end into e;
  if e is null then raise exception 'no subscription for user'; end if;
  return e;
end $$;
revoke execute on function public.extend_pro(uuid, int, text, text) from public, anon, authenticated;
grant execute on function public.extend_pro(uuid, int, text, text) to service_role;

-- 6. AI allowance: the trial's is for the whole trial; Pro's is for 30 days from the latest payment.
create or replace function public.ai_budget(p_user uuid default auth.uid())
returns table (spent_micro_usd bigint, cap_micro_usd bigint, plan_code text, status text, trial_ends_at timestamptz, current_period_end timestamptz)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(u.cost_micro_usd) from public.ai_usage u
              where u.user_id = p_user and u.created_at >= case
                when s.status = 'trialing' then coalesce(s.trial_started_at, s.created_at)
                else greatest(now() - interval '30 days',
                              coalesce((select max(coalesce(pm.reviewed_at, pm.created_at)) from public.payments pm
                                        where pm.user_id = p_user and pm.status = 'approved'), '-infinity'::timestamptz)) end), 0)::bigint,
    coalesce(p.ai_monthly_cap_micro_usd, 0)::bigint,
    s.plan_code, s.status, s.trial_ends_at, s.current_period_end
  from public.subscriptions s join public.plans p on p.code = s.plan_code
  where s.user_id = p_user
    and (p_user = auth.uid() or auth.role() = 'service_role');
$$;
drop function if exists public.ai_budget_old(uuid);

-- 7. The trial is 5 days.
update public.plans set name = 'Pro trial (5 days)', trial_days = 5 where code = 'trial';
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare d int;
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  select trial_days into d from public.plans where code = 'trial';
  insert into public.subscriptions (user_id, plan_code, status, trial_started_at, trial_ends_at)
  values (new.id, 'trial', 'trialing', now(), now() + make_interval(days => coalesce(nullif(d, 0), 5)))
  on conflict (user_id) do nothing;
  return new;
end $$;

-- 8. Indexes for foreign keys used in filters and cascades.
create index if not exists matches_job_id_idx on public.matches(job_id);
create index if not exists reminders_user_id_idx on public.reminders(user_id);
create index if not exists application_events_user_id_idx on public.application_events(user_id);
