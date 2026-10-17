-- Bangladesh Pro price raised to ৳299 / 30 days (owner decision 2026-10-17).
update public.plans set price_minor = 29900 where code = 'pro' and currency = 'BDT';
update public.plan_prices set price_minor = 29900 where plan_code = 'pro' and country = 'BD';
