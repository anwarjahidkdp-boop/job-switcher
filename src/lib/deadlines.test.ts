import {expect,it} from 'vitest';
import {deadlineItems} from './deadlines';
import type {UserState} from './server/state';
const now=new Date('2026-10-24T06:00:00Z');
function state(){return {P:{salaryMin:null,workAuthorization:'yes'},country:'BD',today:'2026-10-24',profile:{preferences:null,deal_breakers:{},answer_library:{},needs_visa:false},dismissed:new Set(),apps:{},scored:[['a','2026-10-24',90],['b','2026-10-25',80],['c','2026-10-27',70]].map(([id,deadline,score])=>({job:{id,deadline,country:'BD',active:true,title:'Accounts Manager',company:'Example',minYears:0},m:{score,relevant:true,expired:false}}))} as unknown as UserState;}
it('uses 3-day, tomorrow and closing-day milestones with distinct dedupe keys',()=>{
 const items=deadlineItems(state(),now);expect(items.map(x=>x.days)).toEqual([0,1,3]);expect(new Set(items.map(x=>x.key)).size).toBe(3);
 expect(items[0].body).toContain('exact closing time');
});
it('waits until the local morning and uses the current search timezone',()=>{
 expect(deadlineItems(state(),new Date('2026-10-24T01:00:00Z'))).toEqual([]);
 const st=state();st.country='US';st.scored.forEach(x=>{x.job.country='US';});expect(deadlineItems(st,now)).toEqual([]);
 expect(deadlineItems(st,new Date('2026-10-24T13:00:00Z')).length).toBe(3);
});
it('drops removed, submitted, other-country and closed opportunities',()=>{
 const st=state();st.dismissed.add('a');st.apps.b={status:'applied'} as never;st.scored[2].job.country='GB';expect(deadlineItems(st,now)).toEqual([]);
 st.scored[2].job.country='BD';st.scored[2].job.active=false;expect(deadlineItems(st,now)).toEqual([]);
});
it('does not invent unknown deadlines or send expired ones',()=>{
 const st=state();st.scored[0].job.deadline=null;st.scored[1].job.deadline='2026-10-23';st.scored[2].job.deadline='2026-10-26';expect(deadlineItems(st,now)).toEqual([]);
});
it('reschedules with a new dedupe key when the source deadline changes',()=>{
 const st=state(),key=deadlineItems(st,now)[0].key;st.scored[0].job.deadline='2026-10-27';expect(deadlineItems(st,now)[0].key).not.toBe(key);
});
