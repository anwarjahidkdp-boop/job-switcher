import 'server-only';
import { createHash } from 'node:crypto';
import { GuidedSetupSchema, setupPayload } from '../guided-setup';
import { loadProfile } from './state';
import { setCountry, type Ctx } from './onboarding';
/** Import only into a new setup. Never apply an anonymous draft to a returning user's profile. */
export async function importGuidedSetup(ctx:Ctx,raw:unknown){
 const d=GuidedSetupSchema.parse(raw),before=await loadProfile(ctx.db,ctx.userId);
 const draftId=createHash('sha256').update(JSON.stringify(d)).digest('hex');
 if(!before)throw new Error('Profile missing. Please sign in again.');
 if(before.career_meta?.guided_setup===true)return {imported:true};
 const resuming=before.onboarding_step==='upload' && before.career_meta?.guided_setup_pending===draftId;
 if(before.onboarding_step!=='country'&&!resuming)return {imported:false,existing:true};
 if(before.billing_country_locked&&d.home!==before.home_country)throw new Error('Your subscription country is already fixed. Review your profile instead.');
 if(!resuming){
  const cv=await ctx.db.from('cv_documents').select('id').eq('user_id',ctx.userId).eq('is_current',true).maybeSingle();
  if(cv.error)throw cv.error;
  if(cv.data||before.preferences)return {imported:false,existing:true};
  const pending=await ctx.db.from('profiles').update({career_meta:{...before.career_meta,guided_setup_pending:draftId}}).eq('id',ctx.userId).eq('onboarding_step','country').eq('search_country_version',before.search_country_version).select('id').maybeSingle();
  if(pending.error)throw pending.error;if(!pending.data)throw new Error('Setup changed. Reload before continuing.');
  await setCountry(ctx,d.country,d.sponsorshipRequired,d.home);
 }
 const current=await loadProfile(ctx.db,ctx.userId);
 if(!current||current.target_country!==d.country||current.onboarding_step!=='upload'||current.career_meta?.guided_setup_pending!==draftId)throw new Error('Setup changed. Reload before importing your answers.');
 const p=setupPayload(d);
 const {data,error}=await ctx.db.from('profiles').update({preferences:p.prefs,answer_library:{...current.answer_library,...p.readiness,expectedSalary:d.salaryMin,salaryCountry:d.country,noticeDays:d.notice,...(d.country==='BD'?{birthDate:d.birthDate}:{})},personal:{...current.personal,...p.personal},deal_breakers:{...current.deal_breakers,excludedCompanies:p.excludedCompanies,excludedCompaniesSet:true},career_meta:{...current.career_meta,guided_setup:true,guided_setup_pending:undefined},needs_visa:d.sponsorshipRequired}).eq('id',ctx.userId).eq('target_country',d.country).eq('search_country_version',current.search_country_version).eq('onboarding_step','upload').eq('career_meta->>guided_setup_pending',draftId).select('id').maybeSingle();
 if(error)throw error;if(!data)throw new Error('Setup changed. Reload before continuing.');return {imported:true};
}
