# JobPao

A personal AI career agent. It launches in Bangladesh and supports the UAE, Saudi Arabia, Malaysia, the UK, Canada, Australia, the US and "Other". It reads your CV once and builds a verified Master CV. It then scores incoming jobs with a deterministic matcher and prepares an application pack for each job you choose. The pack holds a tailored CV, a cover letter, an email and a checklist. You apply yourself; the app never applies for you.

This is a production-shaped MVP that runs on free tiers (Cloudflare Workers, Supabase, Resend/Brevo, GitHub Actions). AI is the only metered cost. The UI and behaviour are ported from `job-switcher-prototype/index.html`.

## Product rules enforced in code

| Rule | Where |
|---|---|
| Never invent qualifications, skills, employers, dates or numbers | Every career fact is stored in `career_facts` with `provenance` (`cv`, `answer` or `user`), `verified` and `evidence`. `src/lib/facts.ts` `groundExtraction` checks each AI-extracted fact against the CV text. Unverified facts never reach generators (`verifiedOnly`). `src/lib/numbers-check.ts` runs on every Master CV (`checkMasterCv`) and every pack (`checkPack`), server-side: it drops unverified employers and skills and flags numbers that are not in the user's facts. |
| Never submit on the user's behalf | Nothing sends applications. The `guard_user_confirmed_status` trigger lets only the signed-in user (`auth.uid() = user_id`) set `applied`, `interview`, `offer` or `withdrawn`. The service role is refused. |
| No job-site passwords, no logged-in scraping | No credential fields exist. Jobs come from three places: alert emails the user forwards with a Gmail filter, pasted posts, and public JSON-LD or Greenhouse/Lever endpoints. Ingestion checks `robots.txt` first. |
| CVs are private | Storage buckets `cv-files` and `inbound-raw` are private. Files are only reachable through short-lived signed URLs (60 s for the original CV, 1 h for the photo). Every user table has RLS (`supabase/migrations/*_rls.sql`, `*_payments.sql`). CV photos and scanned pages sent for transcription are never written to storage. |
| Pro is activated only after verification | A manual bKash TrxID stays `pending` until the owner approves it on `/admin/payments` (`ADMIN_EMAILS`). A Tokenized Checkout payment is activated only after the server queries bKash and the query shows `Completed` for the expected amount and invoice. TrxIDs are unique. Users cannot write `payments` or `subscriptions`. |
| Keys server-side only | Only `NEXT_PUBLIC_*` values reach the browser. AI, email, service-role and HMAC secrets are read in server modules guarded by `server-only`. |

## Architecture

```
Browser (Next.js App Router pages, server actions)
   |                                    Gmail filter forwards alert emails
   v                                              |
Next.js on Cloudflare Workers (OpenNext) -- Cloudflare Email Routing -> Email Worker (workers/email-intake)
   |  /api/*  server actions                        | HMAC-signed POST /api/inbound/email
   |                                                v
   +--> Supabase: Auth (email OTP / magic link), Postgres + RLS, private Storage
   +--> AI provider (src/lib/ai): Anthropic (Haiku = fast, Sonnet = quality) or Gemini (REST), metered per user
   +--> bKash Tokenized Checkout (optional, merchant accounts)
   +--> Resend / Brevo (reminder and payment emails)
Browser-side: PDF/DOCX text extraction (pdf.js via unpdf, mammoth), page rendering and photo downscaling
GitHub Actions cron: scripts/ingest (daily), scripts/reminders (hourly), CI
```

### Folders

