'use client';
import { GuidedSetup } from '@/components/GuidedSetup';
import { emptySetup, setupPayload, type SetupDraft } from '@/lib/guided-setup';
import type { Preferences, PersonalDetails } from '@/lib/types';
import type { AnswerLibrary, DealBreakers } from '@/lib/career-safety';
import { patientPost } from '@/lib/patient-post';
export function GuidedPreferences({country,home,revision,preferences,personal,answers,breakers,billingLocked}:{country:string;home:string;revision:number;preferences:Preferences;personal:PersonalDetails;answers:AnswerLibrary;breakers:DealBreakers;billingLocked:boolean}){
 const initial:SetupDraft={...emptySetup(home),country,roles:preferences.roles,locations:preferences.locations,mode:preferences.mode,salaryMin:preferences.salaryMin,salaryMax:preferences.salaryMax,notice:preferences.notice,workAuthorization:answers.workAuthorizationSource==='home_country_default'?'unknown':answers.workAuthorization||'unknown',sponsorshipRequired:answers.sponsorshipSource==='home_country_default'?null:answers.sponsorshipRequired??null,willingToRelocate:answers.willingToRelocate??null,birthDate:answers.birthDate||personal.dob||'',excludedCompanies:(breakers.excludedCompanies||[]).join(', ')};
 return <GuidedSetup initial={initial} authenticated billingLocked={billingLocked} onComplete={async d=>{const p=setupPayload(d);await patientPost('/api/onboarding/prefs',{...p,country,revision,personal:{...personal,...p.personal}});await patientPost('/api/cv/build',{});window.location.replace('/onboarding');}}/>;
}
