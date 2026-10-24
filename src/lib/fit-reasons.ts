import type {Scored} from './matching';
import {skillLabel} from './taxonomy';

function explain(x:Scored){
 const reason=x.m.reason||'',detail=x.m.reasonDetail||'';
 const gaps=x.m.allGaps||x.m.gaps||[];
 const eligibility=gaps.find(g=>g.t===reason);
 let title='Other requirements to review',description='Several requirements do not fully match your verified profile. Review the job details.',keys:string[]=[];
 if(eligibility?.k.startsWith('age')){
  title=eligibility.k==='age'?'Posted age limit does not match':'Age eligibility needs checking';keys=[eligibility.k];
  description=eligibility.k==='age_cutoff_unknown'?'The advert does not state the date used to calculate age. Eligibility is unconfirmed; this does not mean you are over the age limit.':eligibility.t;
 }else if(reason==='Seniority mismatch'){
  title='Job level differs from your career level';keys=['sen'];
  description='The advertised level differs from your established career level. A lower title needs evidence of comparable pay and responsibilities.';
 }else if(reason==='Missing skill'||reason==='Required skills not confirmed'){
  title=detail?`Skill not confirmed: ${detail}`:'Requested skills not confirmed';keys=['missing','related'];
  description='Requested skills are missing or not fully confirmed in your profile. Add them only if you have them, or develop them.';
 }else if(reason==='Education requirement'){
  title='Degree or subject needs checking';keys=['edu'];
  description='The required degree level or subject does not fully match your verified CV. Check your saved education and the advert.';
 }else if(reason==='Experience requirement'){
  title='Experience range differs';keys=['exp'];description='The job asks for a different experience range from the one shown in your CV.';
 }else if(reason==='Certification requirement'){
  title='Certification needs checking';keys=['cert'];description='The requested qualification is missing or not fully completed in your verified profile.';
 }else if(reason==='Industry mismatch'){
  title='Industry experience differs';description='Your listed industry experience differs from the industry specified by the job.';
 }else if(reason==='Location mismatch'){
  title='Location preference differs';keys=['loc'];description='The job location differs from your saved location preference.';
 }else if(reason==='Salary mismatch'){
  title='Salary does not match your preference';keys=['sal'];description='The advertised salary does not meet your saved salary preference.';
 }else if(eligibility){
  title='Eligibility needs checking';description=eligibility.t;keys=[eligibility.k];
 }else if(reason==='Visa sponsorship'){
  title='Work permission or sponsorship needs checking';keys=['visa'];description='The job does not confirm the work permission or sponsorship you need.';
 }
 const evidence=gaps.find(g=>keys.includes(g.k));
 const education=reason==='Education requirement'&&x.job.education?`The advert asks for ${x.job.education.level}${x.job.education.field?' in '+x.job.education.field:''}. Your saved education does not fully confirm this requirement.`:null;
 const specific=evidence?.t||education||(detail&&keys.includes('missing')?`${skillLabel(detail)} is not confirmed in your profile.`:description);
 return {key:reason+'|'+detail,title,description,specific};
}
/** One main explanation per unique, open, relevant job; these are counts, never lost points. */
export function fitReasonSummary(scored:Scored[]){
 const seen=new Set<string>(),groups=new Map<string,{key:string;title:string;description:string;count:number;examples:{id:string;title:string;company:string;score:number;explanation:string}[]}>();
 for(const x of scored){
  if(seen.has(x.job.id)||x.job.active===false||!x.m.relevant||x.m.expired||x.m.score>=70)continue;
  seen.add(x.job.id);const info=explain(x),group=groups.get(info.key)||{key:info.key,title:info.title,description:info.description,count:0,examples:[]};
  group.count++;
  if(group.examples.length<2)group.examples.push({id:x.job.id,title:x.job.title,company:x.job.company,score:x.m.score,explanation:info.specific});
  groups.set(info.key,group);
 }
 return {total:seen.size,groups:[...groups.values()].sort((a,b)=>b.count-a.count||a.title.localeCompare(b.title))};
}