- `src/lib/` holds the domain logic: plain TypeScript modules with unit tests.
  - `matching.ts` is the deterministic `scoreJob`, ported from the prototype.
    - Weights: role 25, skills 25, experience 15, seniority 10, industry 7, education 6, certifications 5, location 4, salary 3.
    - Bands: 85 / 70 / 55.
    - A required certification the user doesn't hold, or no visa sponsorship for a foreign job, caps the score at 69.
  - `facts.ts` handles provenance and grounding.
  - `numbers-check.ts` is the post-check for generated content.
  - `countries.ts` holds the per-country CV rules (photo, date of birth, nationality, length, currency, date format, portals).
  - `prompts.ts` and `ai/` hold the provider interface, Anthropic and Gemini providers, zod schemas and pricing.
  - `cv/` renders the 3 CV templates (modern, executive, classic) with accents and an optional photo and exports Word .doc and print/PDF. `cv/browser-read.ts` reads PDF/DOCX text **in the browser**, renders image-only PDF pages and downscales photos to JPEG; `cv/sniff.ts` holds the shared file checks. The PDF and Word parsers are loaded through the `cv-browser-libs` alias (`next.config.ts`), which points at a stub in server builds, so they never reach the Worker.
  - `inbound/` parses MIME, detects Gmail forwarding-verification emails, checks HMAC signatures, and (`alerts.ts`) reads job alerts deterministically: title, company, location, deadline and job link for Bdjobs, LinkedIn, Bayt, GulfTalent, Naukrigulf, JobStreet, SEEK, Indeed and Reed, unwrapping tracking links.
  - `billing/` holds the bKash helpers: TrxID/number checks, period maths, env config, and the Tokenized Checkout client.
  - `ingest/` reads JSON-LD, Greenhouse and Lever, and checks robots.txt.
  - `server/` holds the use cases (onboarding, applications, inbound, billing, reminders, matches) on top of Supabase.
- `src/app/` holds the pages:
  - landing, login, onboarding (country, CV upload or demo, questions, preferences, reveal)
  - `inbox` (Opportunities), `jobs/[id]` ("why this job", gaps, application pack, apply later)
  - `queue`, `applications` (tracker), `insights`, `profile`, and `setup` (the 5-step forwarding guide)
  - `upgrade` (Pro ৳299 for 30 days via bKash) and `admin/payments` (owner-only payment review)
  - API routes under `src/app/api`
- `src/middleware.ts` refreshes the session and protects app routes. (Next 16 prefers `proxy.ts`, but OpenNext for Cloudflare needs the Edge `middleware.ts` form.)
- `supabase/migrations/` holds the schema, RLS, storage buckets and the country_rules and plans seed. `supabase/seed.sql` adds dev-only fictional sample jobs. `supabase/tests/` has an RLS test for plain Postgres.
- `workers/email-intake/` is the Cloudflare Email Worker.
- `scripts/ingest`, `scripts/reminders`: cron jobs run by `.github/workflows`.

### Data model (short)

- `profiles` (1:1 with auth user)
- `subscriptions` and `plans`; a 7-day trial is created on sign-up
- `payments` (bKash manual or checkout; `pending` until verified)
- `cv_documents` (`text_source`: file, paste, ocr, demo)
- `career_facts` (provenance)
- `master_cvs` (versioned)
- `jobs`: `owner_id` null means a public listing, otherwise the job is private to that user (pasted or from an alert)
- `matches`
- `applications` and `application_events`
- `reminders`
- `forwarding_addresses`
- `inbound_emails`
- `ai_usage`, with a per-user monthly cap checked by `ai_budget()`
- `ingestion_sources`
- `country_rules`

### AI usage and cost control

All calls go through `runAI()`, which:
- refuses when the trial has ended or the user is over the monthly cap (trial 0.50 USD, pro 1.00 USD, free 0)
- records tokens and cost per call in `ai_usage`

Model use by task:

| Model tier | Model | Used for |
|---|---|---|
| fast | Haiku | CV extraction, CV photo/scan transcription (vision), pasted-job parsing, filling gaps in alert jobs, CV tailoring |
| quality | Sonnet | Master CV, cover letter |

CV photos and scans: the browser renders up to 4 pages (about 1600 px on the long edge, JPEG) and `/api/cv/transcribe` sends them to the fast model, metered as `cv_ocr`. The text comes back to the user to correct before anything is extracted; the images are not stored.

