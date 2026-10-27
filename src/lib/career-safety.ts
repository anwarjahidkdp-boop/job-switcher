import { eligibilityCheck } from "./eligibility";
import type { MatchProfile } from "./types";
import { salaryReach } from "./market-rules";
import type { Job, Preferences } from "./types";
export interface DealBreakers { minSalary?: number|null; minSalarySet?: boolean; excludedCompaniesSet?: boolean; excludedIndustriesSet?: boolean; excludedRoleTypesSet?: boolean; remoteOnly?: boolean; noRelocation?: boolean; noContract?: boolean; sponsorshipRequired?: boolean; workAuthorizationRequired?: boolean; excludedIndustries?: string[]; excludedCompanies?: string[]; excludedRoleTypes?: string[] }
export interface AnswerLibrary { workAuthorizationSource?:"home_country_default"|"user"; sponsorshipSource?:"home_country_default"|"user"; birthDate?:string|null; salaryCountry?:string; currentSalaryCountry?:string; expectedSalary?: number|null; salaryNegotiable?: boolean; noticeDays?: number|null; workAuthorization?: "yes"|"no"|"unknown"; sponsorshipRequired?: boolean|null; willingToRelocate?: boolean|null; currentSalary?: number|null; managementYears?: number|null; teamSize?: number|null; willingToTravel?: boolean|null }
export interface SafetyIssue { code:string; message:string; blocking:boolean }
export interface SafetyCheck { safe:boolean; issues:SafetyIssue[] }
/** Unknown advertised pay can have a review draft; it never clears sending safety. */
export function canPrepareDraft(check:SafetyCheck):boolean {
 const blocks=check.issues.filter(i=>i.blocking);
 return check.safe || (blocks.length>0 && blocks.every(i=>i.code==='salary_unpublished'));
}
const low=(v:unknown)=>String(v||"").trim().toLowerCase();
const list=(v:unknown)=>Array.isArray(v)?v.map(low).filter(Boolean):[];
const has=(hay:string|null|undefined,needles:string[])=>needles.some(n=>n&&low(hay).includes(n));
export function normaliseDealBreakers(v:unknown):DealBreakers { const x=(v&&typeof v==="object"?v:{}) as Record<string,unknown>; const n=(z:unknown)=>z==null||z===""||!Number.isFinite(Number(z))?null:Math.max(0,Number(z)); return {minSalary:n(x.minSalary),minSalarySet:x.minSalarySet===true,remoteOnly:x.remoteOnly===true,noRelocation:x.noRelocation===true,noContract:x.noContract===true,sponsorshipRequired:x.sponsorshipRequired===true,workAuthorizationRequired:x.workAuthorizationRequired===true,excludedIndustries:list(x.excludedIndustries),excludedCompanies:list(x.excludedCompanies),excludedRoleTypes:list(x.excludedRoleTypes)}}
export function applicationSafety(job:Job,prefs:Preferences|null,rawBreakers:unknown,answers:AnswerLibrary|null,needsVisa:boolean,eligibility?:{P:MatchProfile;today:string}):SafetyCheck {
 const d=normaliseDealBreakers(rawBreakers),a=answers||{},issues:SafetyIssue[]=[]; const block=(code:string,message:string)=>issues.push({code,message,blocking:true});
 const minSalary=d.minSalarySet ? d.minSalary ?? null : d.minSalary||prefs?.salaryMin||null;
 // A deal-breaker minimum the person set is strict; an expected salary leaves room to negotiate (salaryReach).
 if(minSalary&&job.salaryMax!=null&&job.salaryMax<(d.minSalarySet||d.minSalary?minSalary:salaryReach(job.country,minSalary))) block("salary",`Salary tops out below your minimum (${minSalary}).`);
 if(d.remoteOnly&&low(job.type)!=="remote"&&!low(job.location).includes("remote")) block("remote","You marked remote-only, but this job is not identified as remote.");
 if(d.noContract&&/contract|temporary|temp|freelance/.test(low(job.type))) block("contract","You excluded contract/temporary work.");
 if(has(job.company,d.excludedCompanies||[])) block("company","This company is on your excluded-company list.");
 if(has(job.industry,d.excludedIndustries||[])) block("industry","This industry is on your excluded-industry list.");
 if(has(job.type,d.excludedRoleTypes||[])) block("role_type","This employment type is excluded by your preferences.");
 const sponsor=d.sponsorshipRequired||needsVisa||a.sponsorshipRequired===true;
 if(sponsor&&job.visa===false) block("sponsorship","You need visa sponsorship, but this job says sponsorship is not available.");
 if(d.workAuthorizationRequired&&(a.workAuthorization==null||a.workAuthorization==="unknown")) block("work_authorization_unknown","Confirm your work authorization before applying.");
 if(a.workAuthorization==="no"&&!sponsor) block("work_authorization","Your saved answer says you do not currently have work authorization for this market.");
 if(d.noRelocation&&a.willingToRelocate===true) block("relocation_conflict","Your saved answers conflict: relocation is blocked but willingness to relocate is set to yes.");
 if(eligibility)issues.push(...eligibilityCheck(job,eligibility.P,eligibility.today).issues);
 return {safe:!issues.some(x=>x.blocking),issues};
}
