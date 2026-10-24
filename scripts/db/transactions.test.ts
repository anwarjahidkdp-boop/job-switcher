import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const U = "11111111-1111-4111-8111-111111111111", V = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
async function role(name: string, uid = "") {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','${name}',false); set role ${name}`);
}
async function scalar<T>(sql: string, params: unknown[] = []): Promise<T> { return Object.values((await db.query<Record<string,T>>(sql,params)).rows[0])[0]; }

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant execute on all functions in schema auth,storage to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to authenticated,service_role;
    alter default privileges in schema public grant usage,select on sequences to authenticated,service_role;
  `);
  for (const f of readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort()) {
    // PGlite has built-in gen_random_uuid; pgcrypto random-byte aliases are not exercised here.
    const sql = readFileSync(`supabase/migrations/${f}`,"utf8").replace(/create extension if not exists pgcrypto;/gi,"");
    try { await db.exec(sql); } catch(e) { throw new Error(`Migration ${f}: ${String(e)}`); }
  }
  await db.exec(`insert into auth.users values('${U}','one@example.invalid'),('${V}','two@example.invalid')`);
}, 30000);
afterAll(async()=>{await db?.close();});

describe("database transactions and RLS on a disposable PostgreSQL engine",()=>{
  it("replays the full migration chain with a five-day new-user trial",async()=>{
    expect(await scalar<number>("select trial_days from plans where code='trial'")).toBe(5);
    expect(await scalar<number>("select price_minor from plans where code='pro'")).toBe(65000);
    expect(await scalar<number>("select extract(epoch from trial_ends_at-trial_started_at)::int/86400 from subscriptions where user_id=$1",[U])).toBe(5);
  });
  it("lets the owner save Career Safety but blocks another profile and email mutation",async()=>{
    await role("authenticated",U);
    expect(await scalar<number>(`with a as (update profiles set deal_breakers='{"remoteOnly":true}',answer_library='{"workAuthorization":"yes"}' where id=$1 returning id) select count(*)::int from a`,[U])).toBe(1);
    expect(await scalar<number>(`with a as (update profiles set full_name='attack' where id=$1 returning id) select count(*)::int from a`,[V])).toBe(0);
    await expect(db.query("update profiles set email='attack@example.invalid' where id=$1",[U])).rejects.toThrow();
    await role("postgres");
  });
  it("replaces a CV atomically and rolls back its retired CV and facts on failure",async()=>{
    await role("authenticated",U);
    const doc={text_content:"Synthetic CV",text_source:"paste",extraction:{},questions:[],answers:{},is_demo:false};
    const fact={kind:"skill",data:{name:"sql"},provenance:"cv",verified:true,evidence:"SQL"};
    const id=await scalar<string>("select replace_cv($1,$2,$3)",[doc,[fact],{full_name:"Synthetic User",career_meta:{}}]);
    await expect(db.query("select replace_cv($1,$2,$3)",[{...doc,text_content:"Invalid replacement"},[{...fact,kind:"not_a_kind"}],{}])).rejects.toThrow();
    expect(await scalar<string>("select id from cv_documents where is_current")).toBe(id);
    expect(await scalar<number>("select count(*)::int from career_facts")).toBe(1);
    await role("authenticated",V);
    expect(await scalar<number>("select count(*)::int from cv_documents")).toBe(0);
    await role("postgres");
  });
  it("denies clients access to service-only payment settlement and Gmail tokens",async()=>{
    await role("authenticated",U);
    await expect(db.query("select settle_payment(gen_random_uuid(),'lemonsqueezy',array['initiated'],'{}')")).rejects.toThrow();
    expect(await scalar<number>("select count(*)::int from gmail_connections")).toBe(0);
    expect(await scalar<number>("select count(*)::int from ingestion_sources")).toBe(0);
    expect((await db.query("select * from ai_budget($1)",[V])).rows).toHaveLength(0);
    await role("postgres");
  });
  it("atomically activates and dedupes a payment even when a client retries after losing the response",async()=>{
    const pid=await scalar<string>(`insert into payments(user_id,plan_code,method,amount_minor,currency,invoice,status,period_days) values($1,'pro','lemonsqueezy',2500,'USD','TEST-ONE','initiated',30) returning id`,[U]);
    await role("service_role");
    const args=[pid,"lemonsqueezy",["initiated"],{trx_id:"LS-test-1",provider_order_id:"test-1",reviewed_by:"test"}];
    const first=await scalar<{changed:boolean;period_end:string}>("select settle_payment($1,$2,$3,$4)",args);
    const again=await scalar<{changed:boolean;period_end:string}>("select settle_payment($1,$2,$3,$4)",args);
    expect(first.changed).toBe(true);expect(again.changed).toBe(false);expect(again.period_end).toBe(first.period_end);
    expect(await scalar<string>("select status from payments where id=$1",[pid])).toBe("approved");
    await expect(db.query("select settle_payment($1,'lemonsqueezy',array['approved'],$2,true)",[pid,{provider_order_id:"wrong-order"}])).rejects.toThrow();
    const refunded=await scalar<{changed:boolean}>("select settle_payment($1,'lemonsqueezy',array['approved'],$2,true)",[pid,{provider_order_id:"test-1"}]);
    expect(refunded.changed).toBe(true);
    expect((await scalar<{changed:boolean}>("select settle_payment($1,'lemonsqueezy',array['approved'],$2,true)",[pid,{provider_order_id:"test-1"}])).changed).toBe(false);
    await role("postgres");
  });
  it("rolls back approval if entitlement cannot be granted",async()=>{
    await db.query("delete from subscriptions where user_id=$1",[V]);
    const pid=await scalar<string>(`insert into payments(user_id,plan_code,method,amount_minor,currency,invoice,status) values($1,'pro','lemonsqueezy',2500,'USD','TEST-TWO','initiated') returning id`,[V]);
    await role("service_role");
    await expect(db.query("select settle_payment($1,'lemonsqueezy',array['initiated'],'{}')",[pid])).rejects.toThrow("no subscription");
    expect(await scalar<string>("select status from payments where id=$1",[pid])).toBe("initiated");
    await role("postgres");
  });
});

 describe("atomic AI allowance and master-CV writes",()=>{
  it("reserves one call per user and refuses concurrent spend before completion",async()=>{
    await db.query("update subscriptions set current_period_end=now()+interval '30 days' where user_id=$1",[U]);
    await role("service_role");
    const id=await scalar<number>("select reserve_ai_call($1,'cv_edit','synthetic')",[U]);
    await expect(db.query("select reserve_ai_call($1,'cv_edit','synthetic')",[U])).rejects.toThrow("unresolved");
    await db.query("update ai_usage set model='synthetic',feature='cv_edit',cost_micro_usd=10,ok=true where id=$1",[id]);
    expect(await scalar<number>("select reserve_ai_call($1,'cv_edit','synthetic')",[U])).toBeGreaterThan(Number(id));
    await role("postgres");
  });
  it("refuses a request at trial expiry without extending the five-day rule",async()=>{
    await db.query("insert into subscriptions(user_id,plan_code,status,trial_ends_at) values($1,'trial','trialing',now()-interval '1 second')",[V]);
    await role("service_role");await expect(db.query("select reserve_ai_call($1,'cv_edit','synthetic')",[V])).rejects.toThrow("trial_expired");
    await role("postgres");
  });
  it("saves versioned master CVs while preserving old state on error",async()=>{
    await role("authenticated",U);
    const id=await scalar<string>("select replace_master_cv('{}','{}',false,null,null)");
    await expect(db.query("select replace_master_cv(null,'{}',false,null,null)")).rejects.toThrow();
    expect(await scalar<string>("select id from master_cvs where is_current")).toBe(id);
    await role("postgres");
  });
 });

 it("reserves the free Gmail allowance across distinct jobs without sending anything",async()=>{
  await role("postgres");
  await db.query("update subscriptions set plan_code='trial',status='trialing',trial_ends_at=now()+interval '1 day' where user_id=$1",[V]);
  const jobs=(await db.query<{id:string}>("insert into jobs(owner_id,source_kind,source_label,country,title,company,apply_method,apply_target) values($1,'paste','synthetic','BD','test one','test','email','hr@example.invalid'),($1,'paste','synthetic','BD','test two','test','email','hr@example.invalid') returning id",[V])).rows;
  const apps=(await db.query<{id:string}>("insert into applications(user_id,job_id,status) values($1,$2,'ready'),($1,$3,'ready') returning id",[V,jobs[0].id,jobs[1].id])).rows;
  await role("authenticated",V);
  await db.query("select claim_gmail_application($1)",[apps[0].id]);
  await expect(db.query("select claim_gmail_application($1)",[apps[1].id])).rejects.toThrow("unresolved");
  await db.query("update applications set sending_at=null where id=$1",[apps[0].id]);
  expect(await scalar<string>("select claim_gmail_application($1)",[apps[1].id])).toBeTruthy();
  await role("postgres");
 });

describe("persisted per-user career report evidence",()=>{
 it("counts the user's period, retains overwritten matches, freezes retries, and enforces RLS",async()=>{
  await role("postgres");
  const job=await scalar<string>("insert into jobs(source_kind,source_label,country,title,company,apply_method,apply_target) values('paste','synthetic','BD','SQL analyst','Test','portal','https://example.invalid/job') returning id");
  for(const [user,date,score] of [[U,'2026-10-20',90],[V,'2026-10-20',95]])await db.query("insert into matches(user_id,job_id,score,band,relevant,computed_at,gaps) values($1,$2,$3,'ex',true,$4,'[{\"t\":\"SQL\"}]')",[user,job,score,date]);
  await db.query("update matches set computed_at='2026-10-27',score=40 where user_id=$1 and job_id=$2",[U,job]);
  const app=await scalar<string>("insert into applications(user_id,job_id,status,created_at,applied_at,pack) values($1,$2,'ready','2026-09-01','2026-10-21','{}') returning id",[U,job]);
  await db.query("insert into application_events(application_id,user_id,event,status,created_at) values($1,$2,'status','ready','2026-09-01'),($1,$2,'status','interview','2026-10-22'),($1,$2,'status','interview','2026-10-23'),($1,$2,'status','offer','2026-10-24')",[app,U]);
  await role("service_role");
  const args=[U,'weekly','2026-10-19','2026-10-26'];
  const report=await scalar<{id:string;metrics:Record<string,unknown>}>("select to_jsonb(save_career_report($1,$2,$3,$4))",args);
  expect(report.metrics).toMatchObject({jobs_analysed:1,relevant:1,strong:1,prepared:0,applied:1,interviews:1,offers:1,top_gap:'SQL'});
  await db.query("update match_assessments set score=0 where user_id=$1",[U]);
  expect(await scalar("select to_jsonb(save_career_report($1,$2,$3,$4))",args)).toEqual(report);
  await role("authenticated",V);expect(await scalar<number>("select count(*)::int from career_reports")).toBe(0);
  await expect(db.query("select career_metrics($1,'2026-10-19','2026-10-26')",[U])).rejects.toThrow();
  await expect(db.query("delete from match_assessments")).rejects.toThrow();
  await role("authenticated",U);expect(await scalar<number>("select count(*)::int from career_reports")).toBe(1);
  await role("postgres");
 });
});

describe("fixed billing country and destination setup", () => {
  const W = "33333333-3333-4333-8333-333333333333";
  it("activates the approved 180-day pack from its immutable synthetic payment", async () => {
    await role("postgres");
    const X = "44444444-4444-4444-8444-444444444444";
    await db.query("insert into auth.users values($1,'pack@example.invalid')", [X]);
    const id = await scalar<string>("insert into payments(user_id,plan_code,method,amount_minor,currency,invoice,status,period_days,trx_id,payer_msisdn) values($1,'pro','bkash_manual',255000,'BDT','TEST-180-DAYS','pending',180,'SYNTHETIC180','01000000000') returning id", [X]);
    await role("service_role");
    const paid = await scalar<{ changed: boolean }>("select settle_payment($1,'bkash_manual',array['pending'],'{\"reviewed_by\":\"synthetic-test\"}')", [id]);
    expect(paid.changed).toBe(true);
    expect(await scalar<number>("select round(extract(epoch from current_period_end-now())/86400)::int from subscriptions where user_id=$1", [X])).toBe(180);
    expect(await scalar<number>("select amount_minor from payments where id=$1", [id])).toBe(255000);
    await role("postgres");
  });
  it("locks initial billing country permanently, including after resetting onboarding", async () => {
    await role("postgres");
    await db.query("insert into auth.users values($1,'country@example.invalid')", [W]);
    await role("authenticated", W);
    await db.query("update profiles set home_country='BD',onboarding_step='upload' where id=$1", [W]);
    expect(await scalar<boolean>("select billing_country_locked from profiles where id=$1", [W])).toBe(true);
    await db.query("update profiles set onboarding_step='country' where id=$1", [W]);
    await expect(db.query("update profiles set home_country='US' where id=$1", [W])).rejects.toThrow("fixed");
    await expect(db.query("update profiles set billing_country_locked=false where id=$1", [W])).rejects.toThrow();
    await expect(db.query("update profiles set search_country_version=0 where id=$1", [W])).rejects.toThrow();
    await role("postgres");
  });
  it("resets only destination setup even for direct REST updates, preserving CVs, safety and history", async () => {
    await role("authenticated", W);
    const doc = await scalar<string>("select replace_cv($1,'[]',$2)", [{ text_content: "Existing verified CV", text_source: "paste", extraction: {}, questions: [], answers: {}, is_demo: false }, { career_meta: {} }]);
    const master = await scalar<string>("select replace_master_cv($1,'{}',false,null,$2)", [{ name: "Synthetic", summary: "Improved CV" }, doc]);
    await db.query(`update profiles set onboarding_step='done',preferences='{"roles":"Finance","locations":"Dhaka","salaryMin":50000}', personal='{"fatherName":"Saved","visa":"Old work rights"}',cv_style='{"tpl":"modern"}',deal_breakers='{"remoteOnly":true}',answer_library='{"workAuthorization":"Ask me"}' where id=$1`, [W]);
    await db.query("update profiles set target_country='GB' where id=$1", [W]);
    const p = (await db.query<Record<string, unknown>>("select * from profiles where id=$1", [W])).rows[0];
    expect(p).toMatchObject({ home_country: "BD", target_country: "GB", billing_country_locked: true, search_country_version: 1, onboarding_step: "prefs", needs_visa: true, preferences: { roles: "", locations: "", salaryMin: null, salaryMax: null, mode: "Any", notice: null }, personal: {}, cv_style: { tpl: "classic" }, deal_breakers: { remoteOnly: true }, answer_library: { workAuthorization: "Ask me" } });
    expect(await scalar<string>("select id from cv_documents where is_current", [])).toBe(doc);
    expect(await scalar<string>("select id from master_cvs where is_current", [])).toBe(master);
    // Selecting the same country is a no-op; going back does not restore old preferences.
    await db.query("update profiles set target_country='GB',preferences='{}' where id=$1", [W]);
    expect(await scalar<number>("select search_country_version from profiles where id=$1", [W])).toBe(1);
    await db.query("update profiles set target_country='BD' where id=$1", [W]);
    expect(await scalar<number>("select search_country_version from profiles where id=$1", [W])).toBe(2);
    expect(await scalar("select cv_style from profiles where id=$1", [W])).toEqual({ tpl: "modern" });
    await role("postgres");
  });
  it("rejects delayed CV publication after a country switch and publishes the current adaptation atomically", async () => {
    await role("authenticated", W);
    await expect(db.query("select publish_country_master_cv('{}','{}',false,null,null,'GB',1,true)")).rejects.toThrow("country changed");
    // Away and back cannot accept an old response for the same country.
    await expect(db.query("select publish_country_master_cv('{}','{}',false,null,null,'BD',0,true)")).rejects.toThrow("country changed");
    const m = await scalar<string>("select publish_country_master_cv('{}','{}',false,null,null,'BD',2,true)");
    expect(await scalar<string>("select id from master_cvs where is_current")).toBe(m);
    expect(await scalar<string>("select onboarding_step from profiles where id=$1", [W])).toBe("reveal");
    await role("authenticated", V);
    await expect(db.query("select publish_country_master_cv('{}','{}',false,null,null,'BD',2,true)")).rejects.toThrow();
    await role("postgres");
  });
});

describe('public Bangladesh job identity and source evidence', () => {
  it('merges a repeated hiring round while retaining both portals and rejecting client RPC access', async () => {
    await role('postgres');
    const s1 = await scalar<string>("insert into ingestion_sources(kind,name,country,active,source_type,url,board_token) values('bdweb','Synthetic Portal One','BD',true,'portal','https://one.invalid','synthetic-one') returning id");
    const s2 = await scalar<string>("insert into ingestion_sources(kind,name,country,active,source_type,url,board_token) values('bdweb','Synthetic Portal Two','BD',true,'portal','https://two.invalid','synthetic-two') returning id");
    const job = { owner_id: null, is_sample: false, country: 'BD', title: 'Synthetic Accountant', company: 'Synthetic Employer', deadline: '2099-11-01', external_id: 'one', url: 'https://one.invalid/job', description: 'Verified synthetic description' };
    const row = { canonical_key: 'a'.repeat(64), discovered_url: job.url, original_url: 'https://employer.invalid/careers', data: job };
    await role('authenticated', U);
    await expect(db.query('select ingest_public_jobs($1,$2)', [s1, [row]])).rejects.toThrow();
    await role('service_role');
    expect(await scalar('select ingest_public_jobs($1,$2)', [s1, [row]])).toMatchObject({ inserted: 1, occurrences: 1 });
    expect(await scalar('select ingest_public_jobs($1,$2)', [s2, [{ ...row, discovered_url: 'https://two.invalid/job', data: { ...job, external_id: 'two' } }]])).toMatchObject({ inserted: 0, occurrences: 1 });
    expect(await scalar<number>("select count(*)::int from jobs where company='Synthetic Employer'")).toBe(1);
    expect(await scalar<number>("select count(*)::int from job_source_occurrences where source_id in ($1,$2)", [s1,s2])).toBe(2);
    expect(await scalar('select ingest_public_jobs($1,$2)', [s1, [{ ...row, canonical_key: 'b'.repeat(64), data: { ...job, external_id: 'expired', deadline: '2000-01-01' } }]])).toMatchObject({ inserted: 0, occurrences: 0 });
    await role('authenticated', U);
    expect(await scalar<number>("select count(*)::int from job_source_occurrences where source_id in ($1,$2)", [s1,s2])).toBe(2);
    await expect(db.query('select * from job_canonical_keys')).rejects.toThrow('permission denied');
    await expect(db.query("insert into source_documents(source_id,url,title,kind,state) values($1,'https://one.invalid/scan','Scan','image','needs_review')", [s1])).rejects.toThrow();
    await role('postgres');
  });
});

 describe("manual CV saves with no AI allowance", () => {
  it("atomically versions the CV and matching facts, preserves answers, blocks stale and cross-user saves", async () => {
    const owner = "88888888-8888-4888-8888-888888888888";
    await role("postgres");
    await db.query("insert into auth.users values($1,'manual@example.invalid')", [owner]);
    await role("authenticated", owner);
    const base = await scalar<string>("select replace_master_cv($1,'{}',false,null,null)", [{ name: "Manual User", experience: [] }]);
    await db.query("insert into career_facts(user_id,kind,data,provenance,verified) values($1,'answer','{\"answer\":\"kept\"}','answer',true),($1,'skill','{\"name\":\"old skill\"}','cv',true)", [owner]);
    const usageBefore = await scalar<number>("select count(*)::int from ai_usage where user_id=$1", [owner]);
    const profile = (await db.query<{target_country:string;search_country_version:number}>("select target_country,search_country_version from profiles where id=$1", [owner])).rows[0];
    const content = { name: "Updated User", summary: "Updated myself", experience: [{ title: "Manager", company: "Gentle Park", start: "2021-11", end: null, bullets: ["Monitored team activities."] }] };
    const facts = [{ kind: "experience", data: { title: "Manager", company: "Gentle Park", start: "2021-11", end: null } }];
    const args = [base, profile.target_country, profile.search_country_version, content, facts];
    await role("authenticated", V);
    await expect(db.query("select save_manual_cv($1,$2,$3,$4,$5)", args)).rejects.toThrow();
    await role("authenticated", owner);
    await expect(db.query("select save_manual_cv($1,$2,$3,$4,$5)", [base, profile.target_country, profile.search_country_version + 1, content, facts])).rejects.toThrow("country changed");
    await expect(db.query("select save_manual_cv($1,$2,$3,$4,$5)", [base, profile.target_country, profile.search_country_version, content, [{ kind: "bogus", data: {} }]])).rejects.toThrow();
    expect(await scalar<string>("select id from master_cvs where is_current")).toBe(base);
    expect(await scalar<number>("select count(*)::int from career_facts where kind='skill'")).toBe(1);
    const id = await scalar<string>("select save_manual_cv($1,$2,$3,$4,$5)", args);
    expect(id).not.toBe(base);
    expect(await scalar<string>("select full_name from profiles where id=$1", [owner])).toBe("Updated User");
    expect(await scalar<number>("select count(*)::int from career_facts where kind='answer'")).toBe(1);
    expect(await scalar<number>("select count(*)::int from career_facts where kind='skill'")).toBe(0);
    expect(await scalar<boolean>("select bool_and(verified and provenance='user') from career_facts where kind='experience'")).toBe(true);
    expect(await scalar<number>("select count(*)::int from ai_usage where user_id=$1", [owner])).toBe(usageBefore);
    await expect(db.query("select save_manual_cv($1,$2,$3,$4,$5)", args)).rejects.toThrow("another tab");
    expect(await scalar<string>("select id from master_cvs where is_current")).toBe(id);
    await role("anon");
    await expect(db.query("select save_manual_cv($1,$2,$3,$4,$5)", args)).rejects.toThrow("permission denied");
    await role("postgres");
  });
 });

describe('application allowance cannot be reset through direct owner REST writes',()=>{
 const Q='77777777-7777-4777-8777-777777777777';let first:string,second:string;
 it('normalizes forged dates and rejects a second same-day confirmation',async()=>{
  await role('postgres');await db.query("insert into auth.users values($1,'quota-integrity@example.invalid')",[Q]);
  const jobs=(await db.query<{id:string}>("insert into jobs(owner_id,source_kind,source_label,country,title,company,apply_method) values($1,'paste','synthetic','BD','one','test','portal'),($1,'paste','synthetic','BD','two','test','portal') returning id",[Q])).rows;
  await role('authenticated',Q);
  first=await scalar<string>("insert into applications(user_id,job_id,status,applied_at) values($1,$2,'applied',now()-interval '10 days') returning id",[Q,jobs[0].id]);
  expect(await scalar<boolean>("select applied_at>now()-interval '1 minute' from applications where id=$1",[first])).toBe(true);
  second=await scalar<string>("insert into applications(user_id,job_id,status) values($1,$2,'ready') returning id",[Q,jobs[1].id]);
  await expect(db.query("update applications set status='applied' where id=$1",[second])).rejects.toThrow('one application a day');
  await expect(db.query("update applications set status='interview' where id=$1",[second])).rejects.toThrow('one application a day');
  await expect(db.query("update applications set applied_at=now()-interval '10 days' where id=$1",[second])).rejects.toThrow('one application a day');
  await role('postgres');
 });
 it('preserves submitted usage on delete/status/date changes but permits deleting an unsent choice',async()=>{
  await role('authenticated',Q);
  await expect(db.query('delete from applications where id=$1',[first])).rejects.toThrow('cannot be deleted');
  await db.query("update applications set status='ready',applied_at=null where id=$1",[first]);
  expect(await scalar<boolean>('select applied_at is not null from applications where id=$1',[first])).toBe(true);
  await expect(db.query('delete from applications where id=$1',[first])).rejects.toThrow('cannot be deleted');
  await db.query('delete from applications where id=$1',[second]);
  await role('postgres');
  // Account deletion through the trusted Auth admin must still cascade cleanly.
  await db.query('delete from auth.users where id=$1',[Q]);
  expect(await scalar<number>('select count(*)::int from applications where user_id=$1',[Q])).toBe(0);
 });
});
