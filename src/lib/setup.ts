// Automatic-jobs setup progress, kept in profiles.setup_steps.
// Gmail forwarding ("forward") is done once per Gmail; alerts, filter and test are done per job site ("alerts:Bdjobs").
export type SetupSteps = Record<string, boolean | string>;
export const SITE_STEPS = ["alerts", "filter", "test"] as const;
export type SiteStep = (typeof SITE_STEPS)[number];

export const siteKey = (step: SiteStep, site: string) => `${step}:${site}`;
/** A site is set up once its alert and filter are on, or once an alert email from it has arrived. */
export const siteDone = (s: SetupSteps, site: string) => !!s[siteKey("test", site)] || (!!s[siteKey("alerts", site)] && !!s[siteKey("filter", site)]);
export const isSetupKey = (key: string) => key === "address" || key === "forward" || /^(alerts|forward|filter|test):[A-Za-z][A-Za-z ]{1,30}$/.test(key);

/** Which email the user's account on a job site uses; it decides which instructions the wizard shows. */
export const ACCOUNT_KINDS = ["new", "same", "gmail2", "other"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export const accountKind = (s: SetupSteps, site: string): AccountKind | null => {
  const v = s[`acct:${site}`];
  return ACCOUNT_KINDS.find((k) => k === v) ?? null;
};
/** A site whose alerts go to a second Gmail needs that Gmail connected too; every other site shares the main Gmail. */
export const forwardKey = (s: SetupSteps, site: string) => (accountKind(s, site) === "gmail2" ? `forward:${site}` : "forward");
export const sitesDone = (s: SetupSteps, sites: string[]) => sites.filter((p) => siteDone(s, p)).length;
