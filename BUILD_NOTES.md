# Build notes

Date: 2026-10-17. All checks below were run in `/home/claude/job-switcher-app` on Node 22. They used placeholder `NEXT_PUBLIC_*` values for the build. No real Supabase project, AI key or email provider was available, so nothing was run against live services.

## Results (verbatim summary lines)

```
$ npm run typecheck        -> tsc --noEmit            exit 0
$ npm run lint             -> eslint .                exit 0 (0 problems)
$ npm test                 -> vitest run
 Test Files  12 passed (12)
      Tests  68 passed (68)
$ npm run build            -> next build (Next.js 16.4.2, Turbopack)
✓ Compiled successfully in 3.8s
  Finished TypeScript in 7.8s ...
✓ Generating static pages using 3 workers (26/26) in 676ms
  (28 routes: 27 dynamic + /_not-found; Proxy active)
$ workers/email-intake: tsc --noEmit                  exit 0
$ workers/email-intake: wrangler deploy --dry-run     Total Upload: 2.65 KiB / gzip: 1.33 KiB
```

Tests per file:

| Tests | File |
|---|---|
| 15 | matching |
| 8 | numbers-check |
| 7 | cv/render |
| 7 | ingest |
| 5 | facts |
| 5 | cv/extract-text (real PDF and DOCX) |
| 5 | inbound/gmail |
| 5 | ai/budget |
| 5 | scripts/ingest/fetch-source |
| 4 | worker handler |
| 1 | inbound/signature |
| 1 | server/reminders |

Database: the 3 migrations and `supabase/seed.sql` were applied to a local Postgres 16, with `supabase/tests/local_supabase_shim.sql` standing in for Supabase's `auth`/`storage` schemas and roles. The seed gave 9 country rules and 32 sample jobs. `supabase/tests/rls_test.sql` then confirmed all of these:

- A sign-up creates a 7-day trial.
- A user sees only their own profile and applications, plus public jobs.
- A user can insert a pasted job for themselves, but not a public job or one owned by someone else.
- A user can mark an application "applied". The service role is refused: "status applied can only be set by the user (confirmed in the app)".
- Users cannot write events with actor=system, `forwarding_addresses`, `ai_usage` or `subscriptions`.
- Storage writes are limited to the user's own folder, and user B sees none of A's objects.
- `ensure_forwarding_address` is idempotent.
- `ai_budget()` returns cap 500000 micro-USD for a trial.
- Deleting a user cascades and removes all of their rows.

Smoke run of `next start` with placeholder env:

| Request | Result |
|---|---|
| `/`, `/login` | 200 |
| `/inbox` | 307 to `/login?next=%2Finbox` |
| POST `/api/inbound/email` unsigned | 401 `bad signature` |
| `/api/cron/reminders` with no token | 401 |

## Done

- **Prototype port.**
  - Country onboarding with the `COUNTRIES` rules (also in the `country_rules` table).
  - CV upload (PDF, DOCX or TXT, or pasted text) or the demo CV, then AI extraction with grounding.
  - Up to 5 follow-up questions, then preferences, then the reveal.
  - Master CV: 3 templates (modern, executive, classic) with accents and an optional photo (private storage, signed URL), shown where the country rules allow it. Exports as Word .doc and as a print/PDF page.
  - Deterministic `scoreJob` with the exact weights, bands and cap-69 rules.
  - Opportunities inbox and "why this job" with gaps.
  - Application pack: tailored CV, cover letter, email, checklist and numbers check. Uses AI when it is configured; otherwise a template pack.
  - Apply later with a reminder date, the queue, and the tracker (status changes come only from the user).
  - Insights: skill demand and impact, and an AI roadmap.
  - Profile: country, visa, skills, fact review, data export and account deletion.
  - The 5-step forwarding setup guide, which shows the live Gmail verification code.
- **Provenance.**
  - Every fact is stored as `career_facts` with provenance `cv`, `answer` or `user`, plus `verified` and `evidence`.
  - Generators receive only verified facts.
  - `checkMasterCv` and `checkPack` run server-side on every AI output. They drop unverified employers and skills and flag unknown numbers. The flags are shown to the user.
- **AI.** `AIProvider` has an Anthropic implementation (structured outputs via zod) and a Gemini implementation.
  - Tiers: Haiku is the fast tier and Sonnet the quality tier.
  - Every call is metered per user, with a trial or monthly cap enforced before the call.
  - Errors are typed and carry user-facing messages.
- **Inbound email.** The Cloudflare Email Worker passes mail to an HMAC-signed endpoint.
  - The raw message is kept privately.
  - Gmail forwarding-verification codes are detected; the sender and DKIM/SPF are checked.
  - Alerts are parsed by AI into private jobs, and duplicates are skipped by message id.
- **Ingestion.** `scripts/ingest` reads JSON-LD job postings and the public Greenhouse and Lever endpoints.
  - It checks robots.txt, identifies itself with its own user agent, caps response size and sets timeouts.
  - Jobs are upserted on (source, external id).
  - Stale and expired listings are retired.
  - Matches are refreshed for users in the affected countries.
- **Reminders.** Run by `scripts/reminders`, hourly via GitHub Actions, or `/api/cron/reminders`.
  - Each user is emailed on the due date in their country's time zone, from 08:00 local time.
  - Sending uses Resend or Brevo.
- **CI.** `.github/workflows/ci.yml` runs typecheck, lint, test and build.

## Deviations from the prototype (intentional)

- Certification matching uses whole words, so "ACCA" no longer satisfies "CA". The prototype matched substrings.
- The visa cap applies when the job's country differs from the user's home country and the user needs a visa. The prototype assumed Bangladesh as home.
- Facts that the AI extracted but could not be found in the CV text are kept as unverified, for the user to review in Profile. They are never used by generators.

## Stubbed or not implemented

- **Payments:** `/api/billing/checkout` returns 501. The `pro` plan (৳199/month) exists in `plans`, but there is no bKash/SSLCommerz integration.
- **OCR:** scanned or image-only PDFs are rejected with a message asking the user to paste the text.
- **Bdjobs and LinkedIn alert formats:** alerts are parsed by AI only. There is no format-specific parser yet, and real sample alert emails are needed to tune the parsing and add tests.
- **Ingestion sources:** the seed contains only inactive example sources. Real, permitted public careers pages or ATS boards must be added.
- **No rate limiting** on the API routes beyond the per-user AI cap and Supabase Auth's own limits.
- **No new-match notification email**; only "apply later" reminders are sent. The `matches` table is filled and ready for this.
- **No screenshots** in the setup guide; it has text steps only.
- **No end-to-end/browser tests**, and no test against a live Supabase instance (no Docker or Supabase CLI here).

## Known gaps / risks

- `maxDuration = 120` on the AI routes needs Vercel Fluid compute, which is on by default for new projects. Otherwise, lower it to 60.
- The Supabase Magic Link email template should be changed as the README shows. Without the change, link sign-in works only in the browser that requested it; code sign-in always works.
- Inbound raw email is decoded as UTF-8. Unusual 8-bit charsets in non-MIME mail could be garbled, but standard MIME alerts are handled by postal-mime.
- The OpenNext/Cloudflare deployment path is documented but has not been tested.
