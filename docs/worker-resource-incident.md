# Worker CPU incident — 23 October 2026

Status: diagnosed; production has not been changed. This branch must not merge until Workers Paid is enabled by the owner.

The screenshot reported Cloudflare Error 1102, Ray `a4f293e10bfc3f44`. Read-only Cloudflare diagnostics at 17:54 UTC found 19 `exceededResources` invocations during the preceding six hours. Workers Observability identifies the failures as `exceededCpu`, mostly at 10 ms CPU and 12–19 ms wall time. Affected paths include `/`, `/inbox`, `/profile`, `/queue`, `/applications`, `/insights` and `/upgrade`. These are not memory-limit events. The aggregate CPU quantiles use microseconds.

Successful requests in the same window had median CPU 27.21 ms and p99 617.509 ms. Those aggregate measurements include mixed routes and are not authenticated page latency benchmarks. They establish that this deployment regularly needs more CPU than the Free ceiling. The Free plan sometimes permits bursts; success on an individual probe does not demonstrate recovery.

The Worker settings have no explicit CPU override. Observed enforcement is the 10 ms Free-plan ceiling. The available token cannot read billing subscriptions (403), so the exact billing subscription has not been independently inspected or changed.

## Prepared remediation

The proposed Wrangler configuration sets `limits.cpu_ms` to 30000, the normal Paid default. This does not purchase a subscription or unlock paid CPU on a Free account. The owner must first confirm Workers Paid on the account hosting `job-switcher`; do not upgrade an unrelated website zone plan. No paid changes are authorized yet.

After confirmation: run CI, deploy the reviewed configuration, verify health and actual signed-in navigation, then query new telemetry for `exceededCpu` events. Investigate any failures that remain. CPU profiling and reducing page-time matching/prefetch work remain useful cost and latency improvements, but cannot establish reliable operation of the current SSR app under a hard 10 ms ceiling.

The design sample is separate and is not included in this branch.

## Repeat diagnosis

The branch's Worker diagnostics workflow reads settings, aggregate metrics and sanitized invocation outcomes using the existing Cloudflare deployment token. It never prints bindings, credentials, request headers or bodies. It makes no account configuration changes. Billing read failure is reported without changing permissions.

Sources:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/
