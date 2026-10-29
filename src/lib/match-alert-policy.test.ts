import { describe, expect, it } from "vitest";
import { eligibleForMatchAlerts, matchPushRoom } from "./match-alert-policy";

const now = new Date("2026-10-29T10:00:00.000Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
describe("strong match phone notification policy", () => {
  it("limits phone job alerts to three per rolling 24 hours", () => {
    expect([0, 1, 2, 3, 8].map(matchPushRoom)).toEqual([3, 2, 1, 0, 0]);
  });
  it("keeps active Pro and trial job discovery eligible", () => {
    expect(eligibleForMatchAlerts({ plan_code:"pro", status:"active", current_period_end: days(30) }, now)).toBe(true);
    expect(eligibleForMatchAlerts({ plan_code:"trial", status:"trialing", trial_ends_at: days(2) }, now)).toBe(true);
  });
  it("sends job alerts for seven days after free trial but no longer", () => {
    expect(eligibleForMatchAlerts({ plan_code:"trial", status:"expired", trial_ends_at: days(-6) }, now)).toBe(true);
    expect(eligibleForMatchAlerts({ plan_code:"trial", status:"expired", trial_ends_at: days(-8) }, now)).toBe(false);
  });
  it("does not revive inactive paid accounts or unknown subscriptions", () => {
    expect(eligibleForMatchAlerts({ plan_code:"pro", status:"past_due", current_period_end: days(30) }, now)).toBe(false);
    expect(eligibleForMatchAlerts(null, now)).toBe(false);
  });
});
