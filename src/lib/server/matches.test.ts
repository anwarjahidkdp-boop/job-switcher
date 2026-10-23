import {expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
vi.mock('./state',()=>({loadState:vi.fn()}));
import {loadState} from './state';
import {refreshMatches} from './matches';
it('invalidates old opinions before rechecking all existing jobs and persisting their new scores',async()=>{
 const calls:{kind:string;value:unknown}[]=[];
 const db={from(table:string){
  expect(table).toBe('matches');const q:Record<string,unknown>={};
  q.update=(value:unknown)=>{calls.push({kind:'update',value});return q;};
  q.eq=(...value:unknown[])=>{calls.push({kind:'eq',value});return q;};
  q.not=()=>q;q.upsert=(value:unknown)=>{calls.push({kind:'upsert',value});return q;};
  q.then=(resolve:(x:unknown)=>unknown)=>resolve({error:null});return q;
 }} as unknown as SupabaseClient;
 vi.mocked(loadState).mockImplementation(async()=>{
  expect(calls[0]).toEqual({kind:'update',value:{ai_fit:null,ai_score:null,ai_reason:null,ai_checked_at:null}});
  return {P:{},scored:[{job:{id:'job'},m:{score:54,band:'lo',relevant:true,capped:true,reason:'Seniority mismatch',matched:[],gaps:[]}}]} as never;
 });
 expect(await refreshMatches(db,'u',{invalidateAi:true})).toBe(1);
 expect(loadState).toHaveBeenCalledWith(db,'u',undefined,{allJobs:true});
 expect(calls.find(c=>c.kind==='upsert')?.value).toEqual([expect.objectContaining({user_id:'u',job_id:'job',score:54,reason:'Seniority mismatch'})]);
});
