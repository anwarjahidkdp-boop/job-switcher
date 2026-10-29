import {expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
vi.mock('server-only',()=>({}));
import {trialAccess,requireActiveAccess,SubscriptionRequired} from './trial-access';

function db(row:Record<string,unknown>|null):SupabaseClient{
 const q={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:row,error:null})};
 return {from:()=>q} as unknown as SupabaseClient;
}
const past=new Date(Date.now()-60000).toISOString();
const future=new Date(Date.now()+60000).toISOString();

it('locks new paid features after the five-day trial actually expires',async()=>{
 const client=db({plan_code:'trial',status:'trialing',trial_ends_at:past,current_period_end:null});
 expect(await trialAccess(client,'user')).toEqual({active:false,expired:true,pro:false});
 await expect(requireActiveAccess(client,'user')).rejects.toBeInstanceOf(SubscriptionRequired);
});
it('allows an active trial but does not treat a lapsed pro plan as paid',async()=>{
 expect((await trialAccess(db({plan_code:'trial',status:'trialing',trial_ends_at:future}),'user')).active).toBe(true);
 expect((await trialAccess(db({plan_code:'pro',status:'active',current_period_end:past}),'user')).active).toBe(false);
 expect((await trialAccess(db({plan_code:'pro',status:'active',current_period_end:future}),'user')).pro).toBe(true);
});
