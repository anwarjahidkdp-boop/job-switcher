import { expect, it } from "vitest";
import { applicationInSearch, assertSearchCountry, currentCountryApps } from "./application-country";
import { trialApplyRoom, unlockedReady } from "./pack-limits";
it('removes old-country selections while keeping the current country free slot',()=>{
 const apps=[{job_id:'old',status:'ready',created_at:'2026-10-21',applied_at:null,jobs:{country:'GB'}},{job_id:'current',status:'ready',created_at:'2026-10-23',applied_at:null,jobs:{country:'BD'}}];
 const active=apps.filter(a=>applicationInSearch(a,'BD'));
 expect(active.map(a=>a.job_id)).toEqual(['current']);
 expect([...unlockedReady(active,trialApplyRoom(active))]).toEqual(['current']);
});
it('keeps a sent application in account-wide usage after switching country',()=>{
 const sent={applied_at:new Date().toISOString(),jobs:{country:'GB'}};
 expect(applicationInSearch(sent,'BD')).toBe(true);
 expect(trialApplyRoom([sent].filter(a=>applicationInSearch(a,'BD')))).toBe(0);
});
it('rejects stale actions for a previous-country vacancy',()=>{
 expect(()=>assertSearchCountry('GB','BD')).toThrow('previous search country');
 expect(()=>assertSearchCountry('BD','BD')).not.toThrow();
});
it('keeps only the current search country on the dashboard, treating rows without a joined job as current',()=>{
 const apps={a:{jobs:{country:'BD'}},b:{jobs:{country:'GB'}},c:{}};
 expect(Object.keys(currentCountryApps(apps,'BD'))).toEqual(['a','c']);
});
