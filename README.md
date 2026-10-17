# Job Switcher

A personal AI career agent. It launches in Bangladesh and supports the UAE, Saudi Arabia, Malaysia, the UK, Canada, Australia, the US and "Other". It reads your CV once and builds a verified Master CV. It then scores incoming jobs with a deterministic matcher and prepares an application pack for each job you choose. The pack holds a tailored CV, a cover letter, an email and a checklist. You apply yourself; the app never applies for you.

This is a production-shaped MVP that runs on free tiers. The UI and behaviour are ported from `job-switcher-prototype/index.html`.

## Product rules enforced in code

| Rule | Where |
|---|---|
| Never invent qualifications, skills, employers, dates or numbers | Every career fact is stored in `career_facts` with `provenance` (`cv`, `answer` or `user`), `verified` and `evidence`. `src/lib/facts.ts` `groundExtraction` checks each AI-extracted fact against the CV text. Unverified facts never reach generators (`verifiedOnly`). `src/lib/numbers-check.ts` runs on every Master CV (`checkMasterCv`) and every pack (`checkPack`), server-side: it drops unverified employers and skills and flags numbers that are not in the user's facts. |
| Never submit on the user's behalf | Nothing sends applications. The `guard_user_confirmed_status` trigger lets only the signed-in user (`auth.uid() = user_id`) set `applied`, `interview`, `offer` or `withdrawn`. The service role is refused. |
| No job-site passwords, no logged-in scraping | No credential fields exist. Jobs come from three places: alert emails the user forwards with a Gmail filter, pasted posts, and public JSON-LD or Greenhouse/Lever endpoints. Ingestion checks `robots.txt` first. |
| CVs are private | Storage buckets `cv-files` and `inbound-raw` are private. Files are only reachable through short-lived signed URLs (60 s for the original CV, 1 h for the photo). Every user table has RLS (`supabase/migrations/*_rls.sql`). |
| Keys server-side only | Only `NEXT_PUBLIC_*` values reach the browser. AI, email, service-role and HMAC secrets are read in server modules guarded by `server-only`. |

## Architecture

```
Browser (Next.js App Router pages, server actions)
   |                                    Gmail filter forwards alert emails
   v                                              |
Next.js on Vercel (Hobby) -------------- Cloudflare Email Routing -> Email Worker (workers/email-intake)
   |  /api/*  server actions                        | HMAC-signed POST /api/inbound/email
   |                                                v
   +--> Supabase: Auth (email OTP / magic link), Postgres + RLS, private Storage
   +--> AI provider (src/lib/ai): Anthropic (Haiku = fast, Sonnet = quality) or Gemini, metered per user
   +--> Resend / Brevo (reminder emails)
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
  - `cv/` renders the 3 CV templates (modern, executive, classic) with accents and an optional photo, exports Word .doc and print/PDF, and extracts text from PDF and DOCX.
  - `inbound/` parses MIME, detects Gmail forwarding-verification emails and checks HMAC signatures.
  - `ingest/` reads JSON-LD, Greenhouse and Lever, and checks robots.txt.
  - `server/` holds the use cases (onboarding, applications, inbound, reminders, matches) on top of Supabase.
- `src/app/` holds the pages:
  - landing, login, onboarding (country, CV upload or demo, questions, preferences, reveal)
  - `inbox` (Opportunities), `jobs/[id]` ("why this job", gaps, application pack, apply later)
  - `queue`, `applications` (tracker), `insights`, `profile`, and `setup` (the 5-step forwarding guide)
  - API routes under `src/app/api`
- `src/proxy.ts` refreshes the session and protects app routes (Next 16 replaced middleware with proxy).
- `supabase/migrations/` holds the schema, RLS, storage buckets and the country_rules and plans seed. `supabase/seed.sql` adds dev-only fictional sample jobs. `supabase/tests/` has an RLS test for plain Postgres.
- `workers/email-intake/` is the Cloudflare Email Worker.
- `scripts/ingest`, `scripts/reminders`: cron jobs run by `.github/workflows`.

### Data model (short)

- `profiles` (1:1 with auth user)
- `subscriptions` and `plans`; a 7-day trial is created on sign-up
- `cv_documents`
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
| fast | Haiku | CV extraction, pasted-job and alert normalisation, CV tailoring |
| quality | Sonnet | Master CV, cover letter |

Without an AI key, the app still works:
- the demo CV goes through the full flow
- packs come from deterministic templates
- pasted jobs are parsed deterministically
- uploading a real CV returns "AI not configured"

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
| `GEMINI_API_KEY`, `GEMINI_MODEL_FAST`, `GEMINI_MODEL_QUALITY` | app | Optional Gemini provider |
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
```

