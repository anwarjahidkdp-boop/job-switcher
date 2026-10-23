# Bangladesh daily source coverage

The daily GitHub ingestion workflow is scheduled at 00:30 UTC / 06:30 Asia/Dhaka. GitHub may start scheduled jobs late; this is a scheduled target, not a real-time guarantee. A push changing the Bangladesh adapters also runs an initial collection. Existing per-user Job Alert import remains available for sources requiring user/provider access.

## Sources

The registry in `scripts/ingest/bd/registry.ts` covers portals (Dohaj, Skill.Jobs/former JobsBD, NextJobz, bdRecruit, Job.com.bd, MoreJobs, BDJobsToday), newspapers (Dhaka Post, Prothom Alo), weekly circulars (Saptahic Chakrir Khabar and its e-paper), an employer circular source (SDF), and Alljobs Teletalk. Existing BRAC and BRAC IT employer integrations continue. These are configured adapters; only a successful live run establishes working coverage and vacancy counts.

Bdjobs is disabled pending permitted feed/API access because its robots rules prohibit our crawler. JagoJobs detail URLs still need validation. NRBJobs is disabled after an account-suspended response. ReliefWeb needs an approved API app name. Disabled access requirements appear in Admin > Sources rather than being counted as functioning scrapers.

## Data integrity and cost

- Fetch public pages only, check robots on the configured host, reject external redirects, cap responses, throttle requests and persist a pagination cursor. First-page refresh runs every day while older pages are revisited over successive runs.
- Parse structured JobPosting and explicit labelled circular fields without paid AI calls. Ignore expired jobs. Articles lacking trustworthy position/employer/deadline evidence remain outside matching.
- A conservative identity (employer, role, location, deadline and category) merges a hiring round across sources. Missing deadlines/confidential employers use source-specific identity to avoid joining unrelated jobs. Exact duplicate identity is transactional; no fuzzy claim of universal duplicate removal.
- Keep each discovery URL and any explicit employer/original circular URL. Users can see provenance on the job page.
- Failed detail pages are persisted for next-run retry. Listing outages and partial failures appear as errors and trigger the existing failure notification. A failed or empty fetch never retires the entire source's jobs.
- Image/PDF circulars and ambiguous multi-role newspaper pages are queued in Admin > Circulars awaiting review. OCR and automatic verified extraction of these documents are not implemented in this release; queued documents are not reported as active vacancies.
- RLS protects internal canonical identities and review documents. Only the service role may invoke public-job ingestion; authenticated users may read source occurrences for visible jobs.

## Validation

Disposable PostgreSQL tests replay migrations and check service-only ingestion, cross-portal identity, provenance visibility, expired-job rejection and restricted review data. Parser/fetch tests cover Bengali dates, impossible dates, structured deadlines, ambiguous articles, same-host discovery, cursor resumption, failed-page persistence, robots denial and off-host redirects. CI and production deployment include build checks; deployment also verifies `/api/health`.
