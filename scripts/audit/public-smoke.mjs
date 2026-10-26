// Read-only owner QA: no credentials, real accounts, mail, AI calls or payments.
import {readFileSync,writeFileSync} from 'node:fs';
const origin='https://jobpao.app';
const results=[];
async function probe(path,init={},check){
 const start=performance.now();let entry={path,method:init.method||'GET'};
 try{const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(25000),...init});const text=await r.text();entry={...entry,status:r.status,ms:Math.round(performance.now()-start),pass:check(r,text)};if(r.status>=500)entry.note='Server error; inspect Worker logs/CPU limit. No bypass or repeated load attempted.';}
 catch(e){entry={...entry,pass:false,note:e.name};}
 results.push(entry);console.log(JSON.stringify(entry));
}
const pages=['/','/login','/privacy','/terms','/refund','/install'];
for(const path of pages)await probe(path,{},(r,t)=>r.status===200&&t.length>100&&r.headers.get('x-frame-options')==='DENY'&&!!r.headers.get('content-security-policy')&&r.headers.get('x-content-type-options')==='nosniff');
for(const path of ['/inbox','/queue','/profile','/applications','/admin/payments'])await probe(path,{},r=>[302,303,307,308].includes(r.status)&&new URL(r.headers.get('location'),origin).pathname==='/login');
for(const path of ['/api/account/delete','/api/cv/manual','/api/cv/upload','/api/cv/build','/api/onboarding/prefs','/api/billing/manual','/api/applications/00000000-0000-4000-8000-000000000000/prepare','/api/applications/00000000-0000-4000-8000-000000000000/send'])await probe(path,{method:'POST',headers:{'content-type':'application/json'},body:'{}'},r=>r.status===401);
await probe('/api/inbound/email',{method:'POST',body:'{}'},r=>r.status===401);
await probe('/api/billing/paddle',{method:'POST',body:'{}'},r=>[401,503].includes(r.status));
await probe('/api/cv/edit',{method:'POST',body:'{}'},r=>r.status===410);
await probe('/api/health',{},(r,t)=>r.status===200&&JSON.parse(t).ok===true);
await probe('/manifest.webmanifest',{},(r,t)=>{const m=JSON.parse(t);return r.status===200&&m.display==='standalone'&&m.start_url&&m.icons.length>=2;});
await probe('/sw.js',{},(r,t)=>r.status===200&&t.includes('/_next/static/'));
await probe('/api/cv/manual',{method:'POST',headers:{origin:'https://hostile.example','sec-fetch-site':'cross-site','content-type':'application/json'},body:'{}'},r=>process.argv.includes('--preflight')?[401,403].includes(r.status):r.status===403);
// Public anon key is intentionally publishable; verify it cannot read private rows.
const config=readFileSync('wrangler.jsonc','utf8');const url=config.match(/"NEXT_PUBLIC_SUPABASE_URL":\s*"([^"]+)"/)[1];const key=config.match(/"NEXT_PUBLIC_SUPABASE_ANON_KEY":\s*"([^"]+)"/)[1];
for(const table of ['profiles','cv_documents','master_cvs','applications','payments','gmail_connections']){
 let pass=false,status=0;try{const r=await fetch(`${url}/rest/v1/${table}?select=*&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});status=r.status;const data=await r.json();pass=[401,403].includes(status)||(status===200&&Array.isArray(data)&&data.length===0);}catch{/* failure stays visible */}
 const entry={path:`database/anonymous/${table}`,status,pass};results.push(entry);console.log(JSON.stringify(entry));
}
writeFileSync('public-smoke-results.json',JSON.stringify({at:new Date().toISOString(),results},null,2));
if(results.some(x=>!x.pass))process.exitCode=1;
