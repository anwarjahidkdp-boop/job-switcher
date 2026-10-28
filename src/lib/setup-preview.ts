import { eligibilityCheck } from './eligibility';
import { titleTokens } from './taxonomy';
import type { GuidedSetup } from './guided-setup';
import type { Job } from './types';
/** A transparent first look, not a verified fit score. Never invent experience from desired titles. */
export function previewMatches(jobs:Job[],text:string,d:GuidedSetup){
 const normalize=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}+#.]+/gu,' ').replace(/\.(?=\s|$)/g,' ').replace(/\s+/g,' ').trim();
 const roleText=(s:string)=>normalize(s).replace(/\bfinancial\b/g,'finance');
 const wanted=d.roles.split(',').map(roleText).filter(Boolean);
 const cv=' '+normalize(text)+' ';const contains=(s:string)=>cv.includes(' '+normalize(s)+' ');
 return jobs.filter(j=>!j.isSample&&!j.ownerId&&j.country===d.country&&(!j.deadline||j.deadline>=new Date().toISOString().slice(0,10))).flatMap(j=>{
  // A shared modifier such as management must not turn an unrelated trainee role into a match.
  const title=' '+roleText(j.title)+' ';
  if(!wanted.some(role=>title.includes(' '+role+' ')))return [];
  const skills=[...new Set([...j.required,...j.preferred])].filter(s=>s.length>1&&contains(s));
  // A title preference alone is not a CV match: require evidence of a title term or a listed skill.
  const titleEvidence=titleTokens(j.title).filter(t=>t.length>3&&contains(t));
  if(!skills.length&&!titleEvidence.length)return [];
  const eligible=eligibilityCheck(j,{salaryMin:d.salaryMin,birthDate:d.birthDate,workAuthorization:d.workAuthorization,sponsorshipRequired:d.sponsorshipRequired,willingToRelocate:d.willingToRelocate,locations:d.locations.split(',').map(s=>s.trim()).filter(Boolean),workMode:d.mode,dealBreakers:{excludedCompanies:d.excludedCompanies.split(',').map(s=>s.trim()).filter(Boolean)}},new Date().toISOString().slice(0,10));
  if(eligible.issues.some(i=>i.blocking))return [];
  return [{title:j.title,company:j.company,location:j.location,evidence:skills.length?skills.slice(0,4):titleEvidence.slice(0,4)}];
 });
}
