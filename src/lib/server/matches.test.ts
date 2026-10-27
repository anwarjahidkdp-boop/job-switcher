import {expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
vi.mock('./state',()=>({loadState:vi.fn()}));
import {loadState} from './state';
import {reconcileMatchNotifications, refreshMatches} from './matches';
it('invalidates old opinions before rechecking all existing jobs and persisting their new scores',async()=>{
 const calls:{kind:string;value:unknown}[]=[];
 const db={from(table:string){
  expect(['matches','notifications']).toContain(table);const q:Record<string,unknown>={};
  q.select=()=>q;
  q.update=(value:unknown)=>{calls.push({kind:'update',value});return q;};
  q.eq=(...value:unknown[])=>{calls.push({kind:'eq',value});return q;};
  q.not=()=>q;q.upsert=(value:unknown)=>{calls.push({kind:'upsert',value});return q;};
  q.then=(resolve:(x:unknown)=>unknown)=>resolve({data:[],error:null});return q;
 }} as unknown as SupabaseClient;
 vi.mocked(loadState).mockImplementation(async()=>{
  expect(calls[0]).toEqual({kind:'update',value:{ai_fit:null,ai_score:null,ai_reason:null,ai_checked_at:null}});
  return {P:{},scored:[{job:{id:'job'},m:{score:54,band:'lo',relevant:true,capped:true,reason:'Seniority mismatch',matched:[],gaps:[]}}]} as never;
 });
 expect(await refreshMatches(db,'u',{invalidateAi:true})).toBe(1);
 expect(loadState).toHaveBeenCalledWith(db,'u',undefined,{allJobs:true});
 expect(calls.find(c=>c.kind==='upsert')?.value).toEqual([expect.objectContaining({user_id:'u',job_id:'job',score:54,reason:'Seniority mismatch'})]);
});
it('keeps match notifications on the score the page shows, and withdraws ones no longer a Top match',async()=>{
 const updates:{id:unknown;title:unknown}[]=[];const deleted:unknown[]=[];
 const notes=[{id:'n1',title:'New 100% match: Senior Manager',link:'/jobs/a'},{id:'n2',title:'New 79% match: Internal Auditor',link:'/jobs/b'},{id:'n3',title:'New 90% match: Closed job',link:'/jobs/gone'},{id:'n4',title:'New 85% match: Head of Audit',link:'/jobs/c'}];
 const db={from(){const q:Record<string,unknown>={};let pending:{title:unknown}|null=null;
  q.select=()=>q;q.update=(v:{title:unknown})=>{pending=v;return q;};q.delete=()=>q;
  q.eq=(k:string,v:unknown)=>{if(pending&&k==='id'){updates.push({id:v,title:pending.title});pending=null;}return q;};
  q.in=(_k:string,ids:unknown[])=>{deleted.push(...ids);return q;};
  q.then=(resolve:(x:unknown)=>unknown)=>resolve({data:notes,error:null});return q;}} as unknown as SupabaseClient;
 const s=(id:string,score:number,relevant=true)=>({job:{id},m:{score,relevant,expired:false}}) as never;
 await reconcileMatchNotifications(db,'u',[s('a',62),s('b',82),s('c',85)]);
 expect(deleted).toEqual(['n1']);
 expect(updates).toEqual([{id:'n2',title:'New 82% match: Internal Auditor'}]);
});
