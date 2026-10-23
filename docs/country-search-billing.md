# Country search and billing decisions — 23 October 2026

- Confirm the living country during initial setup (prefilled from the detected country). Lock it permanently on leaving that step. Search-country changes do not alter subscription pricing or payment method.
- One active target country; switching, including switching back, clears roles, cities, salary, notice/work mode and country-specific personal/reference fields. The original CV, improved CV, verified career facts, Career Safety, Answer Library, applications and payment history remain intact.
- Destination country selects the default CV template, page conventions, references, personal-detail visibility, currency/salary period, matching and work-authorization questions. Users review the reset before committing.
- Reuse the improved CV from the current source document during destination setup: no new extraction, no new paid AI rewrite. Common UK/US prose spelling is adapted at rendering; proper-name fields and facts are retained. This is a presentation adaptation, not newly generated career claims or automatic translation into every language.
- CV preview, Word and print/PDF share the renderer. A country revision prevents an old in-flight CV response or stale preference form from completing setup for a different destination. Original uploaded CV files are never removed by switching country.
- Bangladesh purchase packs: 15d BDT450; 30d BDT650; 90d BDT1450; 180d BDT2550; 365d BDT4050. Existing international packs are unchanged. All packs remain one-off payments without auto-renewal. Historical payment amounts and purchased durations are retained. Five-day full-feature trial remains unchanged.

## Validation
Disposable PostgreSQL tests exercise billing-country lock, direct-update reset, permissions, revision checks, five-day trial and a synthetic 180-day bKash settlement. Unit tests assert zero AI calls in the reuse path and destination rendering. No real application or payment is submitted by these tests.
