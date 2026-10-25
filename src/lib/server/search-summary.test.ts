import { describe, it, expect } from "vitest";
import { bandCounts, dayStart } from "./search-summary";

describe("search summary", () => {
  it("splits jobs into five bands that add up to the total", () => {
    const c = bandCounts([{ score: 95, relevant: true }, { score: 85, relevant: true }, { score: 72, relevant: true }, { score: 60, relevant: true }, { score: 40, relevant: true }, { score: 99, relevant: false }]);
    expect(c).toEqual({ total: 6, ex: 1, st: 1, po: 1, lo: 1, other: 2 });
    expect(c.ex + c.st + c.po + c.lo + c.other).toBe(c.total);
  });

  it("finds local midnight in the person's time zone", () => {
    expect(dayStart("Asia/Dhaka", new Date("2026-10-25T13:18:42.500Z")).toISOString()).toBe("2026-10-24T18:00:00.000Z");
    expect(dayStart("Europe/London", new Date("2026-10-25T13:18:00Z")).toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });
});