Alert emails: the deterministic parser runs first. AI is called only when a job is missing its title or company (one call per email, and filled values must appear in the email text), or when an email looks like an alert but no job links were recognised.

Without an AI key, the app still works:
- the demo CV goes through the full flow
- packs come from deterministic templates
- pasted jobs are parsed deterministically
- uploading a real CV returns "AI not configured"
- alert emails still produce jobs from the deterministic parser

## Environment variables

See `.env.example`. Summary:

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app | Supabase client (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | app, Actions | System tasks: metering, inbound mail, cron. Never exposed. |
| `NEXT_PUBLIC_APP_URL` | app, Actions | Links in emails |
| `NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN` | app | Domain of the personal forwarding addresses |
| `INBOUND_SHARED_SECRET` | app, worker | HMAC between the Email Worker and `/api/inbound/email` |
| `CRON_SECRET` | app | Bearer token for the optional `/api/cron/reminders` |
| `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_QUALITY` | app | AI (default Anthropic: `claude-haiku-5-5` and `claude-sonnet-5-5`) |
| `GEMINI_API_KEY`, `GEMINI_MODEL_FAST`, `GEMINI_MODEL_QUALITY` | app | Optional Gemini provider (REST API, no SDK) |
| `ADMIN_EMAILS` | app | Comma-separated owner emails allowed on `/admin/payments` |
| `PAYMENT_METHODS` | app | `manual`, `checkout` or both (default both; each needs its own variables) |
| `BKASH_MANUAL_NUMBER`, `BKASH_MANUAL_ACCOUNT_TYPE` | app | Manual path: your bKash number and `personal`, `merchant` or `agent` |
| `BKASH_BASE_URL`, `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` | app | Tokenized Checkout (merchant). Base URL defaults to the sandbox |
| `EMAIL_PROVIDER`, `RESEND_API_KEY` or `BREVO_API_KEY`, `EMAIL_FROM` | app, Actions | Reminder emails |

## Local development

Requirements: Node 22+ and a Supabase project. You can also use the Supabase CLI (`supabase start` needs Docker).

```bash
npm install
cp .env.example .env.local      # fill in Supabase URL/keys at minimum
# Apply the database: either the Supabase CLI ...
supabase link --project-ref <ref> && supabase db push
# ... or paste the three files in supabase/migrations/ (in order) into the SQL editor.
# Optional dev data (fictional sample jobs): run supabase/seed.sql
npm run dev                      # http://localhost:3000
```

Checks:

```bash
npm run typecheck && npm run lint && npm test && npm run build
npm run cf-build && npx wrangler deploy --dry-run --outdir /tmp/cf   # Worker bundle + size check
```

To test the RLS rules on a plain Postgres 16 (no Supabase needed), run these in a scratch database:
1. `supabase/tests/local_supabase_shim.sql`
2. the migrations, in order
3. `supabase/tests/rls_test.sql`

Errors in that output are the expected refusals.

Cron jobs, locally:

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run ingest -- --dry-run
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_APP_URL=... npm run reminders -- --dry-run
```

## Free-tier deployment

### 1. Supabase (free)

1. Create a project in a region near your users (Singapore for Bangladesh).
2. Apply the migrations: `supabase db push`, or paste them into the SQL editor. The migrations create the private buckets `cv-files` and `inbound-raw`.
3. Set up auth:
   1. Under Authentication -> Providers, keep Email on.
   2. Under URL Configuration, set the Site URL to your app URL and add `https://<app>/auth/confirm` to the Redirect URLs.
   3. Under Email Templates -> Magic Link, use this body. It gives users both a 6-digit code and a link that works in any browser:

      ```html
      <p>Your JobPao code: <b>{{ .Token }}</b></p>
      <p>Or <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding">sign in with this link</a>.</p>
      ```

      The default template also works, through the PKCE `code` flow, but only when the link opens in the same browser that asked for it. Do the same for the Confirm signup template, using `type=signup`.
   4. For production volume, set custom SMTP (Resend or Brevo) under Authentication -> SMTP. The built-in sender is rate-limited.
4. Copy the URL, the anon key and the service role key.

### 2. App on Cloudflare Workers (OpenNext)

The app runs as one Worker built by [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) (`wrangler.jsonc`, `open-next.config.ts`). Static files are served from Workers Assets.

1. Install Wrangler's login once: `npx wrangler login`. Change `name` in `wrangler.jsonc` if you like.
2. Set the **build-time** public values. `NEXT_PUBLIC_*` values are compiled into the browser bundle, so they must be in the environment when you build: put them in `.env.production` (or export them) before `npm run cf-build`.
3. Set the **runtime** values as Worker variables and secrets. Secrets are encrypted and never shown again:

   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler secret put INBOUND_SHARED_SECRET
   npx wrangler secret put CRON_SECRET
   npx wrangler secret put RESEND_API_KEY        # or BREVO_API_KEY
   npx wrangler secret put BKASH_APP_SECRET      # only for Tokenized Checkout
   npx wrangler secret put BKASH_PASSWORD        # only for Tokenized Checkout
   ```

   Put the non-secret values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN`, `AI_PROVIDER`, `AI_MODEL_*`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `ADMIN_EMAILS`, `PAYMENT_METHODS`, `BKASH_MANUAL_*`, `BKASH_BASE_URL`, `BKASH_APP_KEY`, `BKASH_USERNAME`) under `vars` in `wrangler.jsonc`, or in the dashboard under Workers & Pages -> job-switcher -> Settings -> Variables and Secrets. The server reads `NEXT_PUBLIC_SUPABASE_*` at runtime too, so set them in both places. For `npm run preview`, put the same values in `.dev.vars` (git-ignored).