To test the RLS rules on a plain Postgres 16 (no Supabase needed), run these in a scratch database:
1. `supabase/tests/local_supabase_shim.sql`
2. the three migrations, in order
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
      <p>Your Job Switcher code: <b>{{ .Token }}</b></p>
      <p>Or <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding">sign in with this link</a>.</p>
      ```

      The default template also works, through the PKCE `code` flow, but only when the link opens in the same browser that asked for it. Do the same for the Confirm signup template, using `type=signup`.
   4. For production volume, set custom SMTP (Resend or Brevo) under Authentication -> SMTP. The built-in sender is rate-limited.
4. Copy the URL, the anon key and the service role key.

### 2. App on Vercel Hobby (primary)

1. Import the GitHub repo into Vercel. The framework is detected as Next.js.
2. Add the environment variables from the table above under Project -> Settings -> Environment Variables.
3. Deploy, then set `NEXT_PUBLIC_APP_URL` to the production URL and redeploy.
4. AI-heavy routes (CV build, pack generation, inbound alert parsing) set `maxDuration = 120`. That needs Fluid compute, which is on by default for new projects and allows up to 300 s on Hobby. If your project has Fluid compute off, either turn it on or lower those values to 60.

Alternative: Cloudflare Workers/Pages through the OpenNext adapter (`@opennextjs/cloudflare`). Follow its guide, and set the same variables as Worker secrets. CV text extraction (`unpdf`, `mammoth`) runs in the Node.js runtime, so check that it works under `nodejs_compat` before you switch.

### 3. Inbound alert email (Cloudflare, free)

1. Put a domain on Cloudflare, for example `in.jobswitcher.app`, or a subdomain of yours.
2. Enable Email -> Email Routing for it. Cloudflare adds the MX and SPF records.
3. Deploy the worker:

   ```bash
   cd workers/email-intake
   npm install
   # edit wrangler.toml: APP_URL = your deployed app URL
   npx wrangler secret put INBOUND_SHARED_SECRET   # same value as the app
   npx wrangler deploy
   ```

4. In Email Routing -> Routing rules, set the catch-all action to "Send to a Worker" -> `job-switcher-email-intake`.
5. Set `NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN` to that domain in the app.

Each user gets an address such as `rahim-3fa9c1@in.jobswitcher.app`. When they add it as a forwarding address, Gmail sends a confirmation code; the app detects it, and the setup guide shows it live. The user then creates a Gmail filter that forwards only job-alert senders. Unknown aliases are rejected.

### 4. Reminder email (Resend or Brevo, free)

Verify your sending domain with the provider, then set `EMAIL_PROVIDER`, the API key and `EMAIL_FROM`.

### 5. GitHub Actions

Add these repository secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `EMAIL_PROVIDER`, `RESEND_API_KEY` or `BREVO_API_KEY`, and `EMAIL_FROM`.

| Workflow | Schedule | What it does |
|---|---|---|
| `ci.yml` | every push and PR | typecheck, lint, test, build |
| `ingest.yml` | daily, 06:30 Dhaka | `npm run ingest`; also has a manual dry-run input |
| `reminders.yml` | hourly | `npm run reminders`; each user is emailed on their own local morning (08:00 or later) on the due date |

Public repos get unlimited Actions minutes. Private repos get 2,000 minutes a month on the free plan, which is enough for these jobs.

### Adding job sources

Insert rows into `ingestion_sources` with the service role (SQL editor):

```sql
insert into ingestion_sources (kind, name, url, board_token, country, company) values
  ('jsonld',     'Acme careers', 'https://acme.example/careers', null, 'BD', 'Acme Ltd.'),
  ('greenhouse', 'Acme (Greenhouse)', null, 'acme', 'AE', 'Acme'),
  ('lever',      'Acme (Lever)', null, 'acme', 'GB', 'Acme');
```

Only add pages that are public and whose terms allow automated reading. The ingester identifies itself as `JobSwitcherBot`. It skips a page when robots.txt disallows it or cannot be read.
