import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadVisibleJobs, PAGE_NEWEST,stats,countVisibleJobs,loadState,type UserState } from "./state";

/** A tiny stand-in for the Supabase query builder: records each query's calls and answers from `answer`. */
function fakeDb(answer: (table: string, calls: [string, unknown[]][]) => unknown[]) {
  const log: { table: string; calls: [string, unknown[]][] }[] = [];
  const db = {
    from(table: string) {
      const q = { table, calls: [] as [string, unknown[]][] };
      log.push(q);
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq", "or", "order", "limit", "in", "not", "is", "range"]) b[m] = (...a: unknown[]) => { q.calls.push([m, a]); return b; };
      b.maybeSingle = async () => ({data:answer(table,q.calls)[0]||null,error:null});
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
      expect(q).toHaveLength(all ? 1 : 3);
      expect(q.some(x=>has(x.calls, all ? "range" : "limit", all ? 999 : 1000))).toBe(true);
    }
  });
});

 it("daily refresh reads beyond the first PostgREST page", async () => {
   const { db, log } = fakeDb((table, calls) => {
     if (table !== "jobs") return [];
     const from = calls.find(([m])=>m === "range")?.[1][0];
     return from === 0 ? Array.from({length:1000},(_,i)=>job(`j${i}`)) : [job("last")];
   });
   const rows = await loadVisibleJobs(db,"u1","US",["IT"],{all:true});
   expect(rows).toHaveLength(1001); expect(rows.at(-1)?.id).toBe("last");
   expect(log.filter(q=>q.table === "jobs")).toHaveLength(2);
 });

it('does not count an unsent closed draft as a submitted application',()=>{
 const st={analysed:0,scored:[],apps:{draft:{status:'closed',applied_at:null},sent:{status:'withdrawn',applied_at:'2026-10-20'}}} as unknown as UserState;
 expect(stats(st).applied).toBe(1);
});
it('personal analysis counts query only the user assessments, not the whole job inventory',async()=>{
 const {db,log}=fakeDb(()=>[]);await countVisibleJobs(db,'u1','BD');expect(log[0].table).toBe('matches');expect(has(log[0].calls,'eq','u1')).toBe(true);expect(has(log[0].calls,'eq','jobs.country')).toBe(true);
});

it('uses confirmed expected salary and notice answers for matching without an AI call',async()=>{
 const {profileFrom}=await import('./state');
 const profile={full_name:'Synthetic',target_country:'BD',career_meta:{},preferences:{roles:'Accountant',locations:'',salaryMin:20000,salaryMax:null,notice:30,mode:'Any'},answer_library:{expectedSalary:45000,noticeDays:0}};
 const master={content:{name:'Synthetic'}};
 expect(profileFrom(profile as never,[],master as never)).toMatchObject({salaryMin:45000,notice:0});
 profile.answer_library={salaryNegotiable:true} as never;
 expect(profileFrom(profile as never,[],master as never)?.salaryMin).toBeNull();
});

it('loads a profile without fetching job inventory, assessments or application packs',async()=>{
 const profile={id:'u1',home_country:'BD',target_country:'BD',onboarding_step:'done',personal:{dob:'1987-12-05'},preferences:{salaryMin:70000},career_meta:{}};
 const {db,log}=fakeDb(table=>table==='profiles'?[profile]:table==='master_cvs'?[{id:'master',content:{name:'Synthetic'},created_at:'2026-10-23'}]:[]);
 const st=await loadState(db,'u1',undefined,{skipMatching:true,skipApplications:true});
 expect(st?.P?.name).toBe('Synthetic');expect(st?.master?.id).toBe('master');
 expect(st?.scored).toEqual([]);
 for(const table of ['jobs','matches','applications'])expect(log.some(q=>q.table===table)).toBe(false);
});
