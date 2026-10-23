import type { SupabaseClient } from '@supabase/supabase-js';
import { extractEligibility,normaliseEligibility } from '../../src/lib/eligibility';
/** Persist compact constraints from existing source descriptions before recomputing matches. */
export async function backfillEligibility(db:SupabaseClient){
 let updated=0;
 for(let offset=0;;offset+=200){
  const {data,error}=await db.from('jobs').select('id,description,raw').eq('active',true).order('id').range(offset,offset+199);
  if(error)throw error;
  for(const job of data||[]){
   const raw=job.raw&&typeof job.raw==='object'&&!Array.isArray(job.raw)?job.raw as Record<string,unknown>:{};
   const eligibility={...extractEligibility(String(job.description||'')),...normaliseEligibility(raw.eligibility)};
   if(JSON.stringify(eligibility)===JSON.stringify(raw.eligibility||{}))continue;
   const {error:e}=await db.from('jobs').update({raw:{...raw,...(job.raw!=null&&Object.keys(raw).length===0?{sourcePayload:job.raw}:{}),eligibility}}).eq('id',job.id);
   if(e)throw e;updated++;
  }
  if(!data||data.length<200)break;
 }
 return updated;
}
