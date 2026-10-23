import { validBirthDate } from "./eligibility";
import type { AnswerLibrary, DealBreakers } from "./career-safety";
export const APPLICATION_FIELDS = [
  { key: "birthDate", name: "birthDate", label: "Date of birth", type: "date", hint: "Required for Bangladesh age-limited vacancies. Used privately for eligibility checks." },
  { key: "workAuthorization", name: "workAuthorization", label: "Work authorization", type: "choice", hint: "Confirm whether you have permission to work in your selected job-search country." },
  { key: "expectedSalary", name: "expectedSalary", label: "Expected salary", type: "number", hint: "Enter your expected salary in the selected country's currency and pay period." },
  { key: "noticeDays", name: "noticeDays", label: "Notice period (days)", type: "number", hint: "Enter 0 if you can start immediately." },
  { key: "sponsorshipRequired", name: "answerSponsorship", label: "Need sponsorship?", type: "choice", hint: "Choose Yes or No; an unanswered question is not treated as No." },
  { key: "willingToRelocate", name: "willingToRelocate", label: "Willing to relocate?", type: "choice", hint: "Choose Yes or No for moving to take a job." },
  { key: "managementYears", name: "managementYears", label: "People-management experience (years)", type: "number", hint: "Enter 0 if you have no people-management experience." },
  { key: "teamSize", name: "teamSize", label: "Largest team size managed", type: "number", hint: "Enter 0 if you have not managed a team." },
  { key: "willingToTravel", name: "willingToTravel", label: "Willing to travel?", type: "choice", hint: "Choose Yes or No for work-related travel." },
] as const;
export function missingApplicationFields(answers: AnswerLibrary | null | undefined, rules: DealBreakers | null | undefined, country="BD") {
  const a = answers || {};
  const missing: { name: string; label: string; key: string; required: boolean }[] = APPLICATION_FIELDS.filter(f => {
    if(f.key === "birthDate")return country === "BD" && !validBirthDate(a.birthDate);
    if (f.key === "expectedSalary" && a.salaryNegotiable === true && Number(a.currentSalary)>0) return false;
    const v = a[f.key];
    return v == null || v === "unknown" || (typeof v === "number" && (!Number.isFinite(v) || (f.key === "expectedSalary" && v <= 0)));
  }).map(f => ({ ...f, required: f.key === "birthDate" || f.key === "expectedSalary" || (f.key === "workAuthorization" && rules?.workAuthorizationRequired === true) }));
  if (rules?.minSalarySet !== true && !(Number(rules?.minSalary) > 0)) missing.unshift({ name:"minSalary",key:"minSalary",label:"Minimum salary preference",required:true });
  for (const [key,label] of [["excludedCompanies","Excluded companies"],["excludedIndustries","Excluded industries"],["excludedRoleTypes","Excluded role types"]] as const) {
    const confirmed = rules?.[`${key}Set`] === true || !!rules?.[key]?.some(v=>v.trim());
    if (!confirmed) missing.push({name:key,key,label,required:true});
  }
  return missing;
}
