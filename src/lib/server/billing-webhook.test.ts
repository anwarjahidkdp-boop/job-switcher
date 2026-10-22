import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock('server-only',()=>({}));
vi.mock('../email/send',()=>({emailProvider:()=>null,sendEmail:vi.fn()}));
import { handleLemonWebhook, reviewPayment } from './billing';
const event=(extra:Record<string,unknown>={},name='order_created')=>JSON.stringify({meta:{event_name:name,custom_data:{payment_id:'payment'}},data:{type:'orders',id:'order',attributes:{store_id:1,currency:'USD',subtotal:2500,status:'paid',test_mode:false,...extra}}});
const sign=(raw:string)=>createHmac('sha256','webhook-secret').update(raw).digest('hex');
function fixture(opts:{error?:Error;status?:string}={}) {
 const calls:unknown[]=[];
 const payment={id:'payment',user_id:'user',method:'lemonsqueezy',amount_minor:2500,status:opts.status||'initiated',trx_id:'trx'};
 let activated=false;
 const rpc=vi.fn(async(name:string,args:unknown)=>{calls.push([name,args]);if(opts.error)return {error:opts.error};const changed=!activated;activated=true;return {data:{changed,status:'approved',period_end:'2026-11-22T00:00:00Z'},error:null};});
 const from=vi.fn(()=>{const q:Record<string,unknown>={};for(const m of ['select','eq','update','maybeSingle'])q[m]=()=>q;q.then=(r:(x:unknown)=>unknown)=>r({data:payment,error:null});return q;});
 return {db:{from,rpc} as unknown as SupabaseClient,from,rpc,calls};
}
beforeEach(()=>{for(const [k,v] of Object.entries({LEMONSQUEEZY_API_KEY:'test',LEMONSQUEEZY_STORE_ID:'1',LEMONSQUEEZY_VARIANT_ID:'2',LEMONSQUEEZY_WEBHOOK_SECRET:'webhook-secret'}))vi.stubEnv(k,v);});
afterEach(()=>vi.unstubAllEnvs());
describe('payment event verification (synthetic only)',()=>{
 it('refuses unsigned and tampered requests before database access',async()=>{const x=fixture(),raw=event();expect((await handleLemonWebhook(x.db,raw,null)).status).toBe(401);expect((await handleLemonWebhook(x.db,raw+' ',sign(raw))).status).toBe(401);expect(x.from).not.toHaveBeenCalled();});
 it('never activates test-mode orders in production',async()=>{const x=fixture(),raw=event({test_mode:true});expect((await handleLemonWebhook(x.db,raw,sign(raw))).note).toBe('test mode ignored');expect(x.from).not.toHaveBeenCalled();});
 it.each([{store_id:9},{status:'pending'},{currency:'BDT'},{subtotal:1}])('rejects mismatched order %j',async extra=>{const x=fixture(),raw=event(extra);await handleLemonWebhook(x.db,raw,sign(raw));expect(x.rpc).not.toHaveBeenCalled();});
 it('passes a verified order to the atomic settlement once and safely acknowledges repeats',async()=>{const x=fixture(),raw=event();expect((await handleLemonWebhook(x.db,raw,sign(raw))).note).toBe('activated');expect((await handleLemonWebhook(x.db,raw,sign(raw))).note).toBe('already done');expect(x.rpc).toHaveBeenCalledWith('settle_payment',expect.objectContaining({p_method:'lemonsqueezy',p_from:['initiated'],p_review:expect.objectContaining({provider_order_id:'order'})}));});
 it('propagates settlement failure for provider retry without a compensating ledger write',async()=>{const x=fixture({error:new Error('database down')}),raw=event();await expect(handleLemonWebhook(x.db,raw,sign(raw))).rejects.toThrow('database down');expect(x.rpc).toHaveBeenCalledTimes(1);});
 it('uses the same transaction for manual approvals',async()=>{const x=fixture();await reviewPayment(x.db,{paymentId:'payment',approve:true,reviewer:'owner@example.invalid'});expect(x.rpc).toHaveBeenCalledWith('settle_payment',expect.objectContaining({p_method:'bkash_manual',p_from:['pending','rejected']}));});
});
