import { describe, expect, it } from "vitest";
import { courseLinks, trialDay, trialPlan } from "./today";

const D = 86_400_000;
const start = Date.parse("2026-10-20T08:00:00Z");
const base = { status: "trialing", trialStart: new Date(start).toISOString(), trialEnd: new Date(start + 5 * D).toISOString(), hasMaster: true, strong: 4, prepared: 0, applied: 0, interviews: 0, setupDone: false, repliesPending: 0 };

describe("trial plan", () => {
  it("counts trial days 1 to 5", () => {
    expect(trialDay({ ...base, now: start + 1000 })).toBe(1);
    expect(trialDay({ ...base, now: start + 3.5 * D })).toBe(4);
    expect(trialDay({ ...base, now: start + 20 * D })).toBe(5);
    expect(trialDay({ ...base, status: "active", now: start })).toBeNull();
  });
  it("points at the first undone step due today", () => {
    const p = trialPlan({ ...base, strong: 0, now: start + 1000 })!;
    expect(p.next?.title).toBe("Discover relevant opportunities");
    const p4 = trialPlan({ ...base, now: start + 3.5 * D, prepared: 3, applied: 1, setupDone: true })!;
    expect(p4.next?.title).toBe("Act on the best opportunity");
    expect(p4.summaryTime).toBe(false);
    expect(trialPlan({ ...base, now: start + 6.5 * D })!.summaryTime).toBe(true);
  });
  it("links course searches, not invented courses", () => {
    expect(courseLinks("Power BI")[0].href).toBe("https://www.coursera.org/search?query=Power%20BI");
  });
});