4. Deploy: `npm run deploy` (builds with OpenNext, then `wrangler deploy`). The first deploy gives you a `*.workers.dev` URL; add a custom domain under the Worker's Settings -> Domains & Routes.
5. Set `NEXT_PUBLIC_APP_URL` to the final URL, rebuild and deploy again, and use the same URL as the Supabase Site URL and in the Email Worker's `APP_URL`.

#### Free plan limits and when to pay

- **Bundle size.** The free plan allows 3 MB (gzip) per Worker. The build is about 2.3 MB gzip (see BUILD_NOTES.md). Keep the PDF/Word parsers in the browser and avoid large server-only SDKs; CI runs the dry-run so a size jump is visible.
- **CPU time.** The free plan allows **10 ms of CPU per request**. Waiting for Supabase, the AI provider, bKash or email is I/O and does not count, but parsing, React rendering and scoring do. These routes do the most CPU work:
  - server-rendered pages, most of all `/inbox` and `/jobs/[id]` (scoring every job for the user) and the onboarding reveal (CV render);
  - `/api/cv/upload` (fact grounding against the CV text) and `/api/cv/build` (Master CV fact and number checks);
  - `/api/applications/[jobId]/prepare` (pack checks) and `/api/cv/download` (Word/print rendering);
  - `/api/inbound/email` (MIME parsing and alert HTML parsing);
  - `/api/cv/transcribe` (multipart parsing and base64 of up to 4 page images);
  - any request that refreshes matches (`refreshMatches` scores all open jobs).
  PDF/DOCX parsing and image rendering were moved to the browser for this reason. Even so, these routes can exceed 10 ms on large CVs, long alerts or many jobs, and the Worker then fails with error 1102.
- **When Workers Paid ($5/month) becomes necessary.** Use the free plan for testing and a handful of users. Move to Workers Paid before you take payments or invite real users, or as soon as the Worker's Metrics show CPU-limit errors. Paid allows 30 s of CPU per request by default (raise it with `"limits": { "cpu_ms": ... }` in `wrangler.jsonc`) and 10 million requests a month, and lifts the bundle limit to 10 MB.
- `maxDuration` exports in some routes are a Next.js hint that OpenNext ignores; they are harmless. Workers have no wall-clock limit while the client is connected.

