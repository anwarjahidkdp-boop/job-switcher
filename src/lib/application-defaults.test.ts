import {expect,it} from 'vitest';
import {localSearchAnswers} from './application-defaults';
import {setupRequirements} from './eligibility';
it('defaults only a known home-country search and preserves explicit overrides',()=>{
 expect(localSearchAnswers({},'BD','BD')).toMatchObject({workAuthorization:'yes',sponsorshipRequired:false,workAuthorizationSource:'home_country_default'});
 expect(localSearchAnswers({workAuthorization:'no',sponsorshipRequired:true},'BD','BD')).toMatchObject({workAuthorization:'no',sponsorshipRequired:true});
 expect(localSearchAnswers({},'GB','BD')).toEqual({});
 expect(localSearchAnswers({},'BD','XX')).toEqual({});
 expect(setupRequirements({target_country:'BD',home_country:'BD'})).toEqual(['Date of birth','Expected salary']);
 expect(setupRequirements({target_country:'BD',home_country:'BD',personal:{dob:'1987-12-05'},preferences:{salaryMin:70000}})).toEqual([]);
});
