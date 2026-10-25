import { describe, it, expect } from "vitest";
import type { Scored } from "@/lib/matching";
import { bandCounts, dayStart, searchSummary, summaryRows } from "./search-summary";

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

describe("searchSummary", () => {
  const row = (score: number, addedAt: string | null, relevant = true) => ({ job: { addedAt }, m: { score, relevant, expired: false } }) as unknown as Scored;
  it("counts today's new jobs and all visible jobs from the page's own scores", () => {
    const r = searchSummary([row(92, "2026-10-25T03:00:00Z"), row(75, "2026-10-25T03:00:00Z"), row(85, "2026-10-20T00:00:00Z"), row(99, "2026-10-25T04:00:00Z", false), row(60, null)], new Date("2026-10-24T18:00:00Z"), 100);
    expect(r.today).toEqual({ total: 3, ex: 1, st: 0, po: 1, lo: 0, other: 1 });
    expect(r.all).toEqual({ total: 100, ex: 1, st: 1, po: 1, lo: 1, other: 96 });
  });
  it("lists exactly the jobs behind each summary number", () => {
    const rows = [row(92, "2026-10-25T03:00:00Z"), row(75, "2026-10-25T03:00:00Z"), row(85, "2026-10-20T00:00:00Z"), row(99, "2026-10-25T04:00:00Z", false), row(60, null)];
    const since = new Date("2026-10-24T18:00:00Z");
    const r = searchSummary(rows, since, 5);
    const n = (when: Date | null, f: Parameters<typeof summaryRows>[2]) => summaryRows(rows, when, f).length;
    expect([n(since, "found"), n(since, "matched"), n(since, "ex"), n(since, "st"), n(since, "po"), n(since, "rest")]).toEqual([r.today.total, r.today.ex + r.today.st + r.today.po, r.today.ex, r.today.st, r.today.po, r.today.lo + r.today.other]);
    expect([n(null, "found"), n(null, "matched"), n(null, "st"), n(null, "rest")]).toEqual([5, 3, 1, 2]);
    expect(summaryRows(rows, null, "found").map((x) => x.m.score)).toEqual([99, 92, 85, 75, 60]);
  });
});
