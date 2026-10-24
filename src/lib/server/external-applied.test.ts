import {expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
vi.mock('server-only',()=>({}));
vi.mock('./state',()=>({loadJob:vi.fn(),loadState:vi.fn()}));
import {loadJob} from './state';
import {confirmExternalApplied} from './applications';
function fixture(opts:{race?:boolean;used?:boolean;status?:string}={}){
 const app={id:'a',status:opts.status||'ready',pack:{cover_letter:'Draft'}};
 const updates:unknown[]=[],events:unknown[]=[],filters:unknown[]=[];
 const db={from(table:string){let patch:Record<string,unknown>|undefined,select='';const q:Record<string,unknown>={};
  q.select=(s:string)=>{select=s;return q;};q.maybeSingle=()=>q;
  for(const method of ['eq','is','in','not'])q[method]=(...args:unknown[])=>{filters.push([method,...args]);return q;};
  q.update=(p:Record<string,unknown>)=>{patch=p;return q;};q.delete=()=>q;q.insert=(p:unknown)=>{events.push(p);return q;};
  q.then=(resolve:(r:unknown)=>unknown)=>{if(table==='applications'&&patch){updates.push(patch);if(opts.race)return resolve({data:null,error:null});Object.assign(app,patch);}return resolve({error:null,data:table==='profiles'?{target_country:'BD'}:table==='subscriptions'?{plan_code:opts.used?'trial':'pro',status:opts.used?'trialing':'active'}:table==='applications'?(select==='applied_at'?(opts.used?[{applied_at:new Date().toISOString()}]:[]):app):null});};return q;
 }} as unknown as SupabaseClient;
 vi.mocked(loadJob).mockResolvedValue({id:'job',country:'BD',salaryMin:null,salaryMax:null} as never);
 return {ctx:{db,admin:{} as SupabaseClient,userId:'owner'},updates,events,filters};
}
it('records an explicit external report without claiming salary eligibility or sending anything',async()=>{
 const x=fixture();await confirmExternalApplied(x.ctx,'job');
 expect(x.updates).toEqual([{status:'applied'}]);
 expect(x.filters).toContainEqual(['is','sending_at',null]);expect(x.filters).toContainEqual(['eq','user_id','owner']);
 expect(x.events).toContainEqual(expect.objectContaining({event:'You confirmed: applied externally',actor:'user'}));
 await confirmExternalApplied(x.ctx,'job');expect(x.updates).toHaveLength(1);
});
it('preserves the shared daily trial limit for manually reported submissions',async()=>{
 const x=fixture({used:true});await expect(confirmExternalApplied(x.ctx,'job')).rejects.toThrow('one application a day');expect(x.updates).toHaveLength(0);
});
it('does not overwrite a concurrently sending application',async()=>{
 const x=fixture({race:true});await expect(confirmExternalApplied(x.ctx,'job')).rejects.toThrow('being sent');expect(x.events).toHaveLength(0);
});
