import { describe, it, expect, vi } from "vitest";
import type { Scored } from "@/lib/matching";
import { dayStart, foundAtFor, jobsBehind, jobTotals, summaryRows, SUMMARY_FILTERS } from "./search-summary";
import { countFoundSince } from "./state";

const row = (score: number, addedAt: string | null, relevant = true, expired = false) => ({ job: { id: `${score}-${addedAt}`, addedAt }, m: { score, relevant, expired } }) as unknown as Scored;
const ROWS = [row(92, "2026-10-25T03:00:00Z"), row(75, "2026-10-25T03:00:00Z"), row(85, "2026-10-20T00:00:00Z"), row(99, "2026-10-25T04:00:00Z", false), row(60, null), row(95, "2026-10-25T05:00:00Z", true, true)];
const SINCE = new Date("2026-10-24T18:00:00Z");

describe("job totals", () => {
  it("splits jobs into fit groups that add up to the total, with unloaded jobs under Stretch & others", () => {
    const t = jobTotals(ROWS, null, 100);
    expect(t).toEqual({ found: 100, matched: 3, ex: 1, st: 1, po: 1, rest: 97 });
    expect(t.ex + t.st + t.po + t.rest).toBe(t.found);
  });
  it("counts a window by when each job was found, and never less than the loaded jobs", () => {
    expect(jobTotals(ROWS, SINCE, 0)).toEqual({ found: 4, matched: 2, ex: 1, st: 0, po: 1, rest: 2 });
    expect(jobTotals(ROWS, SINCE, 9).rest).toBe(7);
  });
  it("every number equals the list it opens: loaded jobs plus the 'also checked' line", () => {
    for (const since of [null, SINCE]) for (const checked of [0, 6, 250]) {
      const t = jobTotals(ROWS, since, checked);
      for (const f of SUMMARY_FILTERS) {
        const b = jobsBehind(ROWS, since, f, checked);
        expect(b.rows.length + b.unlisted).toBe(t[f]);
        expect(b.count).toBe(t[f]);
        if (f !== "found" && f !== "rest") expect(b.unlisted).toBe(0);
      }
    }
  });
  it("lists the highest score first", () => {
    expect(summaryRows(ROWS, null, "found").map((x) => x.m.score)).toEqual([99, 95, 92, 85, 75, 60]);
  });
  it("finds local midnight in the person's time zone", () => {
    expect(dayStart("Asia/Dhaka", new Date("2026-10-25T13:18:42.500Z")).toISOString()).toBe("2026-10-24T18:00:00.000Z");
    expect(dayStart("Europe/London", new Date("2026-10-25T13:18:00Z")).toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });
});

describe("an account's clock starts when it joins", () => {
  const joined = "2026-10-26T10:00:00.000Z";
  it("counts jobs collected before someone joined as found when they joined, and later jobs when they arrived", () => {
    expect(foundAtFor("2026-10-20T00:00:00Z", joined)).toBe(joined);
    expect(foundAtFor(null, joined)).toBe(joined);
    expect(foundAtFor("2026-10-27T03:00:00Z", joined)).toBe("2026-10-27T03:00:00Z");
    expect(foundAtFor("2026-10-20T00:00:00Z", null)).toBe("2026-10-20T00:00:00Z");
  });
  it("a new account's first window has the same numbers as all time", () => {
    const rows = [row(95, "2026-10-01T00:00:00Z"), row(60, "2026-10-26T12:00:00Z")].map((x) => ({ ...x, job: { ...x.job, foundAt: foundAtFor(x.job.addedAt, joined) } })) as Scored[];
    expect(jobTotals(rows, new Date(joined), 187)).toEqual(jobTotals(rows, null, 187));
    expect(jobTotals(rows, new Date("2026-10-26T11:00:00Z"), 0).ex).toBe(0);
  });
  it("counts from the joining moment or from the database, never from loaded jobs alone", async () => {
    const gte = vi.fn(), db = { from: () => ({ select: () => { const q = { eq: () => q, gte: (...a: unknown[]) => { gte(...a); return q; }, then: (f: (v: unknown) => unknown) => f({ count: 12, error: null }) }; return q; } }) };
    const st = { userId: "u", country: "BD", analysed: 187, profile: { created_at: "2026-10-26T17:00:00Z" } } as never;
    expect(await countFoundSince(db as never, st, new Date("2026-10-26T17:00:00Z"))).toBe(187);
    expect(gte).not.toHaveBeenCalled();
    expect(await countFoundSince(db as never, st, new Date("2026-10-27T06:00:00Z"))).toBe(12);
    expect(gte).toHaveBeenCalledWith("jobs.created_at", "2026-10-27T06:00:00.000Z");
  });
});
