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
- **Today's Fresh Jobs window** (`briefingWindow`): today, from midnight in the person's search country.
  - Each market gets fresh jobs three times a day at its own local times (`src/lib/scan-schedule.ts`): Bangladesh 8 am, 3 pm and 10 pm; UK 7 am, 12 pm and 9 pm; elsewhere 8 am, 1 pm and 9 pm. The hourly ingest run scans a market two hours before its update, so the jobs are ready when people look. The chip reads "Updated 3 pm · Next 10 pm".
  - An account younger than 24 hours sees everything since joining. The chip reads "Since you joined".
  - Nothing found or applied today yet: yesterday's jobs ("Yesterday's jobs"), then the latest market scan (12 hours before the newest job).
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
| Notifications, Home hero note | a match already applied to | `currentApplicationNotifications` relabels it and links to Applied | Applied |

## Row labels

A list row's chip follows the same group rule. A high score outside the field reads "Outside your field". A job past its deadline reads "Deadline passed". Neither is ever called Strong Fit.
