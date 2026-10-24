import { describe,it,expect,vi } from 'vitest';
import { applyQueue, queueHolds, queueSafety } from './apply-queue';
import type { UserState } from './server/state';
vi.mock('./career-safety',()=>({applicationSafety:(job:{id:string})=>({safe:!['unsafe','unpublished'].includes(job.id),issues:job.id==='unsafe'?[{code:'salary',message:'Salary is below your minimum.',blocking:true}]:job.id==='unpublished'?[{code:'salary_unpublished',message:'Salary is not disclosed.',blocking:true}]:[]})}));
function state() {
 return {P:{},country:'BD',today:'2026-10-24',profile:{preferences:null,deal_breakers:{},answer_library:{},needs_visa:false},dismissed:new Set(),apps:{},scored:[] } as unknown as UserState;
}
function match(id:string,score:number) {
 return {job:{id,country:'BD',active:true,deadline:null},m:{score,relevant:true,expired:false}} as UserState['scored'][number];
}
describe('automatic apply queue',()=>{
 it('ranks current Good Fit+ ahead of a legacy 54% pack',()=>{
  const st=state();st.scored=[match('old',54),match('good',72),match('strong',95),match('best',84)];
  st.apps.old={status:'ready',pack:{}} as UserState['apps'][string];
  expect(applyQueue(st).map(x=>x.job.id)).toEqual(['strong','best','good']);
 });
 it('excludes safety failures, dismissed, expired, sent and other-country jobs; fills the next slot',()=>{
  const st=state();st.scored=[match('unsafe',100),match('dismissed',99),match('sent',98),match('expired',97),match('foreign',96),match('a',90),match('b',80),match('c',70)];
  st.dismissed.add('dismissed');st.apps.sent={status:'applied'} as UserState['apps'][string];st.scored[3].m.expired=true;st.scored[4].job.country='GB';
  expect(applyQueue(st).map(x=>x.job.id)).toEqual(['a','b','c']);
  st.dismissed.add('a');expect(applyQueue(st).map(x=>x.job.id)).toEqual(['b','c']);
 });
 it('keeps an eligible user choice outside the automatic top three, without promoting a lower system pack',()=>{
  const st=state();st.scored=[match('a',95),match('b',90),match('c',85),match('manual',75),match('system',74)];
  st.apps.manual={status:'reminder',application_events:[{actor:'user'}]} as UserState['apps'][string];
  st.apps.system={status:'ready',pack:{},application_events:[{actor:'system'}]} as UserState['apps'][string];
  expect(applyQueue(st).map(x=>x.job.id)).toEqual(['a','b','c','manual']);
  st.scored.find(x=>x.job.id==='manual')!.m.score=54;
  expect(applyQueue(st).map(x=>x.job.id)).toContain('manual');
 });
 it('falls back to just the highest eligible lower match when none reach Good Fit',()=>{
  const st=state();st.scored=[match('lower',54),match('highest',69),match('next',68)];
  expect(applyQueue(st).map(x=>x.job.id)).toEqual(['highest']);
 });
 it('does not add lower system packs when a Good Fit exists',()=>{
  const st=state();st.scored=[match('good',70),match('lower',69)];
  expect(applyQueue(st).map(x=>x.job.id)).toEqual(['good']);
 });
 it('falls back past an unsafe Good Fit and explains its hold without weakening safety',()=>{
  const st=state();st.scored=[match('unsafe',79),match('safe',54)];
  expect(applyQueue(st).map(x=>x.job.id)).toEqual(['safe']);
  expect(queueHolds(st).map(x=>[x.job.id,x.issues[0].code])).toEqual([['unsafe','salary']]);
 });
 it('does not fall back to zero, irrelevant, dismissed or expired matches',()=>{
  const st=state();st.scored=[match('zero',0),match('irrelevant',69),match('dismissed',68),match('expired',67)];
  st.scored[1].m.relevant=false;st.dismissed.add('dismissed');st.scored[3].job.deadline='2026-10-23';
  expect(applyQueue(st)).toEqual([]);
 });
 it('keeps undisclosed pay visible in rank order without making it ready to prepare',()=>{
  const st=state();st.scored=[match('unpublished',79),match('safe',54)];
  expect(applyQueue(st).map(x=>x.job.id)).toEqual(['unpublished']);
  expect(queueSafety(st,st.scored[0].job).safe).toBe(false);
  expect(queueHolds(st)).toEqual([]);
 });
});
