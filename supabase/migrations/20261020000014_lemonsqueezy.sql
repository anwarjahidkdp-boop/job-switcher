-- Card payments through Lemon Squeezy for people looking for work outside Bangladesh (owner decision 2026-10-20).
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check check (method = any (array['bkash_manual', 'bkash_checkout', 'lemonsqueezy']));
alter table public.payments add column if not exists provider_order_id text;
create unique index if not exists payments_provider_order_id_key on public.payments (provider_order_id) where provider_order_id is not null;

-- Outside Bangladesh no price is under US$9 (owner decision 2026-10-20). Price follows the target country.
update public.plan_prices set price_minor = 3500 where plan_code = 'pro' and country in ('AE', 'SA');
update public.plan_prices set price_minor = 4200 where plan_code = 'pro' and country = 'MY';
update public.plan_prices set price_minor = 900 where plan_code = 'pro' and country = 'XX';
