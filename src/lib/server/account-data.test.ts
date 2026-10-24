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
it('exports real-shaped match history without an id column and retains both versions of a job',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const sql=new PGlite();
 try{
  await sql.exec("create table match_assessments(user_id text,job_id text,computed_at timestamptz,score int,primary key(user_id,job_id,computed_at)); insert into match_assessments values('owner','job','2026-10-20',70),('owner','job','2026-10-21',80),('other','job','2026-10-22',90)");
  const db={from:(table:string)=>{const orders:string[]=[];let owner='';const q={select:()=>q,eq:(_col:string,id:string)=>{owner=id;return q;},order:(key:string)=>{orders.push(key);return q;},range:async(from:number,to:number)=>table==='match_assessments'?{data:(await sql.query(`select * from match_assessments where user_id=$1 order by ${orders.join(',')} limit $2 offset $3`,[owner,to-from+1,from])).rows,error:null}:{data:[],error:null}};return q;}} as unknown as SupabaseClient;
  const data=await exportAccount(db,'owner');expect(data.match_assessments).toHaveLength(2);expect(data.match_assessments.map(r=>(r as {score:number}).score)).toEqual([70,80]);
 }finally{await sql.close();}
});
