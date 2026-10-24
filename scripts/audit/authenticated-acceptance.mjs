// Disposable owner QA only. Never sends mail, calls an AI model, charges money or visits employer sites.
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const origin='https://jobpao.app', expected='hplxsueitluutdbkbupi';
const config=readFileSync('wrangler.jsonc','utf8');
const url=process.env.SUPABASE_URL||config.match(/"NEXT_PUBLIC_SUPABASE_URL":\s*"([^"]+)"/)[1];
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon=config.match(/"NEXT_PUBLIC_SUPABASE_ANON_KEY":\s*"([^"]+)"/)[1];
const statePath=`${process.env.RUNNER_TEMP||'/tmp'}/jobpao-acceptance-identity.json`;
const results=[];
const report=(name,pass,detail={})=>{const row={name,pass,...detail};results.push(row);console.log(JSON.stringify(row));};
if(new URL(url).hostname!==`${expected}.supabase.co`)throw Error('Refusing an unexpected project');
const admin=key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
async function cleanup(){
 if(!admin||!existsSync(statePath))return;
 const {id,tag}=JSON.parse(readFileSync(statePath,'utf8'));
 const found=await admin.auth.admin.getUserById(id);
 if(found.error?.status===404)return;
 if(found.error||found.data.user?.user_metadata?.jobpao_acceptance!==tag)throw Error('Synthetic cleanup ownership check failed');
 const files=await admin.storage.from('cv-files').list(id,{limit:1000});
 if(files.error)throw Error('Synthetic storage cleanup listing failed');
 if(files.data?.length){const removedFiles=await admin.storage.from('cv-files').remove(files.data.map(f=>`${id}/${f.name}`));if(removedFiles.error)throw Error('Synthetic storage cleanup failed');}
 const removed=await admin.auth.admin.deleteUser(id);if(removed.error)throw Error('Synthetic cleanup failed');
 report('synthetic account cleanup',true);
}
if(process.argv.includes('--cleanup')){await cleanup();process.exit(0);}
let userId;const jar=new Map();
const user=createServerClient(url,anon,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:rows=>{for(const r of rows)jar.set(r.name,r.value);}}});
const check=(r,label)=>{if(r.error)throw Error(label);return r.data;};
async function probe(path,init={},verify=r=>r.status===200){
 const at=performance.now();
 try{
  const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(30000),...init,headers:{origin,'user-agent':'JobPao-Owner-Acceptance Android HTTP (synthetic)',...init.headers,cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}});
  for(const raw of r.headers.getSetCookie()){const [pair]=raw.split(';');const eq=pair.indexOf('=');if(eq>0)jar.set(pair.slice(0,eq),pair.slice(eq+1));}
  const text=await r.text();report(path,verify(r,text),{status:r.status,ms:Math.round(performance.now()-at)});return {r,text};
 }catch{report(path,false,{note:'Request failed or timed out; no automatic retry'});return null;}
}
const configured={backupDatabase:!!process.env.SUPABASE_DB_URL,turnstileSite:!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,gmail:!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.GMAIL_TOKEN_KEY),card:!!(process.env.LEMONSQUEEZY_API_KEY&&process.env.LEMONSQUEEZY_STORE_ID&&process.env.LEMONSQUEEZY_VARIANT_ID&&process.env.LEMONSQUEEZY_WEBHOOK_SECRET)};
console.log(JSON.stringify({configured}));
try{
 if(!admin)throw Error('Service key is unavailable: synthetic authenticated acceptance not run');
 if(process.env.JOBPAO_ACCEPTANCE_ACK!=='synthetic-only')throw Error('Synthetic QA acknowledgment missing');
 const tag=`jobpao-qa-${randomUUID()}`, email=`${tag}@example.invalid`, password=randomBytes(32).toString('base64url');
 const created=check(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{jobpao_acceptance:tag}}),'Synthetic user creation failed');
 userId=created.user.id;writeFileSync(statePath,JSON.stringify({id:userId,tag}),{mode:0o600});
 const master={name:'Synthetic Acceptance User',headline:'Cost Accountant',contact:'Synthetic QA only',summary:'Synthetic financial reporting and bank reconciliation experience.',experience:[{title:'Accounts Manager',company:'Synthetic QA Company',location:'Dhaka',start:'2015-01',end:null,bullets:['Prepare financial reports and reconcile bank accounts.']}],education:['Bachelors in accounting'],certifications:[],skills_core:['financial reporting','bank reconciliation'],skills_tools:['advanced excel'],languages:['English'],improvements:[],suggestions:[]};
 check(await admin.from('profiles').update({full_name:master.name,target_country:'BD',home_country:'BD',onboarding_step:'done',email_reminders:false,personal:{dob:'1986-01-15'},preferences:{roles:'Accounts Manager',locations:'Dhaka',salaryMin:70000,salaryMax:90000,notice:30,mode:'Any'},answer_library:{birthDate:'1986-01-15',expectedSalary:70000,salaryCountry:'BD',workAuthorization:'yes',sponsorshipRequired:false,willingToRelocate:true},career_meta:{industries:[],categories:['Finance & Accounting'],seniority:'manager',target_roles:['Accounts Manager'],location:'Dhaka'}}).eq('id',userId),'Synthetic profile setup failed');
 const facts=[{kind:'experience',data:{title:'Accounts Manager',company:'Synthetic QA Company',start:'2015-01',end:null,location:'Dhaka',industry:'services'}},{kind:'education',data:{degree:'Bachelors',field:'accounting',institution:'Synthetic QA College',year:'2010',level:'bachelors',result:null}},...['financial reporting','bank reconciliation','advanced excel'].map(name=>({kind:'skill',data:{name}}))];
 check(await admin.from('career_facts').insert(facts.map(f=>({...f,user_id:userId,verified:true,provenance:'user',evidence:'Synthetic acceptance fixture'}))),'Synthetic facts setup failed');
 const initial=check(await admin.from('master_cvs').insert({user_id:userId,content:master,ai:false,flags:[],version:1,is_current:true}).select('id').single(),'Synthetic CV setup failed');
 const profile=check(await admin.from('profiles').select('search_country_version').eq('id',userId).single(),'Synthetic profile read failed');
 check(await user.auth.signInWithPassword({email,password}),'Synthetic authentication failed');
 report('authenticated cookie session',jar.size>0);
 for(const path of ['/profile','/inbox','/queue','/applications'])await probe(path,{},r=>path==='/queue'?[200,307,308].includes(r.status):r.status===200);
 await probe('/api/onboarding/prefs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'BD',revision:profile.search_country_version,prefs:{locations:'Dhaka',salaryMin:70000,salaryMax:90000,notice:30,mode:'Any'},personal:{dob:'1986-01-15',references:[]}})});
 const cv={...master,experience:master.experience.map(e=>({...e,title:'Manager',department:'Accounts'})),summary:'Synthetic edited summary saved without AI.',education:[{degree:'Bachelors',field:'accounting',institution:'Synthetic QA College',year:'2010',level:'bachelors',result:null}],certifications:[]};
 await probe('/api/cv/manual',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({baseId:initial.id,country:'BD',revision:profile.search_country_version,cv})});
 const saved=check(await admin.from('master_cvs').select('content').eq('user_id',userId).eq('is_current',true).single(),'Saved synthetic CV read failed');
 report('manual CV persisted',saved.content.summary===cv.summary);
 report('saved headline follows edited role and department',saved.content.headline==='Manager · Accounts'&&saved.content.experience[0].department==='Accounts');
 const departmentFacts=check(await admin.from('career_facts').select('data').eq('user_id',userId).eq('kind','experience'),'Saved department read failed');
 report('department is available to matching facts',departmentFacts.some(f=>f.data.title==='Manager'&&f.data.department==='Accounts'));
 await probe('/profile',{},(r,t)=>r.status===200&&t.includes('Manager · Accounts')&&!t.includes('<p class="hl">Cost Accountant</p>'));
 for(const format of ['doc','print'])await probe(`/api/cv/download?format=${format}`,{},(r,t)=>r.status===200&&t.includes('Synthetic edited summary')&&t.includes('<p class="hl">Manager · Accounts</p>'));
 // Private, disposable job: validates the exact queue → prepare → CV/letter flow without AI.
 const reviewJob=check(await admin.from('jobs').insert({owner_id:userId,source_kind:'paste',source_label:'Synthetic acceptance only',country:'BD',title:'Accounts Manager',company:'Synthetic QA Employer',category:'Finance & Accounting',industry:'services',location:'Dhaka',seniority:'manager',employment_type:'Permanent',min_years:0,required_skills:['financial reporting'],responsibilities:['Prepare financial reports.'],salary_min:null,salary_max:null,active:true,raw:{eligibility:{}},apply_method:'unknown'}).select('id').single(),'Synthetic review job setup failed');
 await probe('/queue',{},(r,t)=>[200,307,308].includes(r.status)&&(r.headers.get('location')||t.match(/url=([^"]+)/i)?.[1]||'').includes('/jobs/'));
 await probe(`/jobs/${reviewJob.id}`,{},(r,t)=>r.status===200&&t.includes('job-review-action')&&t.includes('>Apply</button>'));
 const beforeApply=await admin.from('applications').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('job_id',reviewJob.id);
 report('reviewing the job does not prepare a pack',!beforeApply.error&&beforeApply.count===0);
 await probe(`/api/applications/${reviewJob.id}/prepare`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({standard:true})},(r,t)=>r.status===200&&JSON.parse(t).ai===false&&JSON.parse(t).flags.some(f=>f.includes('Salary not disclosed')));
 const reviewPack=check(await admin.from('applications').select('pack,pack_ai,applied_at,updated_at').eq('user_id',userId).eq('job_id',reviewJob.id).single(),'Synthetic review pack read failed');
 report('review draft contains CV, cover letter and email without submission',!!reviewPack.pack?.summary&&!!reviewPack.pack?.cover_letter&&!!reviewPack.pack?.email_body&&reviewPack.pack_ai===false&&reviewPack.applied_at===null);
 await probe(`/jobs/${reviewJob.id}?application=review&prepared=1`,{},(r,t)=>r.status===200&&t.includes('id="application"')&&t.includes('Your application pack')&&t.includes('Prepared specifically for this application')&&t.includes('Synthetic QA Employer')&&t.includes('Cover letter document actions')&&t.includes('CV document actions')&&t.includes('Check before sending:'));
 // Application edits are manual and must affect these downloads without changing the master.
 const editedLetter='Dear Hiring Manager,\n\nSynthetic edited cover letter for this application only.';
 await probe(`/api/applications/${reviewJob.id}/documents`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({document:'cover',baseUpdatedAt:reviewPack.updated_at,text:editedLetter})});
 const afterLetter=check(await admin.from('applications').select('pack,updated_at').eq('user_id',userId).eq('job_id',reviewJob.id).single(),'Edited letter read failed');
 report('manual cover letter persisted',afterLetter.pack.cover_letter===editedLetter);
 const applicationCv={...cv,summary:'Synthetic application-only CV summary.'};
 await probe(`/api/applications/${reviewJob.id}/documents`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({document:'cv',baseUpdatedAt:afterLetter.updated_at,cv:applicationCv})});
 await probe(`/api/applications/${reviewJob.id}/documents`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({document:'cover',baseUpdatedAt:reviewPack.updated_at,text:'Stale edit must fail'})},r=>r.status===409);
 const unchangedMaster=check(await admin.from('master_cvs').select('content').eq('user_id',userId).eq('is_current',true).single(),'Master CV isolation read failed');
 report('application CV edit preserves master CV',unchangedMaster.content.summary===cv.summary);
 for(const format of ['doc','print']){
  await probe(`/api/cv/download?format=${format}&jobId=${reviewJob.id}`,{},(r,t)=>r.status===200&&t.includes(applicationCv.summary));
  await probe(`/api/cv/download?document=cover&format=${format}&jobId=${reviewJob.id}`,{},(r,t)=>r.status===200&&t.includes('Synthetic edited cover letter'));
 }
 // Synthetic JPEG only; never uploads or modifies a real person's photo.
 const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDzWiiivSOA/9k=','base64');let previousPhoto;
 for(let attempt=0;attempt<2;attempt++){
  const form=new FormData();form.set('photo',new Blob([jpeg],{type:'image/jpeg'}),'synthetic.jpg');
  await probe('/api/photo',{method:'POST',body:form});
  const photoProfile=check(await admin.from('profiles').select('photo_path').eq('id',userId).single(),'Synthetic photo profile read failed');
  if(attempt===0)previousPhoto=photoProfile.photo_path;
  else report('replacement photo has a fresh private path',!!photoProfile.photo_path&&photoProfile.photo_path!==previousPhoto&&photoProfile.photo_path.startsWith(`${userId}/photo-`));
 }
 const photoFiles=await admin.storage.from('cv-files').list(userId,{limit:100});
 report('replaced photo object is removed',!photoFiles.error&&photoFiles.data.length===1);
 await probe(`/jobs/${reviewJob.id}`,{},(r,t)=>r.status===200&&t.includes('Change photo')&&t.includes('data-cv-photo-edit'));
 await probe(`/api/cv/download?format=doc&jobId=${reviewJob.id}`,{},(r,t)=>r.status===200&&t.includes('data:image/jpeg;base64,')&&!t.includes('data-cv-photo-edit'));
 // Removing one recommendation must not carry its edited documents to the next job.
 const nextJob=check(await admin.from('jobs').insert({owner_id:userId,source_kind:'paste',source_label:'Synthetic acceptance only',country:'BD',title:'Accounts Manager',company:'Synthetic Second Employer',category:'Finance & Accounting',industry:'services',location:'Dhaka',seniority:'manager',employment_type:'Permanent',min_years:0,required_skills:['financial reporting'],responsibilities:['Prepare financial reports.'],salary_min:null,salary_max:null,active:true,raw:{eligibility:{}},apply_method:'unknown'}).select('id').single(),'Second synthetic job setup failed');
 check(await admin.from('profiles').update({dismissed_job_ids:[reviewJob.id]}).eq('id',userId),'Synthetic recommendation removal failed');
 await probe('/queue',{},(r,t)=>{const target=r.headers.get('location')||t.match(/url=([^"]+)/i)?.[1]||'';return [200,307,308].includes(r.status)&&target.includes('/jobs/')&&!target.includes(reviewJob.id);});
 await probe(`/api/applications/${nextJob.id}/prepare`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({standard:true})});
 const nextPack=check(await admin.from('applications').select('pack,updated_at').eq('user_id',userId).eq('job_id',nextJob.id).single(),'Second synthetic pack read failed');
 report('next job uses its own documents, not the removed job edits',nextPack.pack.prepared_for?.job_id===nextJob.id&&nextPack.pack.cover_letter.includes('Synthetic Second Employer')&&!nextPack.pack.cover_letter.includes('Synthetic edited cover letter')&&nextPack.pack.summary===cv.summary&&!nextPack.pack.edited_cv);
 await probe(`/api/applications/${nextJob.id}/prepare`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({standard:true})});
 const samePack=check(await admin.from('applications').select('updated_at').eq('user_id',userId).eq('job_id',nextJob.id).single(),'Idempotent preparation read failed');
 report('reopening the same fresh pack does not regenerate it',samePack.updated_at===nextPack.updated_at);
 // Only this explicitly marked disposable account is used for progress/deadline QA.
 const deadlineQA=JSON.parse(execFileSync('node_modules/.bin/tsx',['--conditions=react-server','scripts/audit/deadline-acceptance.ts'],{encoding:'utf8',env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:url,QA_OWNER_ID:userId,QA_TAG:tag,QA_JOB_ID:nextJob.id}}).trim());
 report('selected deadline alerts deduplicate without email',deadlineQA.pass===true);
 await probe(`/jobs/${nextJob.id}`,{},(r,t)=>r.status===200&&t.includes('Track your application')&&t.includes('Email draft'));
 await probe(`/api/applications/${nextJob.id}/progress`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'applied',confirm:true})});
 const applied=check(await admin.from('applications').select('status,applied_at').eq('user_id',userId).eq('job_id',nextJob.id).single(),'Synthetic applied status read failed');
 report('external submission confirmation records applied',applied.status==='applied'&&!!applied.applied_at);
 await probe(`/api/applications/${nextJob.id}/progress`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'applied',confirm:true})});
 await probe(`/api/applications/${reviewJob.id}/progress`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'applied',confirm:true})},r=>r.status===402);
 const interviewDate=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 await probe(`/api/applications/${nextJob.id}/interview`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({date:interviewDate,time:'10:00',mode:'phone',tzOffsetMin:0,notes:'Synthetic interview tracking only'})});
 await probe(`/api/applications/${nextJob.id}/progress`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'offer',confirm:true})});
 const offered=check(await admin.from('applications').select('status,applied_at,interview_at').eq('user_id',userId).eq('job_id',nextJob.id).single(),'Synthetic offer read failed');
 report('offer retains interview and immutable applied timestamp',offered.status==='offer'&&!!offered.interview_at&&offered.applied_at===applied.applied_at);
 const foreign=await user.from('profiles').select('id').neq('id',userId).limit(1);report('cross-user profile access blocked',!foreign.error&&foreign.data.length===0);
 const {count,error}=await admin.from('ai_usage').select('id',{count:'exact',head:true}).eq('user_id',userId);report('acceptance used no AI calls',!error&&count===0);
 await probe('/api/account/export',{},(r,t)=>r.status===200&&JSON.parse(t).profiles?.[0]?.id===userId);
}catch(e){report('authenticated acceptance execution',false,{note:e instanceof Error?e.message:'Unexpected execution failure'});}
finally{
 try{await user.auth.signOut();await cleanup();}catch{report('synthetic account cleanup',false,{note:'Operator cleanup is required; identity retained only in private runner state'});}
 writeFileSync('authenticated-acceptance-results.json',JSON.stringify({at:new Date().toISOString(),configured,results},null,2));
}
if(results.some(r=>!r.pass))process.exitCode=1;
