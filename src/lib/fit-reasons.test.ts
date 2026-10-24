import {expect,it} from 'vitest';
import {fitReasonSummary} from './fit-reasons';
import type {Scored} from './matching';
const row=(id:string,reason='Seniority mismatch',detail='',score=54,gaps:Scored['m']['gaps']=[])=>({job:{id,title:'Accounts Officer',company:'Example',active:true},m:{score,relevant:true,expired:false,reason,reasonDetail:detail,gaps,allGaps:gaps}} as Scored);
it('counts unique jobs once per primary reason rather than score points or skill totals',()=>{
 const rows=[...Array.from({length:25},(_,i)=>row('sen'+i)),...Array.from({length:15},(_,i)=>row('edu'+i,'Education requirement'))];
 const result=fitReasonSummary([...rows,rows[0]]);expect(result.total).toBe(40);expect(result.groups.map(g=>g.count)).toEqual([25,15]);expect(result.groups.reduce((n,g)=>n+g.count,0)).toBe(result.total);expect(result.groups[0].examples).toHaveLength(2);
});
it('shows the exact job-level evidence in examples and does not invent a rejection',()=>{
 const gap={k:'sen',o:0,t:'Below your established career level Manager: this is Mid-level.'};
 const result=fitReasonSummary([row('sen','Seniority mismatch','',54,[gap])]);expect(result.groups[0].examples[0].explanation).toBe(gap.t);
});
it('distinguishes unknown age cutoff from being over the posted age limit',()=>{
 const message='The circular’s age calculation date is not stated. Eligibility cannot be confirmed from today’s age alone.';
 const result=fitReasonSummary([row('age',message,'',54,[{k:'age_cutoff_unknown',o:0,t:message}])]);
 expect(result.groups[0].title).toBe('Age eligibility needs checking');expect(result.groups[0].description).toContain('does not mean you are over the age limit');
});
it('excludes expired, irrelevant, inactive and Good Fit jobs while distinguishing unconfirmed skills',()=>{
 const expired=row('expired');expired.m.expired=true;const irrelevant=row('irrelevant');irrelevant.m.relevant=false;const inactive=row('inactive');inactive.job.active=false;
 const result=fitReasonSummary([expired,irrelevant,inactive,row('good','','',70),row('skill','Missing skill','VAT & Tax',65)]);
 expect(result.total).toBe(1);expect(result.groups[0].title).toBe('Skill not confirmed: VAT & Tax');expect(result.groups[0].description).toContain('Add them only if you have them');
});