### 3. Inbound alert email (Cloudflare, free)

1. Put a domain on Cloudflare, for example `in.jobswitcher.app`, or a subdomain of yours.
2. Enable Email -> Email Routing for it. Cloudflare adds the MX and SPF records.
3. Deploy the worker:

   ```bash
   cd workers/email-intake
   npm install
   # edit wrangler.toml: APP_URL = your deployed app URL (the Worker URL or custom domain from step 2)
   npx wrangler secret put INBOUND_SHARED_SECRET   # same value as the app
   npx wrangler deploy
   ```

4. In Email Routing -> Routing rules, set the catch-all action to "Send to a Worker" -> `job-switcher-email-intake`.
5. Set `NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN` to that domain in the app.

Each user gets an address such as `rahim-3fa9c1@in.jobswitcher.app`. When they add it as a forwarding address, Gmail sends a confirmation code; the app detects it, and the setup guide shows it live. The user then creates a Gmail filter that forwards only job-alert senders. Unknown aliases are rejected.

### 4. Reminder and payment email (Resend or Brevo, free)

Verify your sending domain with the provider, then set `EMAIL_PROVIDER`, the API key and `EMAIL_FROM`.

### 5. bKash payments (Pro ৳299 / 30 days)

Both paths can be on at once; the upgrade page shows what is configured. Prices per country live in `plan_prices` (৳299 in Bangladesh, AED/SAR 29, RM 15, £7.99, C$12.99, A$14.99, $9.99 in the US, $4.99 elsewhere) and follow the country a user lives in (Profile → I live in); the landing page uses Cloudflare's `CF-IPCountry`. Only taka can be paid today, so bKash is offered only to people living in Bangladesh; other countries need an international card provider. Set `ADMIN_EMAILS` to your own sign-in email first.

**Manual (personal or merchant number, no bKash API needed).**
1. Set `BKASH_MANUAL_NUMBER=01XXXXXXXXX` and `BKASH_MANUAL_ACCOUNT_TYPE=personal` (the page tells users to use Send Money) or `merchant` (Payment).
2. Users pay in their bKash app and submit the TrxID and their bKash number on `/upgrade`. The payment is `pending`; Pro does not start.
3. Open `/admin/payments`. Find the TrxID, amount and sender in your bKash app statement, then Approve (adds 30 days of Pro and emails the user) or Reject with a note. A TrxID can be submitted only once.

**bKash Tokenized Checkout (merchant accounts only).**
1. Get sandbox credentials from bKash (app key, app secret, username, password). Set `BKASH_APP_KEY`, `BKASH_USERNAME` as variables and `BKASH_APP_SECRET`, `BKASH_PASSWORD` as secrets. Leave `BKASH_BASE_URL` unset to use the sandbox (`https://tokenized.sandbox.bka.sh/v1.2.0-beta`).
2. The callback URL is `${NEXT_PUBLIC_APP_URL}/api/billing/bkash/callback`; bKash may ask you to register it.
3. Sandbox test: sign in, open `/upgrade`, choose "Pay with bKash", and complete the payment with one of the sandbox test wallets and the OTP/PIN from bKash's sandbox documentation. You should return to `/upgrade?payment=success`, the payment shows `approved` on `/admin/payments` with reviewer `bkash-query`, and the subscription is `active` for 30 days. Also test cancel and failure (`?payment=cancel` / `failure`; nothing activates).
4. For production, set `BKASH_BASE_URL` to the live URL bKash gives you (usually `https://tokenized.pay.bka.sh/v1.2.0-beta`) and the live credentials.

The payment code never activates Pro from the callback's `status` parameter alone: it executes the payment and then queries bKash. Fields we could not confirm against bKash's official reference are marked `TODO(bkash)` in `src/lib/billing/` and listed in BUILD_NOTES.md; check them in the sandbox before going live.

### 5b. Apply from the user's Gmail (optional)

