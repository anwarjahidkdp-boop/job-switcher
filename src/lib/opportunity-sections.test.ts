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
