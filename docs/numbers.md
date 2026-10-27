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
- **Today's Fresh Jobs window** (`briefingWindow`): the last 24 hours, counted back from the market's latest update.
  - Each market is scanned three times a day at its own local times (`src/lib/scan-schedule.ts`): Bangladesh 8 am, 3 pm and 10 pm; UK 7 am, 12 pm and 9 pm; elsewhere 8 am, 1 pm and 9 pm. The hourly ingest run scans a market two hours before its update, so the jobs are ready when people look. The chip reads "Updated 3 pm · Next 10 pm".
  - Anchoring to the update keeps the numbers steady between updates, so Home and the lists it opens always agree. Jobs that arrive in between (job-alert emails) still count.
  - An account younger than 24 hours sees everything since joining. The chip reads "Since you joined".
  - Nothing found or applied in the window: the 24 hours up to the newest job keep showing, so the panel never empties. A line under the cards always says when the last new job was found ("Last new job found about 4 hours ago").
  - New-match emails go out at most once a day; the bell rings for every update.
- **Applications** (`appliedFor`) count submitted applications in the current search country:
  - Applied: all of them, or those submitted since the window start.
  - Interviewed: an interview was recorded at any point.
  - Offer received: an offer was recorded at any point.
  - Applications from earlier search countries stay on the Applied page under "Earlier search country". They still count toward trial limits.

## Where each number lives

| Screen | Number | Source | Opens |
|---|---|---|---|
| Home, Today's Fresh Jobs | Jobs found, Top match, 4 fit cards | `jobTotals(scored, brief.since, brief.checked)` | `/opportunities?fit=…&when=new&since=…` (`jobsBehind`) |
| Home, Today's Fresh Jobs | Applied | `appliedFor(here, "new", since)` | `/applications?when=new&since=…` |
| Home, Lifetime | Jobs found, 4 fit cards | `jobTotals(scored, null, analysed)` | `/opportunities?fit=…` |
| Home, Lifetime | Applied, Interviewed, Offer received | `appliedFor(here, all / interview / offer)` | `/applications`, `?status=interview`, `?status=offer` |
| Home | Career guide "Only N Strong Fits" | Lifetime Strong Fit | the guide on Home |
| Home | Your best match | best available job at 70% or more, else "No match yet" | `/jobs/<id>` |
| Home | Applications left (trial) | `trialApplyRoom`, the same rule the server enforces | `/upgrade` (Pro limits from `packLimits`) |
| Insights | 5 fit tiles | `fitTiles` → `jobTotals` (same as Lifetime) | same lists as Lifetime |
| Onboarding, CV ready | checked / Top matches / Strong Fits | `jobTotals` (same as day-one Home) | Home |
| Opportunities list | header "N jobs" | `jobsBehind(...).count` | n/a |
| Notifications (bell, email) | "New N% match" | the live score from `loadState` (AI reading included); only Top matches (70%+); waits up to a day for the AI reading; `reconcileMatchNotifications` restates or withdraws older ones after every refresh | the job |
| Trial Day 2–5 notes, 5-day report email, weekly report, Insights reports | Jobs found, Top matches (70%+), Strong Fit (90%+), Applied | `metricsFromState` (`src/lib/server/report-metrics.ts`): `jobTotals` for the report period and `appliedFor` (current search country); saved once per period so the email and Insights agree. Reports saved before 27 Oct 2026 keep their old labels. | Insights |
| New-match email digest | "N new Top matches", each job's % | the live score, as the bell; jobs found in the last 3 days; a post listed twice (same title and company) once | the job |
| Notifications, Home hero note | a match already applied to | `currentApplicationNotifications` relabels it and links to Applied | Applied |

## Row labels

A list row's chip follows the same group rule. A high score outside the field reads "Outside your field". A job past its deadline reads "Deadline passed". Neither is ever called Strong Fit.
