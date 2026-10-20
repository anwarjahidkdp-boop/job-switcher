// Automatic-jobs setup progress, kept in profiles.setup_steps.
// Gmail forwarding ("forward") is done once per Gmail; alerts, filter and test are done per job site ("alerts:Bdjobs").
export type SetupSteps = Record<string, boolean>;
export const SITE_STEPS = ["alerts", "filter", "test"] as const;
export type SiteStep = (typeof SITE_STEPS)[number];

export const siteKey = (step: SiteStep, site: string) => `${step}:${site}`;
/** A site is set up once its alert and filter are on, or once an alert email from it has arrived. */
export const siteDone = (s: SetupSteps, site: string) => !!s[siteKey("test", site)] || (!!s[siteKey("alerts", site)] && !!s[siteKey("filter", site)]);
export const isSetupKey = (key: string) => key === "address" || key === "forward" || /^(alerts|filter|test):[A-Za-z][A-Za-z ]{1,30}$/.test(key);
export const sitesDone = (s: SetupSteps, sites: string[]) => sites.filter((p) => siteDone(s, p)).length;
