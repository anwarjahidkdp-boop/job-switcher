import React from 'react';
import { expect,it,vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('@/app/actions',()=>({saveCareerSafetyAction:vi.fn()}));
import { ApplicationSafetyForm } from './ApplicationSafetyForm';
it('highlights unanswered fields and explains explicit no-limit choices',()=>{
 const html=renderToStaticMarkup(<ApplicationSafetyForm answers={{}} rules={{}}/>);
 expect(html).toContain('12 details still incomplete');expect(html).toContain('var(--warn-soft)');expect(html).toContain('No exclusions');expect(html).toContain('no fixed minimum');
});
it('shows completed information with Edit controls and removes its entry boxes',()=>{
 const html=renderToStaticMarkup(<ApplicationSafetyForm answers={{workAuthorization:'yes',salaryNegotiable:true,noticeDays:0,sponsorshipRequired:false,willingToRelocate:false,managementYears:0,teamSize:0,willingToTravel:false}} rules={{minSalarySet:true,excludedCompaniesSet:true,excludedIndustriesSet:true,excludedRoleTypesSet:true}}/>);
 expect(html).toContain('Saved information');expect(html).toContain('Negotiable');expect(html).toContain('No exclusions');expect(html).toContain('Edit');expect(html).not.toContain('type="number"');expect(html).not.toContain('<select');expect(html).not.toContain('still incomplete');
});
