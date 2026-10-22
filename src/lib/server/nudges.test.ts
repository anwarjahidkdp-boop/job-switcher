import { describe, expect, it } from "vitest";
import { isoWeek } from "./nudges";

describe("career report scheduling", () => {
  it("uses a stable ISO-week key so paid reports dedupe weekly", () => {
    expect(isoWeek(new Date("2026-10-23T12:00:00Z"))).toBe("2026-W43");
    expect(isoWeek(new Date("2026-10-25T23:59:00Z"))).toBe("2026-W43");
    expect(isoWeek(new Date("2026-10-26T00:01:00Z"))).toBe("2026-W44");
  });
});

// Exercise the five-day journey through the scheduler with synthetic records.
import { beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("./notify",()=>({notify:vi.fn().mockResolvedValue(1)}));
vi.mock("../email/send",()=>({emailProvider:()=>null}));
import { notify } from "./notify";
import { sendNudges } from "./nudges";
function schedulerDb(day:number) {
 const db={from(table:string){
  const calls:[string,unknown[]][]=[];const q:Record<string,unknown>={};
  for(const k of ['select','eq','is','gte','lte','limit','in','order','maybeSingle','update'])q[k]=(...args:unknown[])=>{calls.push([k,args]);return q;};
  q.then=(resolve:(r:unknown)=>unknown)=>{
   const selected=String(calls.find(([k])=>k==='select')?.[1][0]||'');
   let data:unknown=[];
   if(table==='profiles')data=selected==='onboarding_step'?{onboarding_step:'done'}:[{id:'u',email:'test@example.invalid',full_name:'Synthetic',email_reminders:false}];
   if(table==='subscriptions'&&calls.some(([k,a])=>k==='eq'&&a[1]==='trialing'))data=[{user_id:'u',trial_started_at:'2026-10-01T00:00:00Z',trial_ends_at:'2026-10-06T00:00:00Z'}];
   if(table==='matches')data=[{score:80,relevant:true}];
   return resolve({data,count:20,error:null});
  };return q;
 }};return {db:db as unknown as SupabaseClient,now:new Date(Date.parse('2026-10-01T00:00:00Z')+(day-1)*86400000)};
}
beforeEach(()=>vi.mocked(notify).mockClear());
describe('trial report journey',()=>{
 it.each([1,2,3,4])('schedules approved progress for day %s',async day=>{
  const x=schedulerDb(day);await sendNudges(x.db,{appUrl:'https://example.invalid',now:x.now});
  expect(notify).toHaveBeenCalledWith(x.db,'u',[expect.objectContaining({title:expect.stringContaining(`Day ${day}`),key:`trial:day:${day}`})]);
 });
 it('uses the approved five-day report title and a stable dedupe key',async()=>{
  const x=schedulerDb(5);await sendNudges(x.db,{appUrl:'https://example.invalid',now:x.now});
  expect(notify).toHaveBeenCalledWith(x.db,'u',[expect.objectContaining({title:'Your First 5 Days with JobPao',key:'trial:day:5'})]);
 });
});
