# Mobile launch and route work (23 October 2026)

Reviewed production Supabase edge logs show roughly 300 ms average origin times for jobs/profile/CV requests, with job p95 around 900 ms. This is upstream service time, not a phone's complete navigation time. Several sequential query stages can add up. Unauthenticated probes from the executor took 4–7 seconds even for static assets; these are network-path observations and must not be presented as a Bangladesh-device benchmark.

Changes:
- Profile pages skip match inventory, AI assessments, counts and application packs. They retain verified career facts, current CV and automatic personal-detail extraction. Other pages and application eligibility checks retain their full matching state.
- Newest jobs and owned jobs start while stored match IDs load. Full daily matching pagination is unchanged.
- Shared request-scoped subscription read prevents the layout and dashboard querying the same account twice. Profile, trial and notification header reads run together. Photo and Gmail reads run together on Profile.
- Root loading boundary can stream a response while layouts wait for data.
- Service worker caches only same-origin immutable /_next/static/ build assets, at most 100 entries. It never caches HTML, RSC, APIs, CVs or account responses. Blocked storage falls back to the network.
- No authentication or RLS checks were bypassed; no cross-user account cache was added.

Validation includes no-job-query profile coverage and service-worker tests for cache reuse, personal-route exclusion and unavailable cache storage. CI performs Next/OpenNext production builds and Worker dry run; deployment verifies /api/health. Authenticated mobile navigation needs a real device check before claiming an exact before/after duration.
