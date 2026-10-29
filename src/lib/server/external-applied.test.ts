import {expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
vi.mock('server-only',()=>({}));
import {confirmExternalApplied,confirmApplied} from './applications';
const preparedDb=(rpc:ReturnType<typeof vi.fn>)=>({rpc,from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{pack:{cover_letter:'Saved cover'},applied_at:null},error:null})})}) as unknown as SupabaseClient;
it('uses the atomic owner-scoped confirmation without a quota or sending call',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:'app',error:null});
 const ctx={db:preparedDb(rpc),admin:{} as SupabaseClient,userId:'owner'};
 await confirmExternalApplied(ctx,'job');await confirmApplied(ctx,'job');
 expect(rpc.mock.calls).toEqual([['confirm_external_application',{p_job:'job'}],['confirm_external_application',{p_job:'job'}]]);
});
it('propagates a concurrent-send rejection',async()=>{
 const rpc=vi.fn().mockResolvedValue({error:new Error('A send is still in progress')});
 await expect(confirmExternalApplied({db:{rpc} as unknown as SupabaseClient,admin:{} as SupabaseClient,userId:'owner'},'job')).rejects.toThrow('still in progress');
});
