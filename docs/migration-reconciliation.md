# Production migration baseline, 23 October 2026 (Asia/Dhaka)

Target only `job-switcher`, project `hplxsueitluutdbkbupi`, PostgreSQL 17, Seoul.

The original production migrations used execution-time versions while Git files used sequence versions. Absence of a Git timestamp from Supabase history is not evidence its SQL is missing. Do not replay the chain against existing production or rewrite its history blindly.

| Git migration | Production history/effect verified |
| --- | --- |
| 001 schema | `20261017121121_schema` |
| 002 RLS | `20261017121140_rls` |
| 003 country seeds | `20261017121209_seed_country_rules` |
| 004 CV source | `20261017121236_cv_text_source` |
| 005 payments | `20261017121248_payments`; additional `20261017121403_ai_budget_period_end` |
| 006 harden functions | `20261017121315_harden_functions` |
| 007 prices | `20261017122939_plan_prices` |
| 008 Bangladesh price | `20261017180709_bd_price_299` |
| 009 Gmail | `20261017182619_gmail_connections` |
| 010 interviews | `20261017184620_interviews` |
| 011 rename | `20261017184920_rename_jobpao` |
| 012 Gmail confirmation | `20261020133722_gmail_confirm_link` |
| 013 Bangladesh price | `20261020180622_bd_price_190` |
| 014 Lemon Squeezy | `20261020234630_lemonsqueezy` |
| 015 sources | `20261021100801_more_sources` |
| 016 countries | `20261021102939_all_countries` |
| 017 notifications | `20261021103538_notifications` |
| 018 admin statistics | `20261021104052_admin_stats` |
| 019 UK market | `uk_sponsors` table, its authenticated read policy, and supported source kinds exist; no separate matching history entry |
| 020 source kinds | `20261021115248_jobs_source_kinds` |
| 021 match check | `20261021135647_match_ai_check` |
| 022 AI score | `20261021140140_match_ai_score` |
| 023 AI chance | `20261021140813_match_ai_chance` |
| 024 hardening | Effects present: allowlisted profile UPDATE; limits/country-lock triggers; `sending_at`; applied-job SELECT policy; current-CV unique indexes; payment FK/status; `extend_pro`; owner-scoped `ai_budget`; five-day signup function; FK indexes. No separate matching history entry |
| 025 tidy | Trigger/helper execute grants absent for anon/authenticated; no repeated revoke |
| 026 Career Safety | `20261022213140_career_safety`, both JSONB columns present |
| 027 Career Safety grants | Both authenticated column UPDATE grants present; real-role save/reload verified in a rollback transaction |

This is a semantic baseline, not a claim that legacy statement text is byte-identical. Catalog checks were made against columns, indexes, policies, trigger/function definitions and grants; historical plan price migrations were not replayed. Current checkout pricing remains in `src/lib/billing/pricing.ts`; legacy `plans.price_minor` does not override approved pack prices.

New migrations have exact production version/name parity:

- `20261022221817_atomic_payment_settlement.sql`
- `20261022221836_atomic_cv_replacement.sql`
- `20261022221837_email_delivery_outbox.sql`
- `20261022221839_atomic_ai_reservation.sql`
- `20261022222537_gmail_allowance_claim.sql`

All five were applied additively and checked in production. Synthetic transaction checks rolled back signup, profile persistence, CV, Master CV, payment and AI reservation data; no employer mail or provider payment was initiated. Trial remained `Pro trial (5 days)`, `trial_days=5` afterward. A disposable database also replays the full repository chain; this does not authorize replaying it on production.
