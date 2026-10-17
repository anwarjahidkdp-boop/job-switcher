-- Payments for Pro (৳199 / 30 days) via bKash: manual Send Money / Payment with a TrxID that an admin verifies,
-- or bKash Tokenized Checkout (merchant accounts), verified server-side by querying bKash.
-- Users can read their own payments. All writes go through server code with the service role, which validates the
-- input first; there are no insert/update policies, so a browser can never create or approve a payment itself.

create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  plan_code         text not null references public.plans(code),
  method            text not null check (method in ('bkash_manual', 'bkash_checkout')),
  amount_minor      int not null check (amount_minor > 0),    -- 19900 = ৳199.00
  currency          text not null default 'BDT',
  trx_id            text,                                      -- bKash transaction ID, upper-case
  payer_msisdn      text,                                      -- the payer's bKash number (01XXXXXXXXX)
  bkash_payment_id  text,                                      -- Tokenized Checkout paymentID
  invoice           text not null unique,                      -- our merchantInvoiceNumber / reference
  status            text not null check (status in ('initiated', 'pending', 'approved', 'rejected', 'failed', 'canceled')),
  period_days       int not null default 30,
  period_end        timestamptz,                               -- subscription end set when approved
  provider_response jsonb,                                     -- last verified bKash query/execute response (no credentials)
  review_note       text,
  reviewed_by       text,                                      -- admin email, manual payments
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint payments_manual_fields check (method <> 'bkash_manual' or (trx_id is not null and payer_msisdn is not null))
);

-- A TrxID can be used once, ever (rejected ones stay blocked so a refused ID cannot be resubmitted).
create unique index payments_trx_id_key on public.payments (trx_id) where trx_id is not null;
create unique index payments_bkash_payment_id_key on public.payments (bkash_payment_id) where bkash_payment_id is not null;
create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_pending_idx on public.payments (created_at) where status = 'pending';

create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

alter table public.payments enable row level security;
create policy payments_select_own on public.payments for select to authenticated using (user_id = (select auth.uid()));
-- Explicitly no insert/update/delete policies: only the service role writes payments.
revoke insert, update, delete on public.payments from anon, authenticated;

-- ai_budget now also returns current_period_end, so a lapsed Pro month stops AI use until renewed.
drop function if exists public.ai_budget(uuid);
create function public.ai_budget(p_user uuid default auth.uid())
returns table (spent_micro_usd bigint, cap_micro_usd bigint, plan_code text, status text, trial_ends_at timestamptz, current_period_end timestamptz)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(u.cost_micro_usd) from public.ai_usage u
              where u.user_id = p_user and u.created_at >= date_trunc('month', now())), 0)::bigint,
    coalesce(p.ai_monthly_cap_micro_usd, 0)::bigint,
    s.plan_code, s.status, s.trial_ends_at, s.current_period_end
  from public.subscriptions s join public.plans p on p.code = s.plan_code
  where s.user_id = p_user
    and (p_user = auth.uid() or auth.role() = 'service_role');
$$;
grant execute on function public.ai_budget(uuid) to authenticated, service_role;
revoke execute on function public.ai_budget(uuid) from anon, public;
