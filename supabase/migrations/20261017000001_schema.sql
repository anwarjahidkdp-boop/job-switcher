-- Job Switcher: core schema.
-- Conventions: every user-owned row carries user_id (or id for profiles) referencing auth.users with ON DELETE CASCADE,
-- so "delete my data" removes everything. RLS is enabled in the next migration on every table.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table public.country_rules (
  code             text primary key check (code ~ '^[A-Z]{2}$'),
  name             text not null,
  short_name       text,
  currency_symbol  text not null default '',
  salary_period    text not null check (salary_period in ('month','year')),
  number_locale    text not null default 'en-US',
  photo            boolean not null,
  personal_details boolean not null,
  visa_field       boolean not null default false,
  doc_label        text not null check (doc_label in ('CV','Résumé')),
  pages            text not null,
  default_template text not null check (default_template in ('modern','executive','classic')),
  one_page         boolean not null default false,
  rules            text[] not null default '{}',
  prompt           text not null,
  checklist        text[] not null default '{}',
  portals          text[] not null default '{}',
  time_zone        text not null default 'UTC',
  sort             int not null default 100
);

create table public.plans (
  code                     text primary key,
  name                     text not null,
  price_minor              int not null default 0,         -- e.g. 19900 = ৳199.00
  currency                 text not null default 'BDT',
  billing_interval         text not null default 'month' check (billing_interval in ('none','month','year')),
  trial_days               int not null default 0,
  ai_monthly_cap_micro_usd bigint not null default 0,      -- AI spend allowed per user per calendar month (1 USD = 1,000,000)
  features                 jsonb not null default '{}'::jsonb,
  active                   boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text,
  full_name        text,
  phone            text,
  city             text,
  target_country   text not null default 'BD' references public.country_rules(code),
  home_country     text not null default 'BD' references public.country_rules(code),
  needs_visa       boolean not null default true,
  personal         jsonb not null default '{}'::jsonb,   -- {nationality, dob, visa}; shown on CVs only where the country expects it
  preferences      jsonb,                                -- {roles, locations, salaryMin, salaryMax, notice, mode}
  career_meta      jsonb not null default '{}'::jsonb,   -- {industries, categories, seniority, target_roles, location} from the CV
  cv_style         jsonb not null default '{}'::jsonb,   -- {tpl, accent}
  photo_path       text,                                 -- private storage path in bucket cv-files
  onboarding_step  text not null default 'country' check (onboarding_step in ('country','upload','questions','prefs','reveal','done')),
  setup_steps      jsonb not null default '{}'::jsonb,   -- automatic-jobs guide: {address, alerts, forward, filter, test}
  dismissed_job_ids uuid[] not null default '{}',
  email_reminders  boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references auth.users(id) on delete cascade,
  plan_code          text not null references public.plans(code),
  status             text not null check (status in ('trialing','active','past_due','expired','canceled')),
  trial_started_at   timestamptz,
  trial_ends_at      timestamptz,
  current_period_end timestamptz,
  payment_provider   text,           -- deferred: 'bkash' later. Never store card or wallet credentials here.
  payment_ref        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CVs and career facts
-- ---------------------------------------------------------------------------
create table public.cv_documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  storage_path text,                  -- private bucket cv-files/<user_id>/...; null for pasted text
  file_name    text,
  mime_type    text,
  size_bytes   int,
  text_content text not null,
  extraction   jsonb,                 -- raw AI extraction (kept for audit; facts are the source of truth)
  questions    jsonb not null default '[]'::jsonb,
  answers      jsonb not null default '{}'::jsonb,
  is_demo      boolean not null default false,
  is_current   boolean not null default true,
  created_at   timestamptz not null default now()
);
create index cv_documents_user_idx on public.cv_documents(user_id, created_at desc);

create table public.career_facts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  cv_document_id uuid references public.cv_documents(id) on delete set null,
  kind           text not null check (kind in ('experience','education','certification','skill','language','answer')),
  data           jsonb not null,
  provenance     text not null check (provenance in ('cv','answer','user')),
  verified       boolean not null default false,  -- generators only use verified facts
  evidence       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index career_facts_user_idx on public.career_facts(user_id, kind);

