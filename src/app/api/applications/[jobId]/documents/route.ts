import {NextResponse} from 'next/server';
import {readLimitedText} from '@/lib/request-security';
import {apiCtx,apiError,unauthorized} from '@/lib/server/api';
import {checkPack} from "@/lib/numbers-check";
import {loadJob} from "@/lib/server/state";
import {loadState} from '@/lib/server/state';
import {hasPro} from '@/lib/server/applications';
import {trialApplyRoom,unlockedReady} from '@/lib/pack-limits';
import {ApplicationDocumentSchema,editApplicationCv,canReusePack} from '@/lib/application-documents';

export async function POST(req:Request,{params}:{params:Promise<{jobId:string}>}){
 const c=await apiCtx();if(!c)return unauthorized();
 const {jobId}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(jobId))return NextResponse.json({error:'Invalid application.'},{status:400});
 let raw:string;try{raw=await readLimitedText(req,200000);}catch{return NextResponse.json({error:'This document is too large.'},{status:413});}
 let body:unknown;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid document.'},{status:400});}
 const parsed=ApplicationDocumentSchema.safeParse(body);if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||'Check the document fields.'},{status:400});
 try{
  const st=await loadState(c.db,c.userId,undefined,{skipMatching:true});
  const app=st?.apps[jobId];
  if(!st?.master||!app?.pack)return NextResponse.json({error:'Prepare this application first.'},{status:404});
  if(!canReusePack(app.pack,jobId,st.master.id))return NextResponse.json({error:'Prepare fresh documents for this job.'},{status:409});
  if(!['ready','reminder','waiting'].includes(app.status))return NextResponse.json({error:'Sent or in-progress applications cannot be edited.'},{status:409});
  if(app.updated_at!==parsed.data.baseUpdatedAt)return NextResponse.json({error:'This application changed. Reload before editing again.'},{status:409});
  if(['ready','reminder'].includes(app.status)&&!(await hasPro(c))&&!unlockedReady(Object.values(st.apps),trialApplyRoom(Object.values(st.apps))).has(jobId))return NextResponse.json({error:'Your application allowance is used. Upgrade or return when your allowance renews.'},{status:402});
  const pack=parsed.data.document==='cv'?editApplicationCv(st.master.content,app.pack,parsed.data.cv):{...app.pack,cover_letter:parsed.data.text};
  pack.prepared_for={job_id:jobId,source_cv_id:st.master.id};
  pack.user_edited=true;
  const job=await loadJob(c.db,jobId);
  const checked=checkPack(pack,st.master.content,{job,prefs:st.profile.preferences,today:st.today});
  const saved=await c.db.from('applications').update({pack:checked.pack,pack_flags:checked.flags}).eq('user_id',c.userId).eq('job_id',jobId).eq('updated_at',parsed.data.baseUpdatedAt).is('sending_at',null).in('status',['ready','reminder','waiting']).select('updated_at').maybeSingle();
  if(saved.error)throw saved.error;
  if(!saved.data)return NextResponse.json({error:'This application changed or is being sent. Reload before editing.'},{status:409});
  return NextResponse.json({updatedAt:saved.data.updated_at,message:'Saved for this application. No AI charge.'},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return apiError(e);}
}
