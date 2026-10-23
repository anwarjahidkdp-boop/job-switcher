import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only',()=>({}));
vi.mock('./state',()=>({loadState:vi.fn(),loadJob:vi.fn()}));
import { loadJob, loadState } from './state';
import { markOpened, setReminder, preparePack } from './applications';
// A stale page loads a ready application; a send claims it before the next mutation.
function context() {
 const mutations:{patch:unknown;filters:unknown[]}[]=[];
 const db={from(table:string){
  let patch:unknown;const filters:unknown[]=[];
  const q:Record<string,unknown>={};
  for(const m of ['select','eq','maybeSingle','single'])q[m]=()=>q;
  q.not=(...a:unknown[])=>{filters.push(['not',...a]);return q;};q.is=(...a:unknown[])=>{filters.push(['is',...a]);return q;};
  q.update=(p:unknown)=>{patch=p;return q;};q.insert=()=>q;
  q.then=(r:(x:unknown)=>unknown)=>{if(patch){mutations.push({patch,filters});return r({data:null,error:null});}return r({data:table==='applications'?{id:'a',status:'ready',pack:{}}:null,error:null});};
  return q;
 }} as unknown as SupabaseClient;
 return {ctx:{db,admin:db,userId:'u'},mutations};
}
describe('stale application page safeguards',()=>{
 it('does not prepare or mutate an application for an inactive source listing',async()=>{
  vi.mocked(loadState).mockResolvedValue({P:{},master:{}} as unknown as NonNullable<Awaited<ReturnType<typeof loadState>>>);
  vi.mocked(loadJob).mockResolvedValue({active:false} as unknown as NonNullable<Awaited<ReturnType<typeof loadJob>>>);
  const x=context();await expect(preparePack(x.ctx,'held-job')).rejects.toThrow('source is reviewed');
  expect(x.mutations).toHaveLength(0);
 });
 it('opening a portal never overwrites a concurrently submitted or sending application',async()=>{
  const x=context();await markOpened(x.ctx,'j');expect(x.mutations[0].filters).toEqual(expect.arrayContaining([['is','sending_at',null],['not','status','in','(applied,interview,offer,closed,withdrawn)']]));
 });
 it('refuses a reminder mutation when a send won the race',async()=>{
  vi.mocked(loadJob).mockResolvedValue({deadline:null} as unknown as NonNullable<Awaited<ReturnType<typeof loadJob>>>);
  const x=context();await expect(setReminder(x.ctx,'j','2026-10-24','2026-10-23')).rejects.toThrow('being sent');
  expect(x.mutations).toHaveLength(1);expect(x.mutations[0].filters).toContainEqual(['is','sending_at',null]);
 });
});
