import { describe, expect, it } from "vitest";
import { packAllowance, packLimits } from "./pack-limits";

const now = Date.parse("2026-10-21T12:00:00Z");
const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();

describe("AI application limits", () => {
  it("Bangladesh Pro: 2 a day, 10 a week, 40 a month", () => {
    expect(packLimits("pro", "BD")).toEqual({ day: 2, week: 10, month: 40 });
    expect(packLimits("trial", "GB").month).toBe(10);
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
