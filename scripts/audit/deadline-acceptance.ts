// Disposable, explicitly tagged owner QA only. No AI or email delivery.
import {createClient} from '@supabase/supabase-js';
import {sendDeadlineAlerts} from '../../src/lib/server/deadlines';
import {todayStr,addDaysTo} from '../../src/lib/dates';
const {NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key,QA_OWNER_ID:id,QA_TAG:tag,QA_JOB_ID:jobId}=process.env;
if(!url||new URL(url).hostname!=='hplxsueitluutdbkbupi.supabase.co'||!key||!id||!tag||!jobId)throw Error('Synthetic QA configuration missing');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const account=await db.auth.admin.getUserById(id);
if(account.error||account.data.user?.user_metadata?.jobpao_acceptance!==tag)throw Error('Synthetic identity verification failed');
const today=todayStr('Asia/Dhaka'),now=new Date(today+'T06:00:00Z');
const job=await db.from('jobs').update({deadline:addDaysTo(today,3)}).eq('id',jobId).eq('owner_id',id).select('id').single();
if(job.error)throw Error('Synthetic deadline setup failed');
const first=await sendDeadlineAlerts(db,{appUrl:'https://jobpao.app',now,userIds:[id],email:false});
const second=await sendDeadlineAlerts(db,{appUrl:'https://jobpao.app',now,userIds:[id],email:false});
const emails=await db.from('email_deliveries').select('id',{count:'exact',head:true}).eq('user_id',id);
console.log(JSON.stringify({pass:first.notified>=1&&second.notified===0&&first.failed===0&&second.failed===0&&!emails.error&&emails.count===0}));
