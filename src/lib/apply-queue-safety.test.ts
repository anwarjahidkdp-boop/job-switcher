import { expect, it } from 'vitest';
import { applyQueue, queueSafety } from './apply-queue';
import type { UserState } from './server/state';

function fixture() {
 const job={id:'audit',country:'BD',active:true,title:'Internal Auditor',company:'Example',location:'Dhaka',type:'Permanent',required:['internal audit'],minYears:5,salaryMin:null,salaryMax:null,eligibility:{}};
 return {P:{salaryMin:70000,salaryConfirmed:true,birthDate:'1987-12-05',workAuthorization:'yes',sponsorshipRequired:false,years:13,skills:[{name:'internal audit'}]},country:'BD',today:'2026-10-24',profile:{preferences:{salaryMin:70000},answer_library:{workAuthorization:'yes'},deal_breakers:{},needs_visa:false},dismissed:new Set(),apps:{},scored:[{job,m:{score:79,relevant:true,expired:false}}]} as unknown as UserState;
}
it('shows a real Good Fit with unpublished salary as verification pending, never preparation ready',()=>{
 const st=fixture();
 expect(applyQueue(st).map(x=>x.job.id)).toEqual(['audit']);
 expect(queueSafety(st,st.scored[0].job)).toMatchObject({safe:false,issues:[{code:'salary_unpublished',blocking:true}]});
 st.scored[0].job.salaryMin=75000;st.scored[0].job.salaryMax=85000;
 expect(queueSafety(st,st.scored[0].job).safe).toBe(true);
});
it('never treats an actual salary or age mismatch as the fallback opportunity',()=>{
 const st=fixture();st.scored[0].job.salaryMax=52000;
 expect(applyQueue(st)).toEqual([]);
 st.scored[0].job.salaryMax=null;
 st.scored[0].job.eligibility={maxAge:32,ageAsOf:'2026-10-24'};
 expect(applyQueue(st)).toEqual([]);
});
it('does not use unpublished salary to bypass missing required skills',()=>{
 const st=fixture();st.P!.skills=[];
 expect(applyQueue(st)).toEqual([]);
});
