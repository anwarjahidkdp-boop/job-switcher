import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('@/lib/server/api',()=>({apiCtx:vi.fn(),apiError:()=>new Response(null,{status:500}),unauthorized:()=>new Response(null,{status:401})}));
vi.mock('@/lib/server/state',()=>({loadState:vi.fn(),loadJob:vi.fn()}));
vi.mock('@/lib/server/applications',()=>({hasPro:vi.fn().mockResolvedValue(true)}));
import {apiCtx} from '@/lib/server/api';
import {loadState,loadJob} from '@/lib/server/state';
import {POST} from './route';
import {DEMO_MASTER} from '@/lib/demo';
import {manualDraft} from '@/lib/manual-cv';
const id='11111111-1111-4111-8111-111111111111';
const params={params:Promise.resolve({jobId:id})};
const request=(document:unknown)=>new Request('https://jobpao.app/api/applications/'+id+'/documents',{method:'POST',body:JSON.stringify(document)});
function fixture(opts:{status?:string;version?:string;race?:boolean;foreign?:boolean}={}){
 const filters:unknown[]=[];const writes:Record<string,unknown>[]=[];
 const q:Record<string,unknown>={update:(p:Record<string,unknown>)=>{writes.push(p);return q;},select:()=>q,maybeSingle:async()=>({data:opts.race?null:{updated_at:'new-version'},error:null})};
 for(const method of ['eq','is','in'])q[method]=(...args:unknown[])=>{filters.push([method,...args]);return q;};
 vi.mocked(apiCtx).mockResolvedValue({userId:'owner',db:{from:()=>q},admin:{}} as never);
 vi.mocked(loadState).mockResolvedValue({P:{},today:"2026-10-25",profile:{preferences:{}},master:{id:"cv",content:DEMO_MASTER},apps:opts.foreign?{}:{[id]:{status:opts.status||'ready',updated_at:opts.version||'v1',pack:{prepared_for:{job_id:id,source_cv_id:'cv'},skills_order:[],summary:'Tailored',top_bullets:[],cover_letter:'Original'}}}} as never);
 vi.mocked(loadJob).mockResolvedValue({id,title:'Accountant'} as never);
 return {filters,writes};
}
beforeEach(()=>vi.clearAllMocks());
it('requires sign-in and refuses a missing or foreign application',async()=>{
 fixture({foreign:true});expect((await POST(request({document:'cover',baseUpdatedAt:'v1',text:'Edited'}),params)).status).toBe(404);
 vi.mocked(apiCtx).mockResolvedValue(null);expect((await POST(request({}),params)).status).toBe(401);
});
it('saves owner-scoped cover edits with a sending guard and version comparison',async()=>{
 const x=fixture();const r=await POST(request({document:'cover',baseUpdatedAt:'v1',text:'Edited letter'}),params);
 expect(r.status).toBe(200);expect(x.writes[0]).toMatchObject({pack:{cover_letter:'Edited letter',summary:'Tailored'}});
 expect(x.filters).toEqual(expect.arrayContaining([['eq','user_id','owner'],['eq','job_id',id],['eq','updated_at','v1'],['is','sending_at',null]]));
});
it.each([{status:'applied'},{version:'v2'},{race:true}])('rejects sent, stale or concurrently sending document writes: %s',async opts=>{
 const x=fixture(opts);const r=await POST(request({document:'cover',baseUpdatedAt:'v1',text:'Edited'}),params);expect(r.status).toBe(409);
 if(!opts.race)expect(x.writes).toHaveLength(0);
});
it('stores a full CV override inside the application rather than changing the master',async()=>{
 const x=fixture();const cv=manualDraft(DEMO_MASTER,[]);cv.summary='Application-only summary';
 const r=await POST(request({document:'cv',baseUpdatedAt:'v1',cv}),params);expect(r.status).toBe(200);
 expect(x.writes[0]).toMatchObject({pack:{edited_cv:{summary:cv.summary},summary:cv.summary,cover_letter:'Original'}});
});

it("bounds document reads before parsing oversized content",async()=>{
 fixture();const r=await POST(new Request("https://jobpao.app/api/applications/"+id+"/documents",{method:"POST",body:"x".repeat(200001)}),params);
 expect(r.status).toBe(413);expect(loadState).not.toHaveBeenCalled();
});
