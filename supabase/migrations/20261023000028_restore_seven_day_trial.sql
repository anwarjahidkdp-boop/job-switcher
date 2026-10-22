-- Restore the agreed seven-day full-feature trial for new accounts.
-- Do not retroactively modify existing subscriptions or paid periods.
update public.plans
set name = 'Pro trial (7 days)', trial_days = 7
where code = 'trial';
