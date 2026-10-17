# Build notes

Date: 2026-10-17. Checks were run in `/home/claude/job-switcher` (branch `initial-app`) on Node 22, with placeholder `NEXT_PUBLIC_*` values for the build. No real Supabase project, AI key, bKash account or email provider was available, so nothing was run against live services.

## Results, second delivery (Cloudflare, CV photos, bKash, alert parsing)

```
$ npm run typecheck        -> tsc --noEmit            exit 0
$ npm run lint             -> eslint .                exit 0 (0 problems)
$ npm test                 -> vitest run
 Test Files  17 passed (17)
      Tests  98 passed (98)
$ npx next build           -> exit 0
✓ Compiled successfully
✓ Generating static pages using 3 workers (31/31)
  ƒ Proxy (Middleware)
$ npx opennextjs-cloudflare build                    -> OpenNext build complete.
$ npx wrangler deploy --dry-run --outdir <scratch>
  Total Upload: 11295.16 KiB / gzip: 2313.55 KiB     (was 19156.58 KiB / gzip 3892.32 KiB; free-plan limit 3 MB gzip)
$ workers/email-intake: tsc --noEmit                  exit 0
$ workers/email-intake: wrangler deploy -c wrangler.toml --dry-run   Total Upload: 2.65 KiB / gzip: 1.33 KiB
```

Where the bundle saving came from (server bundle, before -> after):

| Change | Effect |
|---|---|
| PDF/DOCX parsing moved to the browser (`unpdf`, `mammoth` behind the `cv-browser-libs` alias, stubbed in server builds) | about 1.9 MB raw removed (`unpdf` 1.76 MB, `mammoth` and its zip/xml deps) |
| `@google/genai` replaced by a fetch-based REST adapter | about 600 KB raw per copy removed (the SDK, `google-auth-library`, `gaxios`, `node-fetch`, web-streams polyfills); Turbopack had duplicated this chunk in 4 places |
| Kept | `@anthropic-ai/sdk` (about 440 KB raw per chunk copy) stays: the project uses the official SDK for Claude. Supabase clients and the Next.js runtime are the rest. |

Database: all 5 migrations were applied to a local Postgres 16 (with `supabase/tests/local_supabase_shim.sql`), then `supabase/tests/rls_test.sql` ran. New checks, all as expected:

- A user cannot insert a payment (`permission denied for table payments`) or update one, and cannot set their subscription to `active`.
- A user sees only their own payments; user B sees none of A's.
- The service role can record a pending manual payment; a second payment with the same TrxID is refused (`payments_trx_id_key`); a manual payment without TrxID/number is refused (`payments_manual_fields`).
- `ai_budget()` returns `current_period_end`.
- All earlier checks (trial on sign-up, own-row access, "applied" only by the user, storage folders, cascade delete) still pass.

Tests per file:

| Tests | File |
|---|---|
| 15 | matching |
| 11 | inbound/alerts (synthetic alert emails) |
| 9 | billing (TrxID/number checks, periods, env config, admin allowlist, bKash client and verification) |
| 8 | numbers-check |
| 7 | cv/render |
| 7 | ingest |
| 6 | cv/browser-read (real PDF and DOCX through the browser module) |
| 6 | ai/budget |
| 5 | facts |
| 5 | inbound/gmail |
| 5 | scripts/ingest/fetch-source |
| 4 | worker handler |
| 3 | server/transcribe (page limits and image checks) |
| 3 | ai/gemini (REST adapter with a fake fetch) |
| 2 | server/inbound (AI gap-fill merge) |
| 1 | inbound/signature |
| 1 | server/reminders |

## What changed in the second delivery

### 1. Cloudflare Workers (free plan)
- CV text extraction runs in the browser (`src/lib/cv/browser-read.ts`). The server gets the extracted text plus the original file, validates the file by magic bytes (`src/lib/cv/sniff.ts`) and stores it privately as before. Plain text files are still decoded on the server.
- Gemini goes through `fetch` (`src/lib/ai/gemini.ts`); `@google/genai` is uninstalled.
- CI now also runs the OpenNext build and the wrangler dry run, so bundle growth shows up in every PR.
- README has the Cloudflare deploy steps, the CPU-heavy routes and when Workers Paid is needed. `maxDuration` exports stay; OpenNext ignores them and the build passes with them.

### 2. CV from a photo or a scanned PDF
- Upload step: "Take a photo of your CV" (camera capture, up to 4 pages, thumbnails, remove), image files (JPG/PNG/WebP, HEIC where the browser can decode it), and image-only PDFs (the first 4 pages are rendered with pdf.js at about 1600 px on the long edge, JPEG 0.85).
- `POST /api/cv/transcribe` checks 1 to 4 pages of at most 3 MB each by magic bytes, then calls the fast tier with vision (`readImages`, metered as `cv_ocr` and refused when over budget). The prompt asks for a faithful transcription in reading order, with `[unclear]` for unreadable words and no additions.
- The user sees the text in an editable box and must confirm it. The text then goes through the normal extraction and grounding flow (`text_source = 'ocr'`). For a scanned PDF, the PDF itself is stored privately like any CV file. Page images are never written to storage.

