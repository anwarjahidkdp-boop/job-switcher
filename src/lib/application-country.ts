/** Unsent selections belong to the active search country. Sent history stays account-wide for quota checks. */
export function applicationInSearch(app: { applied_at: string | null; jobs: { country: string } | null }, country: string): boolean {
  return !!app.applied_at || app.jobs?.country === country;
}
export function assertSearchCountry(jobCountry: string, searchCountry: string) {
  if (jobCountry !== searchCountry) throw new Error("This job belongs to your previous search country. Choose an opportunity in your current country.");
}
