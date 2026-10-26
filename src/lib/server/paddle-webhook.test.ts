import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock('server-only',()=>({}));
vi.mock('../email/send',()=>({emailProvider:()=>null,sendEmail:vi.fn()}));
import { handlePaddleWebhook, reviewPayment, startCardCheckout } from './billing';
import { verifySignature } from '../billing/paddle';
const txn=(extra:Record<string,unknown>={},price='2500',qty=1)=>JSON.stringify({event_type:'transaction.completed',data:{id:'txn_1',status:'completed',currency_code:'USD',custom_data:{payment_id:'payment'},items:[{quantity:qty,price:{unit_price:{amount:price,currency_code:'USD'}}}],...extra}});
const refund=(extra:Record<string,unknown>={})=>JSON.stringify({event_type:'adjustment.updated',data:{transaction_id:'txn_1',action:'refund',status:'approved',type:'full',...extra}});
const sign=(raw:string,ts=Math.floor(Date.now()/1000))=>`ts=${ts};h1=${createHmac('sha256','pdl_secret').update(`${ts}:${raw}`).digest('hex')}`;
function fixture(opts:{status?:string;order?:string|null;method?:string;error?:Error}={}) {
 const payment={id:'payment',user_id:'user',method:opts.method||'paddle',amount_minor:2500,currency:'USD',status:opts.status||'initiated',provider_order_id:opts.order===undefined?'txn_1':opts.order};
 let activated=false;
 const updates:unknown[]=[];
 const rpc=vi.fn(async()=>{if(opts.error)return {error:opts.error};const changed=!activated;activated=true;return {data:{changed,status:'approved',period_end:'2026-11-22T00:00:00Z'},error:null};});
 const from=vi.fn(()=>{const q:Record<string,unknown>={};for(const m of ['select','eq','maybeSingle'])q[m]=()=>q;q.update=(v:unknown)=>{updates.push(v);return q;};q.then=(r:(x:unknown)=>unknown)=>r({data:payment,error:null});return q;});
 return {db:{from,rpc} as unknown as SupabaseClient,from,rpc,updates};
}
beforeEach(()=>{for(const [k,v] of Object.entries({PADDLE_API_KEY:'pdl_test',PADDLE_PRODUCT_ID:'pro_1',PADDLE_WEBHOOK_SECRET:'pdl_secret',PADDLE_CLIENT_TOKEN:'live_token'}))vi.stubEnv(k,v);});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('Paddle signature',()=>{
 it('accepts any h1 during secret rotation and rejects stale or tampered events',()=>{
  const raw=txn(),ts=Math.floor(Date.now()/1000),h=sign(raw,ts);
  expect(verifySignature(raw,`ts=${ts};h1=${'0'.repeat(64)};${h.split(';')[1]}`,'pdl_secret')).toBe(true);
  expect(verifySignature(raw+' ',h,'pdl_secret')).toBe(false);
  expect(verifySignature(raw,sign(raw,ts-3600),'pdl_secret')).toBe(false);
  expect(verifySignature(raw,`ts=${ts}`,'pdl_secret')).toBe(false);
 });
});
describe('Paddle webhook (synthetic only)',()=>{
 it('refuses unsigned requests before database access',async()=>{const x=fixture();expect((await handlePaddleWebhook(x.db,txn(),null)).status).toBe(401);expect(x.from).not.toHaveBeenCalled();});
 it('activates a matching completed transaction once',async()=>{const x=fixture(),raw=txn();expect((await handlePaddleWebhook(x.db,raw,sign(raw))).note).toBe('activated');expect((await handlePaddleWebhook(x.db,raw,sign(raw))).note).toBe('already done');expect(x.rpc).toHaveBeenCalledWith('settle_payment',expect.objectContaining({p_method:'paddle',p_from:['initiated'],p_review:expect.objectContaining({provider_order_id:'txn_1'})}));});
 it.each([[{status:'paid'},'2500',1],[{currency_code:'EUR'},'2500',1],[{},'1',1],[{},'2500',2],[{id:'txn_other'},'2500',1]])('rejects mismatched transaction %j %s x%s',async(extra,price,qty)=>{const x=fixture(),raw=txn(extra,price,qty);await handlePaddleWebhook(x.db,raw,sign(raw));expect(x.rpc).not.toHaveBeenCalled();});
 it('ignores payments that are not Paddle or have no recorded transaction',async()=>{for(const o of [{method:'bkash_manual'},{order:null}]){const x=fixture(o),raw=txn();expect((await handlePaddleWebhook(x.db,raw,sign(raw))).note).toBe('unknown payment');expect(x.rpc).not.toHaveBeenCalled();}});
 it('takes back the days only for a full approved refund',async()=>{
  const x=fixture({status:'approved'});
  for(const e of [{status:'pending_approval'},{action:'credit'},{type:'partial'}]){const raw=refund(e);await handlePaddleWebhook(x.db,raw,sign(raw));}
  expect(x.rpc).not.toHaveBeenCalled();
  const raw=refund();expect((await handlePaddleWebhook(x.db,raw,sign(raw))).note).toBe('refunded');
  expect(x.rpc).toHaveBeenCalledWith('settle_payment',expect.objectContaining({p_method:'paddle',p_from:['approved'],p_refund:true}));
 });
 it('propagates settlement failure for provider retry without a compensating ledger write',async()=>{const x=fixture({error:new Error('database down')}),raw=txn();await expect(handlePaddleWebhook(x.db,raw,sign(raw))).rejects.toThrow('database down');expect(x.rpc).toHaveBeenCalledTimes(1);});
 it('uses the same transaction for manual bKash approvals',async()=>{const x=fixture({method:'bkash_manual',status:'pending'});await reviewPayment(x.db,{paymentId:'payment',approve:true,reviewer:'owner@example.invalid'});expect(x.rpc).toHaveBeenCalledWith('settle_payment',expect.objectContaining({p_method:'bkash_manual',p_from:['pending','rejected']}));});
 it('is closed when not configured',async()=>{vi.stubEnv('PADDLE_CLIENT_TOKEN','');const x=fixture(),raw=txn();expect((await handlePaddleWebhook(x.db,raw,sign(raw))).status).toBe(503);});
});
describe('Paddle checkout',()=>{
 it('creates a one-item USD transaction for our payment and records its id',async()=>{
  const x=fixture();
  const profile={home_country:'GB',email:'u@example.invalid'};
  const insert=vi.fn(()=>({select:()=>({single:async()=>({data:{id:'payment'},error:null})})}));
  (x.from as unknown as {mockImplementation:(f:(t:string)=>unknown)=>void}).mockImplementation((t:string)=>{const q:Record<string,unknown>={};for(const m of ['select','eq','maybeSingle'])q[m]=()=>q;q.insert=insert;q.update=(v:unknown)=>{x.updates.push(v);return q;};q.then=(r:(v:unknown)=>unknown)=>r({data:t==='profiles'?profile:t==='plans'?{code:'pro',name:'JobPao Pro',price_minor:65000}:null,error:null});return q;});
  const fetchMock=vi.fn(async(...args:[string,{body:string}])=>(void args,new Response(JSON.stringify({data:{id:'txn_9',checkout:{url:'https://jobpao.app/pay?_ptxn=txn_9'}}}),{status:201})));
  vi.stubGlobal('fetch',fetchMock);
  expect(await startCardCheckout({admin:x.db,userId:'user'},'30d')).toEqual({url:'https://jobpao.app/pay?_ptxn=txn_9'});
  const [url,init]=fetchMock.mock.calls[0];const body=JSON.parse(init.body);
  expect(url).toBe('https://api.paddle.com/transactions');
  expect(body.items).toHaveLength(1);expect(body.items[0].price.unit_price).toEqual({amount:'2500',currency_code:'USD'});expect(body.custom_data.payment_id).toBe('payment');
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({method:'paddle',amount_minor:2500,currency:'USD'}));
  expect(x.updates).toContainEqual({provider_order_id:'txn_9'});
 });
});
