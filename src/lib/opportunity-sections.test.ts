import {expect,it} from 'vitest';
import {opportunitySections,type Scored} from './matching';
const row=(id:string,score:number)=>({job:{id},m:{score,relevant:true,expired:false}} as Scored);
it('features 79% ahead of 55% regardless of an existing prepared application',()=>{
 const rows=[row('unprepared-55',55),row('prepared-79',79),row('next-70',70)];
 const view=opportunitySections(rows,new Set());
 expect(view.featured?.job.id).toBe('prepared-79');expect(view.remaining.map(x=>x.job.id)).toEqual(['next-70','unprepared-55']);
 expect(view.remaining.some(x=>x.job.id===view.featured?.job.id)).toBe(false);
});
it('advances to the next highest available fit when the first is removed or expired',()=>{
 const rows=[row('strong',95),row('best',84),row('good',79)];rows[0].m.expired=true;
 const view=opportunitySections(rows,new Set(['best']));expect(view.featured?.job.id).toBe('good');expect(view.remaining).toEqual([]);
});
it('advances past submitted, interview, offer and closed jobs while retaining a prepared higher match',()=>{
 const rows=[row('sent',99),row('interview',97),row('offer',95),row('closed',93),row('prepared',79),row('next',65)];
 const apps=Object.fromEntries([['sent','applied'],['interview','interview'],['offer','offer'],['closed','closed'],['prepared','ready']].map(([id,status])=>[id,{status,applied_at:null}])) as unknown as Parameters<typeof opportunitySections>[2];
 const result=opportunitySections(rows,new Set(),apps);expect(result.featured?.job.id).toBe('prepared');expect(result.remaining.map(x=>x.job.id)).toEqual(['next']);
});
it('does not recycle a job with an immutable applied timestamp even if a legacy status is inconsistent',()=>{
 const apps={sent:{status:'ready',applied_at:'2026-10-24'}} as unknown as Parameters<typeof opportunitySections>[2];
 expect(opportunitySections([row('sent',99)],new Set(),apps).featured).toBeNull();
});
