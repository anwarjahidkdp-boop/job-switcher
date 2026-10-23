-- Newly approved Bangladesh purchase prices. Existing payment amounts and entitlements remain immutable.
update public.plans set price_minor=65000 where code='pro' and currency='BDT';
insert into public.plan_prices(plan_code,country,currency,price_minor) values('pro','BD','BDT',65000)
on conflict(plan_code,country) do update set currency=excluded.currency,price_minor=excluded.price_minor;
