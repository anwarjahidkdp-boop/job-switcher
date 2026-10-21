import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadVisibleJobs, PAGE_NEWEST } from "./state";

/** A tiny stand-in for the Supabase query builder: records each query's calls and answers from `answer`. */
function fakeDb(answer: (table: string, calls: [string, unknown[]][]) => unknown[]) {
  const log: { table: string; calls: [string, unknown[]][] }[] = [];
  const db = {
    from(table: string) {
      const q = { table, calls: [] as [string, unknown[]][] };
      log.push(q);
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "or", "order", "limit", "in", "not", "is"]) b[m] = (...a: unknown[]) => { q.calls.push([m, a]); return b; };
      b.then = (res: (v: unknown) => unknown) => res({ data: answer(table, q.calls), error: null });
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, log };
}
const job = (id: string) => ({ id, owner_id: null, source_kind: "ats", source_label: "x", country: "US", title: "Engineer", company: "Acme", category: "IT", required_skills: [], preferred_skills: [], certs: [] });
const has = (calls: [string, unknown[]][], m: string, v?: unknown) => calls.some(([n, a]) => n === m && (v === undefined || a.includes(v)));

describe("loadVisibleJobs", () => {
  it("scores the newest jobs plus the best stored matches on a page view, not every job", async () => {
    const { db, log } = fakeDb((table, calls) => {
      if (table === "matches") return [{ job_id: "best1" }, { job_id: "best2" }];
      if (has(calls, "in")) return [job("best1"), job("best2")];
      if (has(calls, "eq", "u1") && !has(calls, "or")) return [];
      return [job("new1"), job("best1")];
    });
    const jobs = await loadVisibleJobs(db, "u1", "US", ["IT"]);
    expect(jobs.map((j) => j.id).sort()).toEqual(["best1", "best2", "new1"]);
    const newest = log.find((q) => q.table === "jobs" && has(q.calls, "or") && has(q.calls, "limit") && !has(q.calls, "in"))!;
    expect(has(newest.calls, "limit", PAGE_NEWEST)).toBe(true);
  });
  it("falls back to the full list when no matches are stored yet, and for the daily refresh", async () => {
    for (const all of [false, true]) {
      const { db, log } = fakeDb((table) => (table === "matches" ? [] : [job("a")]));
      await loadVisibleJobs(db, "u1", "US", ["IT"], { all });
      const q = log.filter((x) => x.table === "jobs");
      expect(q).toHaveLength(1);
      expect(has(q[0].calls, "limit", 1000)).toBe(true);
    }
  });
});
