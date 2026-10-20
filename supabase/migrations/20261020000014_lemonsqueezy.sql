-- Card payments through Lemon Squeezy for people living outside Bangladesh (owner decision 2026-10-20).
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check check (method = any (array['bkash_manual', 'bkash_checkout', 'lemonsqueezy']));
alter table public.payments add column if not exists provider_order_id text;
create unique index if not exists payments_provider_order_id_key on public.payments (provider_order_id) where provider_order_id is not null;

-- Outside Bangladesh no price is under US$9 (owner decision 2026-10-20). Price follows the country the user lives in.
-- Prices now live in src/lib/billing/pricing.ts (four packs, priced by the country the user lives in); keep the 30-day row in step.
update public.plans set price_minor = 70000 where code = 'pro';
update public.plan_prices set price_minor = 70000 where plan_code = 'pro' and country = 'BD';
