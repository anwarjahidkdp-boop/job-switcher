import { localSearchAnswers } from "./application-defaults";
import { EDU } from "./taxonomy";
import { agePolicy } from "./market-rules";
import type { Job, MatchProfile } from './types';
import { rule } from './countries';
export interface JobEligibility { minAge?:number|null; maxAge?:number|null; ageAsOf?:string|null; ageException?:boolean; requirementsUnverified?:boolean }
export interface EligibilityIssue { code:string; message:string; blocking:boolean }
const digits=(s:string)=>s.replace(/[০-৯]/g,c=>String('০১২৩৪৫৬৭৮৯'.indexOf(c)));
export function validBirthDate(value:unknown,today=new Date().toISOString().slice(0,10)):boolean {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value&&value<=today&&Number(value.slice(0,4))>=1900;
}
export function ageOn(dob:string,asOf:string):number|null {
 if(!validBirthDate(dob,asOf)||!validBirthDate(asOf,asOf))return null;
 return Number(asOf.slice(0,4))-Number(dob.slice(0,4))-(asOf.slice(5)<dob.slice(5)?1:0);
}
/** Only literal posted limits; never infer age from experience or a job title. */
export function extractEligibility(text:string):JobEligibility {
 const t=digits(text).toLowerCase();const out:JobEligibility={};
 const range=t.match(/(?:\bage(?:d| limits?| range)?\s*[:：]?|বয়স(?:সীমা)?\s*[:ঃ]?|বয়স(?:সীমা)?\s*[:ঃ]?)\s*(?:between\s+|from\s+)?(\d{1,2})\s*(?:[-–—]|to|and|থেকে|হতে)\s*(\d{1,2})/);
 if(range){out.minAge=Number(range[1]);out.maxAge=Number(range[2]);}
 const max=t.match(/(?:maximum age|age(?:d)?\s*(?:limit|not more than|at most|up to)|বয়স\s*(?:সর্বোচ্চ|অনূর্ধ্ব)|বয়স\s*(?:সর্বোচ্চ|অনূর্ধ্ব)|সর্বোচ্চ\s*বয়স|সর্বোচ্চ\s*বয়স)\s*[:ঃ]?\s*(\d{1,2})/);
 const min=t.match(/(?:minimum age|age(?:d)?\s*(?:at least|minimum))\s*:?\s*(\d{1,2})/);
 if(max)out.maxAge=Number(max[1]);if(min)out.minAge=Number(min[1]);
 const on=t.match(/(?:age[^\n]{0,60}?(?:as (?:of|on)|on)|বয়স[^\n]{0,40}?)\s*(\d{4}-\d{2}-\d{2})/);
 if(on&&validBirthDate(on[1],on[1]))out.ageAsOf=on[1];
 if(/age.{0,50}(?:relax|exempt)|বয়স.{0,50}শিথিল|বয়স.{0,50}শিথিল/.test(t))out.ageException=true;
 if(/full education, experience and other eligibility requirements are in the official circular/i.test(text))out.requirementsUnverified=true;
 for(const key of ['minAge','maxAge'] as const)if(out[key]!=null&&(out[key]!<14||out[key]!>100))delete out[key];
 return out;
}
export function normaliseEligibility(raw:unknown):JobEligibility {
 const x=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};const out:JobEligibility={};
 for(const key of ['minAge','maxAge'] as const){const n=Number(x[key]);if(x[key]!=null&&Number.isInteger(n)&&n>=14&&n<=100)out[key]=n;}
 if(typeof x.ageAsOf==='string'&&validBirthDate(x.ageAsOf,String(x.ageAsOf)))out.ageAsOf=x.ageAsOf;
 if(x.ageException===true)out.ageException=true;if(x.requirementsUnverified===true)out.requirementsUnverified=true;return out;
}
export function eligibilityCheck(job:Job,P:Pick<MatchProfile,'salaryMin'> & Partial<MatchProfile>,today:string){
 const issues:EligibilityIssue[]=[];let cap=100;let reason="";
 const add=(code:string,message:string,blocking:boolean,ceiling:number)=>{issues.push({code,message,blocking});if(ceiling<cap){cap=ceiling;reason=message;}};
 const e=job.eligibility||{};const hasAge=e.minAge!=null||e.maxAge!=null;
 if(hasAge&&agePolicy(job.country)==='posted-limit'){
  const ref=e.ageAsOf||today;const age=P.birthDate?ageOn(P.birthDate,ref):null;
  if(age==null)add('age_unknown','Add your date of birth to check the posted age limit.',true,54);
  else if(e.ageException)add('age_exception','The circular lists age exceptions. Eligibility needs verification against the original circular.',true,54);
  else if(!e.ageAsOf)add('age_cutoff_unknown','The circular’s age calculation date is not stated. Eligibility cannot be confirmed from today’s age alone.',true,54);
  else if((e.minAge!=null&&age<e.minAge)||(e.maxAge!=null&&age>e.maxAge)){
   add('age',`Posted age limit ${e.minAge??'—'}–${e.maxAge??'—'}; your age is ${age} on ${ref}.`,true,0);
  }
 }
 // Age is never a generic ranking factor. Unreviewed restrictions need legal/occupational verification.
 if(hasAge&&agePolicy(job.country)!=='posted-limit')add('age_rule_review','This post includes an unverified age restriction. Verify a lawful occupational requirement; your age does not determine your profile score.',true,79);
 if(e.requirementsUnverified)add('requirements_unverified','Full eligibility requirements have not been extracted from the official circular. This listing is not a verified recommendation.',true,54);
 if(P.workAuthorization==='no'&&P.sponsorshipRequired!==true)add('work_authorization','Your saved work authorization does not permit this job market.',true,0);
 if(P.workAuthorization==='unknown')add('work_authorization_unknown','Confirm work authorization and sponsorship needs for this country.',true,79);
 if(P.sponsorshipRequired===true&&job.visa!==true)add('sponsorship',job.visa===false?'You require sponsorship; this employer does not offer it.':'Employer sponsorship is not confirmed for this vacancy.',true,job.visa===false?0:79);
 if(P.willingToRelocate===false&&job.location&&!/remote/i.test(`${job.location} ${job.type}`)&&P.locations?.length&&!P.locations.some(city=>job.location!.toLowerCase().includes(city.toLowerCase())))add('location','The job location is outside your preferred cities and you do not want to relocate.',true,0);
 if(P.workMode==='Remote'&&!/remote/i.test(`${job.location||''} ${job.type||''}`))add('remote_unconfirmed','Remote work is required by your preferences but is not confirmed for this vacancy.',true,79);
 const excluded=P.dealBreakers;
 for(const [code,value,list] of [['company',job.company,excluded?.excludedCompanies],['industry',job.industry,excluded?.excludedIndustries],['role_type',job.type,excluded?.excludedRoleTypes]] as const){if(value&&list?.some(v=>v.trim()&&value.toLowerCase().includes(v.trim().toLowerCase())))add(code,'This vacancy conflicts with a saved exclusion.',true,0);}
 if(P.willingToRelocate===false&&!job.location&&!/remote/i.test(job.type||''))add('location_unknown','Job location is not stated; suitability for your no-relocation preference is unverified.',true,79);
 if(job.minYears!=null&&P.years!=null&&P.years<job.minYears)add('experience','The minimum experience requirement is not established by your verified profile.',true,69);
 if(job.education?.level&&P.education){const required=EDU[job.education.level];const held=Math.max(-1,...P.education.map(e=>EDU[e.level as keyof typeof EDU]??-1));if(held<required)add('education','Your verified profile does not establish the required education level.',true,54);}
 if(P.skills){const held=new Set(P.skills.map(s=>s.name));const missing=(job.required||[]).filter(s=>!held.has(s)&&!(s==='excel'&&held.has('advanced excel')));if(missing.length)add('required_skills',`Required skills not confirmed: ${missing.slice(0,5).join(', ')}. Add only skills you actually have.`,true,79);}
 if(P.certs)for(const cert of job.certs||[]){if(!cert.required)continue;const held=P.certs.some(c=>c.status==='qualified'&&cert.names.some(n=>c.name.toUpperCase().split(/[^A-Z0-9]+/).includes(n.toUpperCase())));if(!held)add('certification',`Required qualification not confirmed: ${cert.names.join(' or ')}.`,true,69);}
 if(job.minYears==null&&!job.education&&!(job.required||[]).length&&!(job.certs||[]).length&&!(job.resp||[]).length)add('requirements_unknown','This listing does not establish the role requirements. Verify the full original post before treating it as a suitable opportunity.',true,79);
 const floor=P.salaryMin;
 if(floor&&job.salaryMax!=null&&job.salaryMax<floor)add('salary',`Published salary tops out at ${job.salaryMax}; your minimum is ${floor} ${rule(job.country).sym.trim()} per ${rule(job.country).per}.`,true,0);
 else if(P.salaryConfirmed===false)add('salary_unknown','Enter your expected salary or current salary before salary suitability can be confirmed.',true,79);
 else if(floor&&job.salaryMax==null)add('salary_unpublished','Salary is not disclosed. Confirm pay before applying; salary suitability is unverified.',true,79);
 else if(floor&&job.salaryMin!=null&&job.salaryMin<floor)add('salary_range','Only the upper part of the advertised salary range meets your minimum. Confirm the actual offer; higher pay is not established.',false,79);
 return {issues,scoreCap:cap,reason,eligible:!issues.some(i=>i.blocking),blocked:cap===0};
}
export function setupRequirements(profile:{target_country:string;home_country?:string;personal?:{dob?:string}|null;preferences?:{salaryMin?:number|null}|null;answer_library?:{birthDate?:string|null;expectedSalary?:number|null;currentSalary?:number|null;salaryCountry?:string;currentSalaryCountry?:string;workAuthorization?:"yes"|"no"|"unknown";sponsorshipRequired?:boolean|null;willingToRelocate?:boolean|null}|null}){
 const a=localSearchAnswers(profile.answer_library,profile.target_country,profile.home_country);const missing:string[]=[];
 if(profile.target_country==='BD'&&!validBirthDate(a.birthDate||profile.personal?.dob))missing.push('Date of birth');
 if(!((!a.salaryCountry||a.salaryCountry===profile.target_country)&&Number(a.expectedSalary)>0||(!a.currentSalaryCountry||a.currentSalaryCountry===profile.target_country)&&Number(a.currentSalary)>0||Number(profile.preferences?.salaryMin)>0))missing.push('Expected salary');
 if(!['yes','no'].includes(a.workAuthorization||''))missing.push('Work authorization');
 if(typeof a.sponsorshipRequired!=='boolean')missing.push('Sponsorship requirement');
 return missing;
}
