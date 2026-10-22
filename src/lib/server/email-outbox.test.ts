import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("../email/send", async (original) => ({ ...await original<typeof import("../email/send")>(), sendEmail: vi.fn() }));
import { EmailDeliveryError, sendEmail } from "../email/send";
import { deliverEmail, flushEmailOutbox } from "./email-outbox";

function fixture() {
  const rows: Record<string, unknown>[] = [];
  const state = { ackError: false, optedOut: false };
  const db = { from(table: string) {
    let patch: Record<string,unknown>|undefined, insert: Record<string,unknown>|undefined;
    const filters: ((r: Record<string,unknown>)=>boolean)[] = [];
    const q = { select:()=>q, maybeSingle:()=>q, limit:()=>q,
      upsert:(p:Record<string,unknown>)=>{insert=p;return q;}, update:(p:Record<string,unknown>)=>{patch=p;return q;},
      eq:(k:string,v:unknown)=>{filters.push(r=>r[k]===v);return q;},
      lt:(k:string,v:unknown)=>{filters.push(r=>Number(r[k])<Number(v));return q;},
      lte:(k:string,v:unknown)=>{filters.push(r=>String(r[k])<=String(v));return q;},
      then:(resolve:(r:unknown)=>unknown,reject?:(e:unknown)=>unknown)=>Promise.resolve().then(()=>{
        if(table==='profiles') return {data:{email_reminders:!state.optedOut},error:null};
        if(insert && !rows.some(r=>r.dedupe_key===insert!.dedupe_key)) rows.push({id:'id',status:'pending',attempts:0,next_attempt_at:new Date(0).toISOString(),...insert});
        const found=rows.find(r=>filters.every(f=>f(r)));
        if(patch?.status==='sent' && state.ackError) return {data:null,error:new Error('ack failed')};
        if(found && patch) Object.assign(found,patch);
        return {data:found?{...found}:null,error:null};
      }).then(resolve,reject),
    };return q;
  }} as unknown as SupabaseClient;
  return {db,rows,state};
}
const message={to:'test@example.invalid',subject:'Synthetic test',html:'test',text:'test'};
beforeEach(()=>{vi.mocked(sendEmail).mockReset();vi.mocked(sendEmail).mockResolvedValue({id:'provider-id'});});
afterEach(()=>vi.restoreAllMocks());
describe('durable email delivery',()=>{
  it('only delivers once across concurrent workers and repeated scheduling',async()=>{
    const x=fixture();await Promise.all([deliverEmail(x.db,'u','key',message),deliverEmail(x.db,'u','key',message)]);
    await deliverEmail(x.db,'u','key',message);
    expect(sendEmail).toHaveBeenCalledTimes(1);expect(x.rows).toHaveLength(1);expect(x.rows[0].status).toBe('sent');
  });
  it('keeps ambiguous network timeouts unresolved and never resends them',async()=>{
    const x=fixture();vi.mocked(sendEmail).mockRejectedValue(new Error('timeout'));
    expect(await deliverEmail(x.db,'u','key',message)).toBe('unresolved');
    expect(await deliverEmail(x.db,'u','key',message)).toBe('unresolved');expect(sendEmail).toHaveBeenCalledTimes(1);
  });
  it('retries explicit rejections only three times',async()=>{
    const x=fixture();vi.mocked(sendEmail).mockRejectedValue(new EmailDeliveryError('429 rejected',true));
    for(let i=0;i<3;i++){await deliverEmail(x.db,'u','key',message);x.rows[0].next_attempt_at=new Date(0).toISOString();}
    expect(x.rows[0].status).toBe('failed');await deliverEmail(x.db,'u','key',message);expect(sendEmail).toHaveBeenCalledTimes(3);
  });
  it('never reclaims a sending row after a failed acknowledgement',async()=>{
    const x=fixture();x.state.ackError=true;
    await expect(deliverEmail(x.db,'u','key',message)).rejects.toThrow('ack failed');
    expect(await deliverEmail(x.db,'u','key',message)).toBe('sending');expect(sendEmail).toHaveBeenCalledTimes(1);
  });
  it('honors later opt-outs before delivering pending mail',async()=>{
    const x=fixture();x.state.optedOut=true;expect(await deliverEmail(x.db,'u','key',message)).toBe('failed');expect(sendEmail).not.toHaveBeenCalled();
  });
  it('fails closed when the outbox table is unavailable',async()=>{
    const q={upsert:async()=>({error:new Error('missing table')})};
    await expect(deliverEmail({from:()=>q} as unknown as SupabaseClient,'u','k',message)).rejects.toThrow('missing table');expect(sendEmail).not.toHaveBeenCalled();
  });
  it('reports pending read failures to the scheduler',async()=>{
    const q:Record<string,unknown>={};for(const k of ['select','eq','lt','lte','limit'])q[k]=()=>q;
    q.then=(r:(x:unknown)=>unknown)=>r({error:new Error('read failed')});
    await expect(flushEmailOutbox({from:()=>q} as unknown as SupabaseClient)).rejects.toThrow('read failed');
  });
});
