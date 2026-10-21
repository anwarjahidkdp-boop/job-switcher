-- One JSON summary for the owner's admin dashboard (/admin). Service role only.
create or replace function public.admin_stats() returns jsonb
language sql stable security definer set search_path = public as $$
with p as (select * from profiles),
s as (select * from subscriptions),
pay as (select user_id, count(*) n from payments where status = 'approved' group by user_id),
a as (select * from applications)
select jsonb_build_object(
  'users', (select count(*) from p),
  'onboarded', (select count(*) from p where onboarding_step = 'done'),
  'signups_7d', (select count(*) from p where created_at > now() - interval '7 days'),
  'signups_30d', (select count(*) from p where created_at > now() - interval '30 days'),
  'by_target', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (select p.target_country code, cr.name, count(*) n from p join country_rules cr on cr.code = p.target_country group by 1, 2) x),
  'by_home', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (select p.home_country code, cr.name, count(*) n from p join country_rules cr on cr.code = p.home_country group by 1, 2) x),
  'trial_active', (select count(*) from s where status = 'trialing' and trial_ends_at > now()),
  'trial_ended', (select count(*) from s where trial_ends_at <= now()),
  'trial_ended_unpaid', (select count(*) from s where trial_ends_at <= now() and user_id not in (select user_id from pay)),
  'paid_users', (select count(*) from pay),
  'pro_active', (select count(*) from s where status = 'active' and (current_period_end is null or current_period_end > now())),
  'renewed', (select count(*) from pay where n >= 2),
  'lapsed', (select count(*) from s where user_id in (select user_id from pay) and (status in ('expired', 'canceled', 'past_due') or (status = 'active' and current_period_end <= now()))),
  'revenue', (select coalesce(jsonb_agg(x), '[]') from (select currency, sum(amount_minor) total, sum(amount_minor) filter (where created_at > now() - interval '30 days') last_30d, count(*) n from payments where status = 'approved' group by 1) x),
  'pending_payments', (select count(*) from payments where status = 'pending'),
  'apps_by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from a group by 1) x),
  'packs_prepared', (select count(*) from a where pack is not null),
  'users_applied', (select count(distinct user_id) from a where status in ('applied', 'interview', 'offer', 'closed')),
  'users_interview', (select count(distinct user_id) from a where status in ('interview', 'offer')),
  'users_offer', (select count(distinct user_id) from a where status = 'offer'),
  'jobs_active', (select count(*) from jobs where active),
  'jobs_new_24h', (select count(*) from jobs where created_at > now() - interval '1 day'),
  'jobs_by_country', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (select j.country code, cr.name, count(*) n from jobs j join country_rules cr on cr.code = j.country where j.active group by 1, 2 order by 3 desc limit 12) x),
  'sources', (select jsonb_build_object('active', count(*) filter (where active), 'ok', count(*) filter (where active and last_status = 'ok'), 'error', count(*) filter (where active and last_status = 'error')) from ingestion_sources),
  'ai_spend_month_micro', (select coalesce(sum(cost_micro_usd), 0) from ai_usage where created_at >= date_trunc('month', now())),
  'recent', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
     select p.email, p.full_name, p.target_country, p.home_country, p.onboarding_step, p.created_at, s.status, s.trial_ends_at, s.current_period_end,
       (select count(*) from a where a.user_id = p.id and a.status in ('applied', 'interview', 'offer', 'closed')) applied,
       (select count(*) from a where a.user_id = p.id and a.status in ('interview', 'offer')) interviews
     from p left join s on s.user_id = p.id order by p.created_at desc limit 25) x)
);
$$;
revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to service_role;
