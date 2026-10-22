# Release operations

## Database and code deployment

Deploy additive migrations before code. New payment, AI and email paths fail closed if their RPC/table is absent. No historical payment, CV or trial row is rewritten. Keep the five-day trial and existing pack prices unchanged.

Migrations created with the CLI were renamed to the exact versions recorded by the production migration API, so all new migrations have identical GitHub and production versions. Older timestamps are intentionally preserved: do not run `db push` against production until the legacy baseline is reconciled by object/effect comparison, not filename absence.

## Recovery

- Revert the application release using the known tested commit and normal CI/deployment workflow; additive database functions/tables can remain installed. Reverting payment code restores its older crash window, so prefer a forward fix or temporarily stop checkout.
- The user-scoped Gmail claim also reserves the free application slot across different jobs before sending. Never clear Gmail send claims automatically; follow `gmail-send-reconciliation.md`.
- Email `sending`/`unresolved` rows require provider-receipt reconciliation. Do not reset a claim because of age. Pending explicit rejections retry hourly, at most three attempts. Honor opt-outs before delivery. Original encrypted backups contain mail payloads and CV data; keep them private.
- AI rows with `model = '__reserved__'` reserve the remaining allowance after an ambiguous call/crash. Check provider usage and protected logs, then settle that exact row to actual tokens/cost; do not delete it or refund unknown spend. No automatic reclaim. A completed call replaces the reservation with measured usage; the nominal allowance can still be crossed by the cost of one accepted call. Reconcile pricing/model changes against official provider billing before increasing limits.
- Database JSON export is a supplemental table copy, not a transaction-consistent full disaster-recovery backup. It omits Auth identities, storage object bytes and cluster configuration. A production restore drill needs an isolated project, native database backup and private storage backup. Keep the encryption key version for each backup; rotating a service key does not re-encrypt older copies.

## Monitoring

Check CI and deployment for the same commit, public `/api/health`, scheduled ingest/reminder runs, service-only queue states and `__reserved__` AI rows. The public health endpoint proves the Worker responds, not that every integration is working. Source failures must alert even on partial outages. Persistent HTTP 404 sources need their employer/board URL verified before updating configuration; never replace them with guessed board tokens.

## Safety and rollback verification

SQL integration tests replay migrations against a disposable PGlite PostgreSQL engine with synthetic identities and RLS roles. This exercises SQL constraints, privileges and rollback, but does not replace real multi-session database concurrency, OAuth consent, provider sandbox payments, inbox delivery, or a complete mobile authenticated walkthrough. Production SQL smoke checks use a transaction and rollback every synthetic row; no actual applications or payments are sent.
