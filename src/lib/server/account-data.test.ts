import {it,expect,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
vi.mock('server-only',()=>({}));
import {removePrivateFolder,exportAccount} from './account-data';
it('collects every storage page before removing, including nested CV folders',async()=>{
 const removed:string[]=[];const list=vi.fn(async(prefix:string,{offset}:{offset:number})=>({data:prefix==='u/cv'?[{id:'cv',name:'resume.pdf'}]:offset===0?Array.from({length:1000},(_,i)=>({id:`${i}`,name:`${i}.txt`})):[{id:'last',name:'last.txt'},{id:null,name:'cv'}],error:null}));
 const admin={storage:{from:()=>({list,remove:async(paths:string[])=>{removed.push(...paths);return {error:null};}})}} as unknown as SupabaseClient;
 await removePrivateFolder(admin,'cv-files','u');expect(removed).toHaveLength(1002);expect(removed).toContain('u/last.txt');expect(removed).toContain('u/cv/resume.pdf');
});
it('fails closed on a storage error instead of reporting successful private-file deletion',async()=>{
 const admin={storage:{from:()=>({list:async()=>({data:[],error:new Error('storage unavailable')})})}} as unknown as SupabaseClient;
 await expect(removePrivateFolder(admin,'cv-files','u')).rejects.toThrow('storage unavailable');
});
it('exports owner-filtered records beyond the REST row limit and includes reports/payments',async()=>{
 const filters:string[][]=[];
 const db={from:(table:string)=>{const q={select:()=>q,eq:(col:string,id:string)=>{filters.push([table,col,id]);return q;},order:()=>q,range:async(from:number)=>({data:table==='career_facts'&&from===0?Array.from({length:1000},()=>({})):from===1000?[{id:'last'}]:[],error:null})};return q;}} as unknown as SupabaseClient;
 const result=await exportAccount(db,'owner');expect(result.career_facts).toHaveLength(1001);expect(result).toHaveProperty('payments');expect(result).toHaveProperty('career_reports');expect(filters.every(f=>f[2]==='owner')).toBe(true);
});
it('does not turn a failed private-data export into empty successful data',async()=>{
 const db={from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,range:async()=>({error:new Error('database unavailable')})};return q;}} as unknown as SupabaseClient;
 await expect(exportAccount(db,'owner')).rejects.toThrow('database unavailable');
});
