# Numbers and the lists they open

Every number a person sees comes from one function. The list that number opens comes from the same function. `src/test/number-contract.test.tsx` renders Home and Insights, follows every number's link, and fails if a list does not hold exactly that many items. Change a rule here and in code together, never in only one place.

## Shared rules

- **An account's clock starts when it joins.** A job collected before signup counts as found at signup (`Job.foundAt` = `foundAtFor`, set in `loadState`). Jobs added later count from when they were added.
- **Fit groups** (`fitCard`):
  - Strong Fit: 90% or more.
  - Best Fit: 80 to 89%.
  - Good Fit: 70 to 79%.
  - Stretch & others: everything else. That means under 70%, outside the field (including an AI "no"), or past the deadline.
  - Top match = Strong + Best + Good.
- **Jobs found** = every job checked for the person in the window, counted in the database (`countVisibleJobs` / `countFoundSince`). The page loads only the newest and best jobs. The jobs it does not load are lower fits or outside the person's target roles: they are counted under Stretch & others and appear in the list as one "We also checked N more" line.
- **Opportunity Briefing window** (`briefingWindow`):
  - A new account's first visit covers everything since joining. The chip reads "Since you joined".
  - After that it covers what is new since the last visit, at most 7 days back. The visit cookie is per account.
  - If nothing is new, it shows the latest market scan (12 hours before the newest job).
- **Applications** (`appliedFor`) count submitted applications in the current search country:
  - Applied: all of them, or those submitted since the window start.
  - Interviewed: an interview was recorded at any point.
  - Offer received: an offer was recorded at any point.
  - Applications from earlier search countries stay on the Applied page under "Earlier search country". They still count toward trial limits.

## Where each number lives

| Screen | Number | Source | Opens |
|---|---|---|---|
| Home, Opportunity Briefing | Jobs found, Top match, 4 fit cards | `jobTotals(scored, brief.since, brief.checked)` | `/opportunities?fit=…&when=new&since=…` (`jobsBehind`) |
| Home, Opportunity Briefing | Applied | `appliedFor(here, "new", since)` | `/applications?when=new&since=…` |
| Home, Lifetime | Jobs found, 4 fit cards | `jobTotals(scored, null, analysed)` | `/opportunities?fit=…` |
| Home, Lifetime | Applied, Interviewed, Offer received | `appliedFor(here, all / interview / offer)` | `/applications`, `?status=interview`, `?status=offer` |
| Home | Career guide "Only N Strong Fits" | Lifetime Strong Fit | the guide on Home |
| Home | Your best match | best available job at 70% or more, else "No match yet" | `/jobs/<id>` |
| Home | Applications left (trial) | `trialApplyRoom`, the same rule the server enforces | `/upgrade` (Pro limits from `packLimits`) |
| Insights | 5 fit tiles | `fitTiles` → `jobTotals` (same as Lifetime) | same lists as Lifetime |
| Onboarding, CV ready | checked / Top matches / Strong Fits | `jobTotals` (same as day-one Home) | Home |
| Opportunities list | header "N jobs" | `jobsBehind(...).count` | n/a |
| Notifications, Home hero note | a match already applied to | `currentApplicationNotifications` relabels it and links to Applied | Applied |

## Row labels

A list row's chip follows the same group rule. A high score outside the field reads "Outside your field". A job past its deadline reads "Deadline passed". Neither is ever called Strong Fit.
