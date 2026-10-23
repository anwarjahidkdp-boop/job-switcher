import { expect, it } from "vitest";
import { missingApplicationFields } from "./application-profile";
const noLimits={minSalarySet:true,excludedCompaniesSet:true,excludedIndustriesSet:true,excludedRoleTypesSet:true};
it("keeps blank answers incomplete instead of assuming no restrictions",()=>{
 const missing=missingApplicationFields({},{});expect(missing).toHaveLength(12);expect(missing.some(f=>f.key==='minSalary')).toBe(true);expect(missing.some(f=>f.key==='excludedCompanies')).toBe(true);
});
it("accepts explicit no limits, negotiable salary, No and zero answers",()=>{
 expect(missingApplicationFields({workAuthorization:'no',salaryNegotiable:true,noticeDays:0,sponsorshipRequired:false,willingToRelocate:false,managementYears:0,teamSize:0,willingToTravel:false},noLimits)).toEqual([]);
});
it("recognises existing numeric salary and exclusion lists and does not require invented names",()=>{
 const missing=missingApplicationFields({expectedSalary:20000},{minSalary:15000,excludedCompanies:['Acme'],excludedIndustries:['tobacco'],excludedRoleTypes:['contract']});expect(missing.some(f=>['expectedSalary','minSalary','excludedCompanies','excludedIndustries','excludedRoleTypes'].includes(f.key))).toBe(false);
});
it("marks work authorization required only under its enabled safety rule",()=>{
 expect(missingApplicationFields({workAuthorization:'unknown'},{workAuthorizationRequired:true}).find(f=>f.key==='workAuthorization')?.required).toBe(true);
 expect(missingApplicationFields({workAuthorization:'yes'},{workAuthorizationRequired:true}).some(f=>f.key==='workAuthorization')).toBe(false);
});
