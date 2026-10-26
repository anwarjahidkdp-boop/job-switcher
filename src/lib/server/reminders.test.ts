import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDueReminders, localHour, inSendWindow } from "./reminders";

describe("reminder timing", () => {
  it("computes local hour per time zone", () => {
    const t = new Date("2026-10-17T02:30:00Z");
    expect(localHour("Asia/Dhaka", t)).toBe(8);
    expect(localHour("Europe/London", t)).toBe(3);
    expect(localHour("UTC", new Date("2026-10-17T00:05:00Z"))).toBe(0);
  });
  it("sends only between 08:00 and 21:00 local, and the scheduled runs hit 08:00 in Bangladesh and the UK", () => {
    expect(inSendWindow("BD", new Date("2026-10-17T02:00:00Z"))).toBe(true); // 08:00 Dhaka
    expect(inSendWindow("BD", new Date("2026-10-17T17:00:00Z"))).toBe(false); // 23:00 Dhaka
    expect(localHour("Europe/London", new Date("2026-07-15T07:00:00Z"))).toBe(8); // BST run
    expect(localHour("Europe/London", new Date("2026-12-15T08:00:00Z"))).toBe(8); // GMT run
    expect(inSendWindow("GB", new Date("2026-12-15T07:00:00Z"))).toBe(false); // 07:00 in winter waits for the 08:00 run
    expect(inSendWindow("UK", new Date("2026-12-15T08:00:00Z"))).toBe(true);
    expect(inSendWindow("GB", new Date("2026-12-15T22:00:00Z"))).toBe(false);
  });
});

it("skips a previous-country reminder after the search country changes",async()=>{
 const admin={from(table:string){
  const q:Record<string,unknown>={};
  for(const method of ['select','is','lte','order','limit','in'])q[method]=()=>q;
  q.then=(resolve:(r:unknown)=>unknown)=>resolve({error:null,data:table==='profiles' ? [{id:'u',email:'synthetic@example.invalid',target_country:'BD',email_reminders:true}] : [{id:'r',user_id:'u',due_date:'2026-10-22',applications:{status:'reminder',pack:{}},jobs:{title:'Old role',country:'GB'}}]});
  return q;
 }} as unknown as SupabaseClient;
 const result=await sendDueReminders(admin,{appUrl:'https://example.invalid',dryRun:true,now:new Date('2026-10-23T10:00:00Z')});
 expect(result).toEqual({checked:1,sent:0,skipped:1,failed:0});
});