### 3. bKash payments
- Manual path, `/upgrade` and `/admin/payments`, and Tokenized Checkout: see README section 5.
- Migration `20261017000005_payments.sql`: the `payments` table with RLS (users can read their own rows; there are no write policies) and unique TrxIDs and paymentIDs. `ai_budget()` now returns `current_period_end`, and `checkBudget` refuses AI once a paid month has lapsed (`plan_expired`).
- Approving a payment extends `subscriptions.current_period_end` by 30 days, counted from the current end if the user is still active and from now otherwise. It sets `status = active` and `plan_code = pro`, and emails the user. Rejecting emails the user with the admin's note.

### 4. Alert emails
- `src/lib/inbound/alerts.ts` is a deterministic parser for HTML and plain-text alerts. Tracking links are unwrapped when the original URL is in a query parameter (plain or base64), and job URLs are canonicalised per portal. The portal comes from the sender domain, or else from the link domains.
- AI (fast tier) runs only for missing titles or companies, in one call per email. A value the AI fills is kept only if it appears in the email text. If no job links are recognised but the email looks like an alert, the earlier whole-email AI parse is the fallback. When AI is unavailable, the deterministic jobs are still stored.
- Jobs are deduped by canonical URL (the existing unique index) and by normalised (title, company), including against the user's alert jobs from the last 60 days. Each job is stored with the alert's own fields and link in `raw.alert`. No page is ever fetched.

## Still unverified or stubbed (second delivery)

- **bKash Tokenized Checkout has never run against bKash.** We could not check it against bKash's official API reference: developer.bka.sh was not reachable from here. Endpoints, headers and fields follow the v1.2.0-beta Tokenized Checkout flow as implemented by a maintained open-source integration (karim007/laravel-bkash-tokenize). Items marked `TODO(bkash)` in code:
  - production base URL `https://tokenized.pay.bka.sh/v1.2.0-beta` (sandbox `https://tokenized.sandbox.bka.sh/v1.2.0-beta`);
  - `mode: "0011"` for URL-based checkout without an agreement;
  - `payerReference` allowed characters and length (we send our invoice number);
  - amount format `"199"` versus `"199.00"`;
  - whether the status query returns `merchantInvoiceNumber` or `merchantInvoice` (both are accepted);
  - how often the grant-token call may be made (the token is cached per isolate until 5 minutes before `expires_in`);
  - callback `signature` parameter: not verified, because we do not rely on the callback (we query bKash);
  - payments left `Initiated` or `Pending` after execute are marked failed; a scheduled re-query job would recover late completions;
  - refunds are not implemented.
- **TrxID format:** bKash publishes none. We accept 8 to 12 upper-case letters and digits.
- **The manual path depends on the owner's review.** Nothing reads the bKash statement automatically. A personal account has no API, so this cannot be automated without a merchant account.
- **Alert parsing was tuned on synthetic emails only.** The fixtures in `src/lib/inbound/__fixtures__/alerts/` were written by hand, have invented companies and IDs, and are marked SYNTHETIC. **Tuning against a real Bdjobs alert email is still pending**, as are real LinkedIn, Bayt, GulfTalent, Naukrigulf, JobStreet, SEEK, Indeed and Reed alerts. The Bdjobs detail-link shapes (`jobdetails.asp?id=`, `/jobs/details/<id>`, `/h/details/<id>`) are a best guess (`TODO(bdjobs-alerts)`).
- **The transcription quality of the vision model on real Bangladeshi CV photos is untested,** because there was no AI key. There is no on-device OCR fallback: without AI, photos cannot be read.
- **The Free-plan CPU limit (10 ms) was not measured,** because no Cloudflare account was used. See the README for which routes are heavy; expect to need Workers Paid for real use.

## Done (first delivery)

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

## Stubbed or not implemented (first delivery; updated)

- ~~Payments~~: done in the second delivery (bKash manual + Tokenized Checkout). SSLCommerz is not integrated.
- ~~OCR~~: done in the second delivery (AI vision transcription with user review).
- **Alert formats:** a deterministic parser now exists, but real sample alert emails are still needed to tune it (see above).
- **Ingestion sources:** the seed contains only inactive example sources. Real, permitted public careers pages or ATS boards must be added.
- **No rate limiting** on the API routes beyond the per-user AI cap and Supabase Auth's own limits.
- **No new-match notification email**; only "apply later" reminders are sent. The `matches` table is filled and ready for this.
- **No screenshots** in the setup guide; it has text steps only.
- **No end-to-end/browser tests**, and no test against a live Supabase instance (no Docker or Supabase CLI here).

## Known gaps / risks

- The Supabase Magic Link email template should be changed as the README shows. Without the change, link sign-in works only in the browser that requested it; code sign-in always works.
- Inbound raw email is decoded as UTF-8. Unusual 8-bit charsets in non-MIME mail could be garbled, but standard MIME alerts are handled by postal-mime.
- The OpenNext/Cloudflare deployment builds and passes `wrangler deploy --dry-run`, but has not been deployed to a real account.
