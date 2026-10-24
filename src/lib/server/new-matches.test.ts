import { beforeEach,it,expect,vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
const mocks=vi.hoisted(()=>({prepare:vi.fn(),load:vi.fn(),queue:vi.fn()}));
vi.mock('../ai',()=>({aiConfigured:()=>true,checkBudget:()=>{},getBudget:async()=>({})}));
vi.mock('../email/send',()=>({emailProvider:()=>false}));
vi.mock('../email/templates',()=>({newMatchesEmail:vi.fn()}));
vi.mock('./email-outbox',()=>({deliverEmail:vi.fn()}));
vi.mock('./notify',()=>({notify:vi.fn()}));
vi.mock('./state',()=>({loadState:mocks.load}));
vi.mock('../apply-queue',()=>({AUTO_QUEUE_SIZE:3,applyQueue:mocks.queue,queueSafety:(_st:unknown,job:{id:string})=>({safe:job.id!=='unpublished'})}));
vi.mock('./applications',()=>({preparePack:mocks.prepare,ApplicationSafetyError:class extends Error{}}));
import { processNewMatches } from './new-matches';
beforeEach(()=>{vi.clearAllMocks();mocks.prepare.mockResolvedValue({ai:true});mocks.load.mockResolvedValue({apps:{old:{pack:{}}}});mocks.queue.mockReturnValue([{job:{id:'best'}},{job:{id:'next'}}]);});
function db(){return {from:(table:string)=>{const result={data:table==='profiles'?{}:[],error:null};const q={select:()=>q,eq:()=>q,is:()=>q,gte:()=>q,or:()=>q,order:()=>q,limit:()=>q,maybeSingle:async()=>result,then:(resolve:(r:unknown)=>unknown)=>Promise.resolve(result).then(resolve)};return q;}} as unknown as SupabaseClient;}
it('keeps automatic discovery from preparing documents or spending AI',async()=>{
 const result=await processNewMatches(db(),['user'],{appUrl:'https://example.com'});
 expect(mocks.prepare).not.toHaveBeenCalled();expect(result.prepared).toBe(0);
});
it('respects dry-run and explicit no-prepare without spending',async()=>{
 await processNewMatches(db(),['user'],{appUrl:'https://example.com',dryRun:true});
 await processNewMatches(db(),['user'],{appUrl:'https://example.com',prepare:false});
 expect(mocks.prepare).not.toHaveBeenCalled();
});
it('does not automatically prepare a selected vacancy awaiting salary verification',async()=>{
 mocks.queue.mockReturnValue([{job:{id:'unpublished'}},{job:{id:'best'}}]);
 await processNewMatches(db(),['user'],{appUrl:'https://example.com'});
 expect(mocks.prepare).not.toHaveBeenCalled();
});

it('does not revive automatic document generation through an old prepare flag',async()=>{
 await processNewMatches(db(),['user'],{appUrl:'https://example.com',prepare:true});
 expect(mocks.prepare).not.toHaveBeenCalled();
});
