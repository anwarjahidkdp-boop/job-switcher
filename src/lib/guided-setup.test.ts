import {describe,expect,it} from 'vitest';
import {draftEnvelope,emptySetup,GuidedSetupSchema,guidedSteps,readSetupDraft,SETUP_DRAFT_TTL,setupPayload,stepError} from './guided-setup';
const uk={...emptySetup('GB'),roles:'Financial Accountant',salaryMin:42000,workAuthorization:'yes' as const,sponsorshipRequired:false,willingToRelocate:false};
describe('guided setup',()=>{
 it('asks country-specific questions and never assumes residency proves work permission',()=>{expect(guidedSteps(uk)).not.toContain('age');expect(guidedSteps({...uk,country:'BD'})).toContain('age');expect(stepError('permission',emptySetup('GB'))).toContain('authorization');});
 it('validates the salary unit values, birth date and required answers before signup',()=>{expect(GuidedSetupSchema.safeParse(uk).success).toBe(true);for(const v of [{...uk,salaryMin:0},{...uk,salaryMax:30000},{...uk,notice:-1},{...uk,workAuthorization:'unknown'},{...uk,country:'BD',birthDate:'2025-02-30'}])expect(GuidedSetupSchema.safeParse(v).success).toBe(false);});
 it('restores incomplete drafts but refuses expired, corrupt and oversized values',()=>{const draft=emptySetup();expect(readSetupDraft(draftEnvelope(draft))).toEqual(draft);expect(readSetupDraft('bad')).toBeNull();expect(readSetupDraft(JSON.stringify({version:1,savedAt:Date.now()-SETUP_DRAFT_TTL-100,value:uk}))).toBeNull();expect(readSetupDraft(draftEnvelope({...uk,roles:'x'.repeat(501)}))).toBeNull();});
 it('keeps UK birth dates out of the CV and marks immigration answers as user-confirmed',()=>{const p=setupPayload({...uk,birthDate:'1980-01-01',excludedCompanies:'Example Ltd, Other Co'});expect(p.personal).toEqual({});expect(p.readiness.workAuthorizationSource).toBe('user');expect(p.excludedCompanies).toEqual(['example ltd','other co']);expect(p.prefs.salaryMin).toBe(42000);});
 it('keeps zero notice and explicit no exclusions',()=>{const p=setupPayload({...uk,notice:0});expect(p.prefs.notice).toBe(0);expect(p.excludedCompanies).toEqual([]);});
});
