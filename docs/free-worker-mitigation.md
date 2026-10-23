# Dashboard corrections and Free Worker mitigation

The existing palette stays in place. Mobile dashboard notices become a compact one-line warning with a Profile link; the full notice remains on Profile. Offers now has its own live-count tile beside Interviews, with each status counted separately. The dashboard heading is Career overview and its highlighted job action is Review opportunity. The final blue work-summary tile uses readable light text.

Navigation, dashboard job/KPI/work-summary links and fit-guidance links disable speculative Next.js prefetch. Navigation still works on tap; destinations load on demand rather than consuming Worker CPU merely because their links are visible. This trades some preloaded navigation speed for fewer background invocations on the constrained Free plan.

CV/cover-letter downloads and Gmail pack sending skip the market-wide matching load. Downloads retain the current account's saved CV/application ownership and trial checks. Gmail still fetches the selected job and checks it against the current profile before sending; skipping unrelated job rankings does not skip eligibility or duplicate-send checks.

No billing upgrade, CPU-limit increase, shared account-data cache or matching-score relaxation is included. The separate paid-plan draft PR remains unmerged. These changes reduce avoidable work but do not guarantee elimination of Cloudflare Error 1102 under the Free plan's 10 ms CPU ceiling. Production verification must distinguish public health from signed-in page behavior.