Users can connect Gmail once (scope `gmail.send` only: send, never read). On a job that takes email applications, pressing **Apply now** shows To/From/attachments and sends only after **Send application**; the tailored CV and cover letter go as Word attachments, and the application is marked applied only after Gmail returns a message id. Refresh tokens are AES-GCM encrypted with `GMAIL_TOKEN_KEY` and stored in `gmail_connections` (RLS on, server-only). The Gmail panel displays a setup-pending state until these repository secrets exist. `/api/health` reports only the boolean `features.gmailSending` (never credential values):

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google Cloud → APIs & Services → enable **Gmail API**; OAuth consent screen (External, scope `.../auth/gmail.send`); Credentials → OAuth client ID (Web application) with redirect URI `<app URL>/api/gmail/callback`.
- `GMAIL_TOKEN_KEY`: 32 random bytes in base64 (`openssl rand -base64 32`).

While the consent screen is in Testing, only listed test users (max 100) can connect. Publishing needs Google's verification of the sensitive scope, a privacy policy page and a verified own domain.

### 6. GitHub Actions

Add these repository secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `EMAIL_PROVIDER`, `RESEND_API_KEY` or `BREVO_API_KEY`, and `EMAIL_FROM`.

| Workflow | Schedule | What it does |
|---|---|---|
| `ci.yml` | every push and PR | typecheck, lint, test, `next build`, OpenNext build and `wrangler deploy --dry-run` (bundle size) |
| `ingest.yml` | daily, 06:30 Dhaka | `npm run ingest`; also has a manual dry-run input |
| `reminders.yml` | hourly | `npm run reminders`; each user is emailed on their own local morning (08:00 or later) on the due date |

The crons are unchanged by the move to Cloudflare: they talk to Supabase directly. Public repos get unlimited Actions minutes. Private repos get 2,000 minutes a month on the free plan, which is enough for these jobs.

### Adding job sources

Insert rows into `ingestion_sources` with the service role (SQL editor):

```sql
insert into ingestion_sources (kind, name, url, board_token, country, company) values
  ('jsonld',     'Acme careers', 'https://acme.example/careers', null, 'BD', 'Acme Ltd.'),
  ('greenhouse', 'Acme (Greenhouse)', null, 'acme', 'AE', 'Acme'),
  ('lever',      'Acme (Lever)', null, 'acme', 'GB', 'Acme');
```

Only add pages that are public and whose terms allow automated reading. The ingester identifies itself as `JobPaoBot`. It skips a page when robots.txt disallows it or cannot be read.

### Manual CV editing

Profile and the onboarding CV preview offer **Edit CV** above the CV. Users can edit text, roles, dates, education, certification status, skills and languages, then save or cancel. Editing has no AI charge, works without AI credentials and does not consume application allowance. `/api/cv/edit` is retired with HTTP 410 so stale chat tabs cannot start paid edits.

`POST /api/cv/manual` validates the fields and calls the user-scoped `save_manual_cv` transaction. It versions the Master CV and replaces its matching facts together, preserves interview answers and existing application history, and refuses stale CV versions or changed search countries. Manually saved CVs are reused without an AI rebuild; uploading a new CV starts the normal extraction flow again. Existing prepared applications remain snapshots.

### Completing application details and developing fit

Inbox and Profile show outstanding application answers. Salary preferences support an explicit amount, no fixed minimum, or negotiable salary; exclusion preferences support named exclusions or an explicit no-exclusions choice. Blank and unknown values remain incomplete. Save moves completed fields to a summary with Edit controls; partial answers remain highlighted. Confirmed expected salary and notice feed the matching profile, and zero notice means immediate availability.

The opportunity list always explains the 90% Strong Fit threshold. When no relevant open match reaches it, it shows the closest current score, evidenced skill gaps, other known barriers and learning/profile links. It never fabricates missing skills or promises a particular score increase. All guidance and completion checks are deterministic.

Inter and Manrope Latin font assets are bundled locally with their OFL licenses, removing the Google-font build step that intermittently failed in Turbopack.
