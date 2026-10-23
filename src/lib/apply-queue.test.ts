import { describe,it,expect,vi } from 'vitest';
import { applyQueue } from './apply-queue';
import type { UserState } from './server/state';
vi.mock('./career-safety',()=>({applicationSafety:(job:{id:string})=>({safe:job.id!=='unsafe',issues:[]})}));
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
  expect(applyQueue(st).map(x=>x.job.id)).not.toContain('manual');
 });
 it('does not fill an empty queue with weak matches',()=>{
  const st=state();st.scored=[match('weak',69)];expect(applyQueue(st)).toEqual([]);
 });
});
