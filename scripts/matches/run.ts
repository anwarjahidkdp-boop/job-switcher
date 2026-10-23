// Recompute existing candidates after matching rules change. No models, emails or application submission.
import { scriptAdmin } from '../lib/admin';
import { refreshMatches } from '../../src/lib/server/matches';
async function main(){
 const db=scriptAdmin();let users=0,jobs=0,failed=0;
 for(let offset=0;;offset+=200){
  const {data,error}=await db.from('profiles').select('id').eq('onboarding_step','done').order('id').range(offset,offset+199);
  if(error)throw error;
  for(const user of data||[]){
   try{jobs+=await refreshMatches(db,String(user.id));users++;}
   catch(e){failed++;console.error('Profile match refresh failed',e instanceof Error ? e.message : String(e));}
  }
  if(!data || data.length<200)break;
 }
 console.log(`Rechecked ${jobs} existing jobs for ${users} profiles; ${failed} failed. No AI calls or messages.`);
 if(failed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
