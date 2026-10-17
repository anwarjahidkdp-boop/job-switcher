-- Pro price per country the user lives in (profiles.home_country). plans.price_minor stays the Bangladesh price,
-- which is what bKash charges; other countries are shown until an international payment provider is added.
create table public.plan_prices (
  plan_code   text not null references public.plans(code) on delete cascade,
  country     text not null references public.country_rules(code),
  currency    text not null check (currency ~ '^[A-Z]{3}$'),
  price_minor int not null check (price_minor > 0),
  primary key (plan_code, country)
);

alter table public.plan_prices enable row level security;
create policy plan_prices_read on public.plan_prices for select to anon, authenticated using (true);

insert into public.plan_prices (plan_code, country, currency, price_minor) values
  ('pro', 'BD', 'BDT', 19900),
  ('pro', 'AE', 'AED', 2900),
  ('pro', 'SA', 'SAR', 2900),
  ('pro', 'MY', 'MYR', 1500),
  ('pro', 'GB', 'GBP', 799),
  ('pro', 'CA', 'CAD', 1299),
  ('pro', 'AU', 'AUD', 1499),
  ('pro', 'US', 'USD', 999),
  ('pro', 'XX', 'USD', 499)
on conflict (plan_code, country) do update set currency = excluded.currency, price_minor = excluded.price_minor;
