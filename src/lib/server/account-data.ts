import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';

/** Collect before deleting: removing a page while using offset skips later private files. */
export async function removePrivateFolder(admin:SupabaseClient,bucket:string,prefix:string,depth=0):Promise<void>{
 if(depth>10)throw new Error('Storage nesting limit reached');
 const files:string[]=[],folders:string[]=[];
 for(let offset=0;;offset+=1000){
  const {data,error}=await admin.storage.from(bucket).list(prefix,{limit:1000,offset,sortBy:{column:'name',order:'asc'}});
  if(error)throw error;
  for(const f of data||[]){const path=`${prefix}/${f.name}`;(f.id?files:folders).push(path);}
  if(!data||data.length<1000)break;
 }
 for(const folder of folders)await removePrivateFolder(admin,bucket,folder,depth+1);
 for(let i=0;i<files.length;i+=100){const {error}=await admin.storage.from(bucket).remove(files.slice(i,i+100));if(error)throw error;}
}
export async function exportAccount(db:SupabaseClient,userId:string){
 const tables=['profiles','subscriptions','payments','cv_documents','career_facts','master_cvs','applications','application_events','reminders','forwarding_addresses','inbound_emails','ai_usage','matches','notifications','career_reports','match_assessments'] as const;
 const out:Record<string,unknown[]>={};
 for(const table of [...tables,'jobs'] as const){
  const col=table==='profiles'?'id':table==='jobs'?'owner_id':'user_id';const rows:unknown[]=[];
  for(let from=0;;from+=1000){let q=db.from(table).select('*').eq(col,userId);for(const key of table==='matches'?['job_id']:['id'])q=q.order(key);const {data,error}=await q.range(from,from+999);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<1000)break;}
  out[table==='jobs'?'private_jobs':table]=rows;
 }
 return out;
}
