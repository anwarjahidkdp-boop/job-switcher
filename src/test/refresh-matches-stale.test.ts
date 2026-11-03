// Retiring stale matches must not put every scored job id into one request URL (PostgREST 400 past ~1,000 jobs).
import { describe, expect, it, vi } from "vitest";

const scored = Array.from({ length: 1200 }, (_, i) => ({ job: { id: `job-${i}` }, m: { score: 80, band: "good", relevant: true, capped: false, reason: "", matched: [], gaps: [] } }));
vi.mock("@/lib/server/state", () => ({ loadState: async () => ({ P: {}, scored }) }));
vi.mock("../lib/server/state", () => ({ loadState: async () => ({ P: {}, scored }) }));

type Call = { table: string; op: string; filters: [string, string, unknown][] };
function fakeDb(relevantNow: string[]) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      const q: Record<string, unknown> = {};
      const chain = (name: string) => (...a: unknown[]) => { call.filters.push([name, String(a[0]), a[1]]); return q; };
      Object.assign(q, {
        select: () => q, update: () => { call.op = "update"; return q; }, upsert: () => { call.op = "upsert"; calls.push(call); return Promise.resolve({ error: null }); },
        eq: chain("eq"), in: chain("in"), not: chain("not"), order: () => q, range: (a: number, b: number) => { call.filters.push(["range", String(a), b]); return q; },
        then: (res: (v: unknown) => unknown) => {
          calls.push(call);
          const r = call.filters.find((f) => f[0] === "range");
          const data = table === "matches" && call.op === "select" && r ? relevantNow.slice(Number(r[1]), Number(r[2]) + 1).map((job_id) => ({ job_id })) : [];
          return Promise.resolve({ data, error: null }).then(res);
        },
      });
      return q;
    },
  };
  return { db, calls };
}

describe("refreshMatches retires stale matches in small batches", () => {
  it("updates only jobs no longer scored, never with a giant not-in filter", async () => {
    const { refreshMatches, STALE_BATCH } = await import("@/lib/server/matches");
    const gone = Array.from({ length: 1400 }, (_, i) => `old-${i}`);
    const { db, calls } = fakeDb([...gone, "job-1", "job-2"]);
    const n = await refreshMatches(db as never, "u1");
    expect(n).toBe(1200);
    const updates = calls.filter((c) => c.table === "matches" && c.op === "update");
    expect(updates).toHaveLength(Math.ceil(gone.length / STALE_BATCH));
    const retired = updates.flatMap((c) => c.filters.filter((f) => f[0] === "in").flatMap((f) => f[2] as string[]));
    expect(retired.sort()).toEqual([...gone].sort());
    expect(calls.some((c) => c.filters.some((f) => f[0] === "not"))).toBe(false);
  });
});
