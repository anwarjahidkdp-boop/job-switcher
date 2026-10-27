import {createHash} from 'node:crypto';
import {GuidedSetupSchema} from '../guided-setup';
import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({load:vi.fn(),country:vi.fn()}));
vi.mock('./state',()=>({loadProfile:m.load}));vi.mock('./onboarding',()=>({setCountry:m.country}));
import {importGuidedSetup} from './guided-setup';
import {emptySetup} from '../guided-setup';
const draft={...emptySetup('GB'),roles:'Accountant',salaryMin:42000,workAuthorization:'yes',sponsorshipRequired:false,willingToRelocate:false};
const profile={home_country:'GB',target_country:'GB',onboarding_step:'country',search_country_version:0,career_meta:{},personal:{},answer_library:{},deal_breakers:{noContract:true},billing_country_locked:false};
function context(){const q={update:vi.fn(),eq:vi.fn(),select:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:{id:'user'},error:null})};q.update.mockReturnValue(q);q.eq.mockReturnValue(q);q.select.mockReturnValue(q);const cv={...q,maybeSingle:vi.fn().mockResolvedValue({data:null,error:null})};cv.eq=vi.fn().mockReturnValue(cv);cv.select=vi.fn().mockReturnValue(cv);return {ctx:{db:{from:vi.fn((table:string)=>table==='cv_documents'?cv:q)},admin:{},userId:'user'},q,cv};}
beforeEach(()=>vi.resetAllMocks());
it('does not replace an existing account with an anonymous browser draft',async()=>{m.load.mockResolvedValue({...profile,onboarding_step:'done'});const {ctx,q}=context();expect(await importGuidedSetup(ctx as never,draft)).toEqual({imported:false,existing:true});expect(q.update).not.toHaveBeenCalled();expect(m.country).not.toHaveBeenCalled();});
it('imports with owner and destination revision guards and preserves unrelated exclusions',async()=>{m.load.mockResolvedValueOnce(profile).mockResolvedValueOnce({...profile,onboarding_step:'upload',career_meta:{guided_setup_pending:createHash('sha256').update(JSON.stringify(GuidedSetupSchema.parse(draft))).digest('hex')}});const {ctx,q}=context();await importGuidedSetup(ctx as never,draft);expect(m.country).toHaveBeenCalledWith(ctx,'GB',false,'GB');expect(q.eq).toHaveBeenCalledWith('id','user');expect(q.eq).toHaveBeenCalledWith('search_country_version',0);expect(q.update).toHaveBeenLastCalledWith(expect.objectContaining({preferences:expect.objectContaining({salaryMin:42000}),deal_breakers:expect.objectContaining({noContract:true}),answer_library:expect.objectContaining({workAuthorizationSource:'user'})}));});
it('refuses billing-country changes and invalid drafts before writes',async()=>{m.load.mockResolvedValue({...profile,home_country:'BD',billing_country_locked:true});const {ctx,q}=context();await expect(importGuidedSetup(ctx as never,draft)).rejects.toThrow('subscription country');await expect(importGuidedSetup(ctx as never,{...draft,salaryMin:-1})).rejects.toThrow();expect(q.update).not.toHaveBeenCalled();});

it('resumes an interrupted import without changing country a second time',async()=>{const pending={...profile,onboarding_step:'upload',career_meta:{guided_setup_pending:createHash('sha256').update(JSON.stringify(GuidedSetupSchema.parse(draft))).digest('hex')}};m.load.mockResolvedValue(pending);const {ctx,q}=context();await importGuidedSetup(ctx as never,draft);expect(m.country).not.toHaveBeenCalled();expect(q.update).toHaveBeenCalledOnce();});

it('protects a returning user who navigated back to the country step',async()=>{m.load.mockResolvedValue(profile);const {ctx,q,cv}=context();cv.maybeSingle.mockResolvedValue({data:{id:'existing-cv'},error:null} as never);expect(await importGuidedSetup(ctx as never,draft)).toEqual({imported:false,existing:true});expect(q.update).not.toHaveBeenCalled();});
