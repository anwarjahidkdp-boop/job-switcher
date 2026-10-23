import { fillPersonalFromCv } from "../../src/lib/cv/personal-read";
// Recompute existing candidates after matching rules change. No models, emails or application submission.
import { backfillEligibility } from './backfill';
import { scriptAdmin } from '../lib/admin';
import { refreshMatches } from '../../src/lib/server/matches';
async function main(){
 const db=scriptAdmin();
 console.log(`Preserved source eligibility for ${await backfillEligibility(db)} existing listings.`);
 let users=0,jobs=0,failed=0;
 for(let offset=0;;offset+=200){
  const {data,error}=await db.from('profiles').select('id,personal').eq('onboarding_step','done').order('id').range(offset,offset+199);
  if(error)throw error;
  for(const user of data||[]){
   try{
    const cv=await db.from('cv_documents').select('text_content').eq('user_id',user.id).eq('is_current',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(cv.error)throw cv.error;
    const personal=fillPersonalFromCv(user.personal,String(cv.data?.text_content||''));
    if(JSON.stringify(personal)!==JSON.stringify(user.personal||{})){const saved=await db.from('profiles').update({personal}).eq('id',user.id);if(saved.error)throw saved.error;}
    jobs+=await refreshMatches(db,String(user.id));users++;}
   catch(e){failed++;console.error('Profile match refresh failed',e instanceof Error ? e.message : String(e));}
  }
  if(!data || data.length<200)break;
 }
 console.log(`Rechecked ${jobs} existing jobs for ${users} profiles; ${failed} failed. No AI calls or messages.`);
 if(failed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
