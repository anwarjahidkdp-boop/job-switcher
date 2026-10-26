# Security posture (checked 2026-10-25)

## Secrets
- Full git history (431 commits, all branches) scanned for API keys, tokens, private keys, service-role JWTs and passwords: none found.
- The only key in the repo is the Supabase **anon** key (`.env.production`, `wrangler.jsonc`). It is public by design; Row Level Security protects the data.
- Real secrets live in GitHub Actions secrets and Cloudflare Worker secrets only. GitHub secret scanning and push protection are on.

## Repository visibility
The repository is public. Nobody except the owner (sole admin collaborator) can push, change settings or read secrets.
Fork pull requests never receive secrets and cannot deploy: Deploy runs only after CI on a push to `main`.

Before making it private, note on the GitHub Free plan:
- Private repos get 2,000 Actions minutes a month. Current usage (reminders five times a day, daily ingest, match refresh, CI + deploy on every merge) is well above that, so ingest, reminders and deploys would stop part-way through the month.
- Branch protection and push protection for secrets are not available on private repos without a paid plan.
Reduce scheduled Actions minutes (or upgrade) first, then switch to private.

## Branch protection for `main` (set in GitHub Settings → Branches)
- Require a pull request before merging, 0 approvals (a solo owner cannot approve their own PR).
- Require status check `check` (the CI job). Not strict.
- Do not allow bypassing; block force pushes and deletion.
This keeps the REST merge flow (`PUT /pulls/{n}/merge`) working once CI is green.

## Database (Supabase)
- RLS is on for every public table; user tables allow only `auth.uid()` rows; storage buckets are private and per-user.
- Migration `20261025180000_service_only_table_grants.sql` removes browser grants from server-only tables (Gmail tokens, email log, ingestion internals).
- Advisor notes accepted: `ai_budget` and `ensure_forwarding_address` are SECURITY DEFINER but both check `auth.uid()`. Leaked-password protection needs Supabase Pro.

## Sign-up bot protection
Turnstile is built into the login/sign-up forms (`docs/auth-protection.md`). It turns on when the repository variable
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set and Supabase Auth has CAPTCHA enabled with the matching secret.
