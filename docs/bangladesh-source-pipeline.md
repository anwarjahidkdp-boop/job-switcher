# Bangladesh daily source coverage

The daily GitHub ingestion workflow is scheduled at 00:30 UTC / 06:30 Asia/Dhaka. GitHub may start scheduled jobs late; this is a scheduled target, not a real-time guarantee. A push changing the Bangladesh adapters also runs an initial collection. Existing per-user Job Alert import remains available for sources requiring user/provider access.

## Sources

Owner correction: reputation and authenticity take precedence over coverage volume. Public collection and publishing fail closed unless a registry entry has an explicit `official` or `established` review and a verification URL. New providers default to unreviewed. An administrator enabling an unreviewed database row does not bypass the code's collection/publication gate.

Current approved Bangladesh registry: official Alljobs Teletalk and SDF career pages; established Skill.Jobs (documented by Daffodil Group), Prothom Alo and Dhaka Post. Bdjobs and ReliefWeb retain access prerequisites. Existing BRAC and BRAC IT direct employer integrations continue. The other exploratory aggregators/weekly-paper entries are disabled pending evidence review. Their adapters remain available for future assessment. Paused sources are not approved for automatic publishing.

On 23 October, 10 exploratory sources were paused and their 265 imported public listings were made inactive; 25 relevant match entries were suppressed. All five existing applications and all original job records were preserved. Those 265 listings are excluded from active vacancy counts and future digests. This is a reversible quality hold, not approval of those providers. Recognized source identity does not automatically verify every employer or an applicant's eligibility.

The registry in `scripts/ingest/bd/registry.ts` contains adapters for portals, newspapers, weekly circulars, employers and government listings. Presence in the registry is not source approval; only the enabled reviewed entries above may collect and publish. Only a successful live run establishes working coverage and vacancy counts.

Alljobs Teletalk uses its anonymous government organization listing and public job detail JSON endpoints, as used by the provider's website. No token is sent. Full eligibility not exposed by that API is left unknown and the description directs applicants to the official circular; employer history and age limits never become work experience. Bangladesh sources run before international boards. Transient network/5xx errors get one bounded retry. A 403 remains an access failure and is not bypassed.

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
