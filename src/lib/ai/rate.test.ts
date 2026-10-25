import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
process.env.ANTHROPIC_API_KEY = "test-key";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AIError, RATE_MAX_CALLS, runAI } from "./index";

/** Admin client stand-in: a Pro budget with room left, and `recent` AI calls in the last 10 minutes. */
function admin(recent: number) {
  const inserts: unknown[] = [];
  const chain = (result: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "maybeSingle"]) b[m] = () => b;
    b.then = (res: (v: unknown) => unknown) => res(result);
    return b;
  };
  const db = {
    rpc: async (name: string) => name === "reserve_ai_call" ? ({ data: 1, error: null }) : ({ data: [{ spent_micro_usd: 0, cap_micro_usd: 1_000_000, plan_code: "trial", status: "trialing", trial_ends_at: new Date(Date.now() + 86_400_000).toISOString() }], error: null }),
    from: (t: string) => (t === "ai_usage" ? { ...chain({ count: recent, error: null }), update: (r: unknown) => { inserts.push(r); return chain({ data: { id: 1 }, error: null }); } } : chain({ data: null, error: null })),
  };
  return { db: db as unknown as SupabaseClient, inserts };
}
const call = async () => ({ data: 1, usage: { model: "m", inputTokens: 1, outputTokens: 1, costMicroUsd: 10 } });

describe("runAI rate limit", () => {
  it("lets normal use through and records it", async () => {
    const a = admin(3);
    await expect(runAI(a.db, "u1", "cv_edit", call)).resolves.toMatchObject({ data: 1 });
    expect(a.inserts).toHaveLength(1);
  });
  it("stops a person past the limit before any AI call", async () => {
    const fn = vi.fn(call);
    await expect(runAI(admin(RATE_MAX_CALLS).db, "u1", "cv_edit", fn)).rejects.toBeInstanceOf(AIError);
    expect(fn).not.toHaveBeenCalled();
  });
  it("never blocks the daily background checks", async () => {
    await expect(runAI(admin(RATE_MAX_CALLS + 5).db, "u1", "match_check", call)).resolves.toMatchObject({ data: 1 });
  });
});

 it("does not call AI if its atomic reservation is unavailable", async()=>{
   const a=admin(0),fn=vi.fn(call);const old=a.db.rpc;
   a.db.rpc=vi.fn(async(name:string,...args:unknown[])=>name === "reserve_ai_call" ? {data:null,error:{message:"rate_limited"}} : old(name,...args)) as unknown as typeof a.db.rpc;
   await expect(runAI(a.db,"u1","cv_edit",fn)).rejects.toMatchObject({code:"rate_limited"});expect(fn).not.toHaveBeenCalled();
 });

it("releases an unknown provider failure without deleting its audit record",async()=>{
 const a=admin(0);await expect(runAI(a.db,"u1","cv_edit",async()=>{throw new Error("timeout");})).rejects.toThrow("timeout");
 expect(a.inserts).toContainEqual(expect.objectContaining({model:"__failed_unknown__",cost_micro_usd:0,ok:false}));
});
