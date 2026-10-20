-- Bangladesh Pro price lowered to ৳190 / 30 days (owner decision 2026-10-20).
update public.plans set price_minor = 19000 where code = 'pro' and currency = 'BDT';
update public.plan_prices set price_minor = 19000 where plan_code = 'pro' and country = 'BD';