create table public.master_cvs (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  version               int not null default 1,
  content               jsonb not null,
  flags                 text[] not null default '{}',   -- deterministic post-check results
  ai                    boolean not null default false,
  model                 text,
  source_cv_document_id uuid references public.cv_documents(id) on delete set null,
  is_current            boolean not null default true,
  created_at            timestamptz not null default now()
);
create index master_cvs_user_idx on public.master_cvs(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
create table public.ingestion_sources (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('jsonld','greenhouse','lever')),
  name         text not null,
  url          text,          -- jsonld: public careers page URL
  board_token  text,          -- greenhouse board token / lever company slug
  country      text not null references public.country_rules(code),
  company      text,
  active       boolean not null default true,
  last_run_at  timestamptz,
  last_status  text,
  last_error   text,
  jobs_found   int not null default 0,
  created_at   timestamptz not null default now(),
  constraint ingestion_sources_target check ((kind = 'jsonld' and url is not null) or (kind <> 'jsonld' and board_token is not null))
);

create table public.jobs (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid references auth.users(id) on delete cascade,   -- null = public listing; set = private to that user (paste / alert)
  source_id         uuid references public.ingestion_sources(id) on delete set null,
  source_kind       text not null check (source_kind in ('paste','email_alert','jsonld','greenhouse','lever','curated','sample')),
  source_label      text not null,
  external_id       text,
  country           text not null references public.country_rules(code),
  title             text not null,
  company           text not null,
  industry          text,
  category          text,
  location          text,
  employment_type   text,
  salary_min        numeric,
  salary_max        numeric,
  min_years         numeric,
  max_years         numeric,
  seniority         text check (seniority in ('entry','mid','senior','manager','head')),
  education         jsonb,          -- {level, field}
  required_skills   text[] not null default '{}',
  preferred_skills  text[] not null default '{}',
  certs             jsonb not null default '[]'::jsonb,   -- [{names:[...], required:bool}]
  visa_sponsorship  boolean,        -- true offered, false explicitly not offered, null unknown
  deadline          date,
  published_at      date,
  apply_method      text not null default 'unknown' check (apply_method in ('email','portal','unknown')),
  apply_target      text,
  url               text,
  responsibilities  text[] not null default '{}',
  description       text,
  is_sample         boolean not null default false,
  active            boolean not null default true,
  raw               jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- Plain (non-partial) unique indexes so PostgREST upserts can target them; NULLs never conflict in Postgres.
create unique index jobs_source_external_uq on public.jobs(source_id, external_id);
create unique index jobs_owner_url_uq on public.jobs(owner_id, url);
create index jobs_country_active_idx on public.jobs(country, active, deadline);
create index jobs_owner_idx on public.jobs(owner_id);

create table public.matches (
  user_id      uuid not null references auth.users(id) on delete cascade,
  job_id       uuid not null references public.jobs(id) on delete cascade,
  score        int not null check (score between 0 and 100),
  band         text not null check (band in ('ex','st','po','lo')),
  relevant     boolean not null,
  capped       boolean not null default false,
  reason       text,
  matched      text[] not null default '{}',
  gaps         jsonb not null default '[]'::jsonb,
  computed_at  timestamptz not null default now(),
  notified_at  timestamptz,
  primary key (user_id, job_id)
);

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------
create table public.applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  job_id        uuid not null references public.jobs(id) on delete cascade,
  status        text not null default 'preparing' check (status in ('preparing','ready','reminder','waiting','applied','interview','offer','closed','withdrawn')),
  pack          jsonb,
  pack_flags    text[] not null default '{}',
  pack_ai       boolean not null default false,
  pack_model    text,
  reminder_date date,
  applied_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, job_id)
);

create table public.application_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  event          text not null,
  status         text,
  actor          text not null default 'user' check (actor in ('user','system')),
  created_at     timestamptz not null default now()
);
create index application_events_app_idx on public.application_events(application_id, created_at);

create table public.reminders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null unique references public.applications(id) on delete cascade,
  job_id         uuid not null references public.jobs(id) on delete cascade,
  due_date       date not null,
  sent_at        timestamptz,
  send_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index reminders_due_idx on public.reminders(due_date) where sent_at is null;

-- ---------------------------------------------------------------------------
-- Automatic job intake by email forwarding
-- ---------------------------------------------------------------------------
create table public.forwarding_addresses (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references auth.users(id) on delete cascade,
  alias                    text not null unique check (alias ~ '^[a-z0-9][a-z0-9-]{3,40}$'),
  active                   boolean not null default true,
  gmail_verification_code  text,
  gmail_code_received_at   timestamptz,
  last_email_at            timestamptz,
  emails_received          int not null default 0,
  created_at               timestamptz not null default now()
);

