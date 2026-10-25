/** Unsent selections belong to the active search country. Sent history stays account-wide for quota checks. */
export function applicationInSearch(app: { applied_at: string | null; jobs: { country: string } | null }, country: string): boolean {
  return !!app.applied_at || app.jobs?.country === country;
}
export function assertSearchCountry(jobCountry: string, searchCountry: string) {
  if (jobCountry !== searchCountry) throw new Error("This job belongs to your previous search country. Choose an opportunity in your current country.");
}

/** The home dashboard belongs to the current search country only: applications from an earlier country stay in
 *  the account (Applied page, account-wide limits) but are not counted here. Rows without a joined job are current. */
export function currentCountryApps<T extends { jobs?: { country: string } | null }>(apps: Record<string, T>, country: string): Record<string, T> {
  return Object.fromEntries(Object.entries(apps).filter(([, a]) => !a.jobs?.country || a.jobs.country === country));
}
