import { z } from 'zod';
import { ALL_COUNTRIES } from './countries';
import { validBirthDate } from './eligibility';
export const SETUP_DRAFT_KEY = 'jp_guided_setup_v1';
export const SETUP_DRAFT_TTL = 7 * 86400000;
const country = z.string().refine(v => ALL_COUNTRIES.some(c => c.code === v), 'Choose a country.');
export const GuidedSetupSchema = z.object({
  home: country, country,
  roles: z.string().trim().min(2, 'Add at least one specific job title.').max(500),
  locations: z.string().trim().max(300), mode: z.enum(['On-site', 'Hybrid', 'Remote', 'Any']),
  salaryMin: z.number().finite().positive('Enter your expected salary.').max(1e9),
  salaryMax: z.number().finite().positive().max(1e9).nullable(),
  notice: z.number().int().min(0).max(730).nullable(),
  workAuthorization: z.enum(['yes', 'no']), sponsorshipRequired: z.boolean(),
  willingToRelocate: z.boolean(), birthDate: z.string().max(10),
  excludedCompanies: z.string().trim().max(1000),
}).superRefine((v, ctx) => {
  if (v.country === 'BD' && !validBirthDate(v.birthDate)) ctx.addIssue({code:'custom',path:['birthDate'],message:'Enter a valid date of birth for posted Bangladesh age limits.'});
  if (v.salaryMax !== null && v.salaryMax < v.salaryMin) ctx.addIssue({code:'custom',path:['salaryMax'],message:'The upper salary must be at least your minimum.'});
});
export type GuidedSetup = z.infer<typeof GuidedSetupSchema>;
export type SetupDraft = Omit<GuidedSetup, 'salaryMin'|'workAuthorization'|'sponsorshipRequired'|'willingToRelocate'> & {salaryMin:number|null;workAuthorization:'yes'|'no'|'unknown';sponsorshipRequired:boolean|null;willingToRelocate:boolean|null};
export const emptySetup = (home='BD'):SetupDraft => ({home,country:home,roles:'',locations:'',mode:'Any',salaryMin:null,salaryMax:null,notice:null,workAuthorization:'unknown',sponsorshipRequired:null,willingToRelocate:null,birthDate:'',excludedCompanies:''});
export const guidedSteps = (d:SetupDraft) => ['country','roles','location','salary','permission',...(d.country==='BD'?['age']:[]),'companies','notice','review'];
export function stepError(step:string,d:SetupDraft):string|null {
  const parsed=GuidedSetupSchema.safeParse(d);
  if(parsed.success)return null;
  const fields:Record<string,string[]>={country:['country','home'],roles:['roles'],location:['locations','mode','willingToRelocate'],salary:['salaryMin','salaryMax'],permission:['workAuthorization','sponsorshipRequired'],age:['birthDate'],companies:['excludedCompanies'],notice:['notice']};
  const issue=parsed.error.issues.find(i=>step==='review'||fields[step]?.includes(String(i.path[0])));
  return issue ? ({salaryMin:'Enter a positive expected salary.',workAuthorization:'Choose your work authorization answer.',sponsorshipRequired:'Choose whether you need sponsorship.',willingToRelocate:'Choose whether you would relocate.'}[String(issue.path[0])]||issue.message) : null;
}
export function readSetupDraft(raw:string|null,now=Date.now()):SetupDraft|null {
  try { const x=JSON.parse(raw||'null'); if(x?.version!==1||!Number.isFinite(x.savedAt)||now-x.savedAt>SETUP_DRAFT_TTL||x.savedAt>now+60000)return null;
    const base=z.object({home:country,country}).safeParse(x.value);if(!base.success)return null;
    // Persist only known keys; incomplete drafts are allowed, arbitrary object keys are not.
    const candidate={...emptySetup(base.data.home),...x.value};
    const valid=z.object({home:country,country,roles:z.string().max(500),locations:z.string().max(300),mode:z.enum(['On-site','Hybrid','Remote','Any']),salaryMin:z.number().finite().min(0).nullable(),salaryMax:z.number().finite().min(0).nullable(),notice:z.number().finite().min(0).nullable(),workAuthorization:z.enum(['yes','no','unknown']),sponsorshipRequired:z.boolean().nullable(),willingToRelocate:z.boolean().nullable(),birthDate:z.string().max(10),excludedCompanies:z.string().max(1000)}).safeParse(candidate);
    return valid.success?valid.data:null;
  } catch{return null;}
}
export const draftEnvelope=(value:SetupDraft,step?:string)=>JSON.stringify({version:1,savedAt:Date.now(),value,step});
export function setupPayload(d:GuidedSetup) {
 return {prefs:{roles:d.roles,locations:d.locations,mode:d.mode,salaryMin:d.salaryMin,salaryMax:d.salaryMax,notice:d.notice},readiness:{workAuthorization:d.workAuthorization,workAuthorizationSource:'user' as const,sponsorshipRequired:d.sponsorshipRequired,sponsorshipSource:'user' as const,willingToRelocate:d.willingToRelocate},personal:d.country==='BD'?{dob:d.birthDate}:{},excludedCompanies:d.excludedCompanies.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).slice(0,50)};
}