create table public.inbound_emails (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  alias           text not null,
  message_id      text,
  from_address    text,
  subject         text,
  raw_storage_key text,       -- private bucket inbound-raw (or the worker's R2 key)
  kind            text check (kind in ('job_alert','gmail_verification','other')),
  status          text not null default 'received' check (status in ('received','processed','ignored','failed','rejected')),
  jobs_created    int not null default 0,
  error           text,
  received_at     timestamptz not null default now(),
  processed_at    timestamptz
);
create unique index inbound_emails_msgid_uq on public.inbound_emails(alias, message_id);
create index inbound_emails_user_idx on public.inbound_emails(user_id, received_at desc);

-- ---------------------------------------------------------------------------
-- AI metering
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  id             bigint generated always as identity primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  feature        text not null,
  provider       text not null,
  model          text not null,
  input_tokens   int not null default 0,
  output_tokens  int not null default 0,
  cost_micro_usd bigint not null default 0,
  ok             boolean not null default true,
  created_at     timestamptz not null default now()
);
create index ai_usage_user_month_idx on public.ai_usage(user_id, created_at);

-- ---------------------------------------------------------------------------
-- Functions and triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();
create trigger career_facts_touch before update on public.career_facts for each row execute function public.touch_updated_at();
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_updated_at();
create trigger applications_touch before update on public.applications for each row execute function public.touch_updated_at();
create trigger reminders_touch before update on public.reminders for each row execute function public.touch_updated_at();

-- New auth user => profile + 7-day trial.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare d int;
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  select trial_days into d from public.plans where code = 'trial';
  insert into public.subscriptions (user_id, plan_code, status, trial_started_at, trial_ends_at)
  values (new.id, 'trial', 'trialing', now(), now() + make_interval(days => coalesce(d, 7)))
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Hard rule: an application is marked applied / interview / offer / withdrawn only by the user themselves.
-- Background jobs run with the service role (auth.uid() is null) and are refused here.
create or replace function public.guard_user_confirmed_status() returns trigger language plpgsql as $$
begin
  if new.status in ('applied','interview','offer','withdrawn')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and (auth.uid() is null or auth.uid() <> new.user_id) then
    raise exception 'status % can only be set by the user (confirmed in the app)', new.status using errcode = '42501';
  end if;
  if new.status = 'applied' and (tg_op = 'INSERT' or old.status is distinct from 'applied') then
    new.applied_at = coalesce(new.applied_at, now());
  end if;
  return new;
end $$;

create trigger applications_guard_status before insert or update of status on public.applications
for each row execute function public.guard_user_confirmed_status();

-- AI budget for the calling user (or any user, for the service role).
create or replace function public.ai_budget(p_user uuid default auth.uid())
returns table (spent_micro_usd bigint, cap_micro_usd bigint, plan_code text, status text, trial_ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(u.cost_micro_usd) from public.ai_usage u
              where u.user_id = p_user and u.created_at >= date_trunc('month', now())), 0)::bigint,
    coalesce(p.ai_monthly_cap_micro_usd, 0)::bigint,
    s.plan_code, s.status, s.trial_ends_at
  from public.subscriptions s join public.plans p on p.code = s.plan_code
  where s.user_id = p_user
    and (p_user = auth.uid() or auth.role() = 'service_role');
$$;

-- Personal forwarding alias, generated server-side so users cannot pick someone else's.
create or replace function public.ensure_forwarding_address(p_hint text default null)
returns public.forwarding_addresses
language plpgsql security definer set search_path = public as $$
declare r public.forwarding_addresses; base text; candidate text; i int := 0;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into r from public.forwarding_addresses where user_id = auth.uid();
  if found then return r; end if;
  base := left(regexp_replace(lower(coalesce(p_hint, 'you')), '[^a-z]', '', 'g'), 12);
  if length(base) < 2 then base := 'you'; end if;
  loop
    candidate := base || '-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 6);
    begin
      insert into public.forwarding_addresses (user_id, alias) values (auth.uid(), candidate) returning * into r;
      return r;
    exception when unique_violation then
      i := i + 1; if i > 5 then raise; end if;
    end;
  end loop;
end $$;
