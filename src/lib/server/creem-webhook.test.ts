import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock('server-only',()=>({}));
vi.mock('../email/send',()=>({emailProvider:()=>null,sendEmail:vi.fn()}));
import { handleCreemWebhook, reviewPayment, startCardCheckout } from './billing';
const checkout=(extra:Record<string,unknown>={},order:Record<string,unknown>={})=>JSON.stringify({id:'evt_1',eventType:'checkout.completed',object:{id:'ch_1',object:'checkout',status:'completed',mode:'prod',metadata:{payment_id:'payment'},order:{id:'ord_1',product:'prod_2DNLvuqFCOXzlFjYBFANfL',amount:2500,currency:'USD',status:'paid',...order},...extra}});
const refund=(extra:Record<string,unknown>={},tx:Record<string,unknown>={})=>JSON.stringify({id:'evt_2',eventType:'refund.created',object:{id:'ref_1',object:'refund',status:'succeeded',mode:'prod',transaction:{id:'tran_1',order:'ord_1',status:'refunded',...tx},...extra}});
const sign=(raw:string)=>createHmac('sha256','whsec').update(raw).digest('hex');
function fixture(opts:{status?:string;order?:string|null;method?:string;error?:Error}={}) {
 const payment={id:'payment',user_id:'user',method:opts.method||'creem',amount_minor:2500,currency:'USD',period_days:30,status:opts.status||'initiated',provider_order_id:opts.order===undefined?'ch_1':opts.order};
 let activated=false;
 const updates:unknown[]=[];
 const rpc=vi.fn(async()=>{if(opts.error)return {error:opts.error};const changed=!activated;activated=true;return {data:{changed,status:'approved',period_end:'2026-11-22T00:00:00Z'},error:null};});
 const from=vi.fn(()=>{const q:Record<string,unknown>={};for(const m of ['select','eq','maybeSingle'])q[m]=()=>q;q.update=(v:unknown)=>{updates.push(v);return q;};q.then=(r:(x:unknown)=>unknown)=>r({data:payment,error:null});return q;});
 return {db:{from,rpc} as unknown as SupabaseClient,from,rpc,updates};
}
beforeEach(()=>{for(const [k,v] of Object.entries({CREEM_API_KEY:'creem_live_key',CREEM_PRODUCT_ID:'prod_1',CREEM_WEBHOOK_SECRET:'whsec'}))vi.stubEnv(k,v);});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('Creem webhook (synthetic only)',()=>{
 it('refuses unsigned and tampered requests before database access',async()=>{const x=fixture(),raw=checkout();expect((await handleCreemWebhook(x.db,raw,null)).status).toBe(401);expect((await handleCreemWebhook(x.db,raw+' ',sign(raw))).status).toBe(401);expect(x.from).not.toHaveBeenCalled();});
 it('never activates test-mode events with live keys',async()=>{const x=fixture(),raw=checkout({mode:'test'});expect((await handleCreemWebhook(x.db,raw,sign(raw))).note).toBe('test mode ignored');expect(x.from).not.toHaveBeenCalled();});
 it('activates a matching paid checkout once and records the order',async()=>{const x=fixture(),raw=checkout();expect((await handleCreemWebhook(x.db,raw,sign(raw))).note).toBe('activated');expect((await handleCreemWebhook(x.db,raw,sign(raw))).note).toBe('already done');expect(x.rpc).toHaveBeenCalledWith('settle_payment',expect.objectContaining({p_method:'creem',p_from:['initiated'],p_review:expect.objectContaining({provider_order_id:'ord_1',trx_id:'ord_1'})}));});
 it('accepts tax added on top of our price',async()=>{const x=fixture(),raw=checkout({},{amount:3000});expect((await handleCreemWebhook(x.db,raw,sign(raw))).note).toBe('activated');});
 it.each([[{status:'pending'},{}],[{},{status:'pending'}],[{},{currency:'EUR'}],[{},{amount:100}],[{},{product:'prod_vP4sJzTUe3m0nJTpYou5T'}],[{},{product:'prod_unknown'}],[{id:'ch_other'},{}],[{metadata:{}},{}]])('rejects mismatched checkout %j %j',async(extra,order)=>{const x=fixture(),raw=checkout(extra,order);await handleCreemWebhook(x.db,raw,sign(raw));expect(x.rpc).not.toHaveBeenCalled();});
 it('ignores payments that are not Creem or have no recorded checkout',async()=>{for(const o of [{method:'bkash_manual'},{order:null}]){const x=fixture(o),raw=checkout();expect((await handleCreemWebhook(x.db,raw,sign(raw))).note).toBe('unknown payment');expect(x.rpc).not.toHaveBeenCalled();}});
 it('takes back the days only for a full succeeded refund',async()=>{
  const x=fixture({status:'approved',order:'ord_1'});
  for(const [e,t] of [[{status:'pending'},{}],[{},{status:'partially_refunded'}],[{},{order:undefined}]] as const){const raw=refund(e,t);await handleCreemWebhook(x.db,raw,sign(raw));}
  expect(x.rpc).not.toHaveBeenCalled();
  const raw=refund();expect((await handleCreemWebhook(x.db,raw,sign(raw))).note).toBe('refunded');
  expect(x.rpc).toHaveBeenCalledWith('settle_payment',expect.objectContaining({p_method:'creem',p_from:['approved'],p_refund:true,p_review:expect.objectContaining({provider_order_id:'ord_1'})}));
 });
 it('propagates settlement failure for provider retry without a compensating ledger write',async()=>{const x=fixture({error:new Error('database down')}),raw=checkout();await expect(handleCreemWebhook(x.db,raw,sign(raw))).rejects.toThrow('database down');expect(x.rpc).toHaveBeenCalledTimes(1);});
 it('uses the same transaction for manual bKash approvals',async()=>{const x=fixture({method:'bkash_manual',status:'pending'});await reviewPayment(x.db,{paymentId:'payment',approve:true,reviewer:'owner@example.invalid'});expect(x.rpc).toHaveBeenCalledWith('settle_payment',expect.objectContaining({p_method:'bkash_manual',p_from:['pending','rejected']}));});
 it('is closed when not configured',async()=>{vi.stubEnv('CREEM_WEBHOOK_SECRET','');const x=fixture(),raw=checkout();expect((await handleCreemWebhook(x.db,raw,sign(raw))).status).toBe(503);});
});
describe('Creem checkout',()=>{
 it('creates a one-unit USD checkout at our price for our payment and records its id',async()=>{
  const x=fixture();
  const profile={home_country:'GB',email:'u@example.invalid'};
  const insert=vi.fn(()=>({select:()=>({single:async()=>({data:{id:'payment'},error:null})})}));
  (x.from as unknown as {mockImplementation:(f:(t:string)=>unknown)=>void}).mockImplementation((t:string)=>{const q:Record<string,unknown>={};for(const m of ['select','eq','maybeSingle'])q[m]=()=>q;q.insert=insert;q.update=(v:unknown)=>{x.updates.push(v);return q;};q.then=(r:(v:unknown)=>unknown)=>r({data:t==='profiles'?profile:t==='plans'?{code:'pro',name:'JobPao Pro',price_minor:65000}:null,error:null});return q;});
  const fetchMock=vi.fn(async(...args:[string,{body:string;headers:Record<string,string>}])=>(void args,new Response(JSON.stringify({id:'ch_9',checkout_url:'https://checkout.creem.io/ch_9'}),{status:200})));
  vi.stubGlobal('fetch',fetchMock);
  await expect(startCardCheckout({admin:x.db,userId:'user'},'30d')).rejects.toThrow('Tick the box');expect(fetchMock).not.toHaveBeenCalled();
  expect(await startCardCheckout({admin:x.db,userId:'user'},'30d',true)).toEqual({url:'https://checkout.creem.io/ch_9'});
  const [url,init]=fetchMock.mock.calls[0];const body=JSON.parse(init.body);
  expect(url).toBe('https://api.creem.io/v1/checkouts');expect(init.headers['x-api-key']).toBe('creem_live_key');
  expect(body).toMatchObject({product_id:'prod_2DNLvuqFCOXzlFjYBFANfL',units:1,metadata:{payment_id:'payment',start_now_consent_at:expect.any(String)},customer:{email:'u@example.invalid'}});
  expect(body).not.toHaveProperty('custom_price');
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({method:'creem',amount_minor:2500,currency:'USD',provider_response:{start_now_consent_at:expect.any(String)}}));
  expect(x.updates).toContainEqual({provider_order_id:'ch_9'});
 });
 it('uses the test API for test keys',async()=>{const {creemConfig}=await import('../billing/creem');expect(creemConfig({CREEM_API_KEY:'creem_test_x',CREEM_PRODUCT_ID:'p',CREEM_WEBHOOK_SECRET:'s'})?.test).toBe(true);expect(creemConfig({CREEM_API_KEY:'k',CREEM_PRODUCT_ID:'p'})).toBeNull();});
});

describe('Creem fixed-price product IDs', () => {
  it('maps every international plan exactly and refuses unsupported plans', async () => {
    const { creemProductForPlan } = await import('../billing/creem');
    expect(['15d','30d','90d','365d'].map(creemProductForPlan)).toEqual([
      'prod_vP4sJzTUe3m0nJTpYou5T',
      'prod_2DNLvuqFCOXzlFjYBFANfL',
      'prod_5DHDmQ3zHhofZsoExkW96p',
      'prod_6B0p9GM4tvS2sl1CO2xZiP',
    ]);
    expect(creemProductForPlan('180d')).toBeNull();
    expect(creemProductForPlan('unknown')).toBeNull();
  });
});
