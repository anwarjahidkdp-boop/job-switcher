import type {SupabaseClient} from '@supabase/supabase-js';
import {rule} from '../countries';
import {addDaysTo,todayStr} from '../dates';
import {deadlineItems,deadlineSummary} from '../deadlines';
import {loadState} from './state';
import {notify} from './notify';
import {deliverEmail} from './email-outbox';
import {emailProvider} from '../email/send';
import {inSendWindow} from './reminders';
import {nudgeEmail} from '../email/templates';
const PAGE=1000;
export async function sendDeadlineAlerts(admin:SupabaseClient,opts:{appUrl:string;now?:Date;dryRun?:boolean;email?:boolean;userIds?:string[]}){
 const now=opts.now||new Date(),day=todayStr('UTC',now),from=addDaysTo(day,-1),to=addDaysTo(day,4),ids=new Set(opts.userIds||[]);
 if(!opts.userIds){
  const collect=async(make:(offset:number)=>PromiseLike<{data:unknown[]|null;error:unknown}>,field:string)=>{
   for(let offset=0;;offset+=PAGE){const r=await make(offset);if(r.error)throw r.error;for(const row of r.data||[]){const id=(row as Record<string,unknown>)[field];if(typeof id==='string')ids.add(id);}if((r.data||[]).length<PAGE)break;}
  };
  await Promise.all([
   collect(offset=>admin.from('matches').select('user_id,jobs!inner(deadline,active)').eq('relevant',true).eq('jobs.active',true).gte('jobs.deadline',from).lte('jobs.deadline',to).order('user_id').order('job_id').range(offset,offset+PAGE-1),'user_id'),
   collect(offset=>admin.from('applications').select('user_id,jobs!inner(deadline,active)').in('status',['ready','reminder','waiting']).eq('jobs.active',true).gte('jobs.deadline',from).lte('jobs.deadline',to).order('id').range(offset,offset+PAGE-1),'user_id'),
   collect(offset=>admin.from('jobs').select('owner_id').not('owner_id','is',null).eq('active',true).gte('deadline',from).lte('deadline',to).order('id').range(offset,offset+PAGE-1),'owner_id'),
  ]);
 }
 const result={users:0,notified:0,emailChecks:0,failed:0};
 for(const userId of ids){try{
  const st=await loadState(admin,userId);if(!st||st.profile.onboarding_step!=='done'||!inSendWindow(st.country,now))continue;
  const items=deadlineItems(st,now);if(!items.length)continue;result.users++;
  if(opts.dryRun){result.notified+=items.length;continue;}
  result.notified+=await notify(admin,userId,items.map(x=>({kind:'reminder',title:x.title,body:x.body,link:`/jobs/${x.job.id}`,key:x.key})));
  if(opts.email!==false&&emailProvider()&&st.profile.email_reminders!==false&&st.profile.email){
   const date=todayStr(rule(st.country).timeZone,now);
   const delivery=await deliverEmail(admin,userId,`deadline-digest:${st.country}:${date}`,{to:st.profile.email,...nudgeEmail({name:st.profile.full_name||'',subject:'Your selected job deadlines',body:deadlineSummary(items),button:'Review your applications',link:opts.appUrl.replace(/\/$/,'')+'/queue'}),deadlineContext:{country:st.country,date,jobIds:items.map(x=>x.job.id),appUrl:opts.appUrl}});
   result.emailChecks++;if(!['sent','canceled'].includes(delivery))result.failed++;
  }
 }catch(e){result.failed++;console.error('deadline notification failed',userId,e);}}
 return result;
}
