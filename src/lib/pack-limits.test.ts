import { describe, expect, it } from "vitest";
import { packAllowance, packLimits } from "./pack-limits";

const now = Date.parse("2026-10-21T12:00:00Z");
const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();

describe("AI application limits", () => {
  it("Bangladesh Pro: 2 a day, 10 a week, 40 a month", () => {
    expect(packLimits("pro", "BD")).toEqual({ day: 2, week: 10, month: 40 });
    expect(packLimits("trial", "GB")).toEqual({ day: 1, week: 5, month: 5 });
  });
  it("stops at 2 in a day", () => {
    const a = packAllowance([ago(1), ago(3)], packLimits("pro", "BD"), now);
    expect(a.left).toBe(0);
    expect(a.reason).toBe("day");
  });
  it("evens out over the week", () => {
    const week = Array.from({ length: 10 }, (_, i) => ago(30 + i * 12));
    expect(packAllowance(week, packLimits("pro", "BD"), now).reason).toBe("week");
    expect(packAllowance(week.slice(0, 9), packLimits("pro", "BD"), now).left).toBe(1);
  });
  it("caps the month at 40", () => {
    const month = Array.from({ length: 40 }, (_, i) => ago(24 * 8 + i * 12));
    expect(packAllowance(month, packLimits("pro", "BD"), now).reason).toBe("month");
  });
});

describe("free trial applying", () => {
  it("allows one a day and 5 in all", async () => {
    const { trialApplyRoom, unlockedReady } = await import("./pack-limits");
    expect(trialApplyRoom([], now)).toBe(1);
    expect(trialApplyRoom([{ applied_at: ago(2) }], now)).toBe(0);
    expect(trialApplyRoom(Array.from({ length: 5 }, (_, i) => ({ applied_at: ago(30 + i * 24) })), now)).toBe(0);
    const apps = [{ job_id: "b", status: "ready", created_at: ago(1) }, { job_id: "a", status: "ready", created_at: ago(5) }, { job_id: "c", status: "applied", created_at: ago(9) }];
    expect([...unlockedReady(apps, 1)]).toEqual(["a"]);
    expect(unlockedReady(apps, 0).size).toBe(0);
  });
});
