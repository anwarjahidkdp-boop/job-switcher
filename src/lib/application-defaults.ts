import type { AnswerLibrary } from './career-safety';
/** A configurable local-search default, not verified immigration evidence. Explicit answers always win. */
export function localSearchAnswers(answers:AnswerLibrary|undefined|null,target:string,home?:string|null):AnswerLibrary {
 const out={...answers};
 if(!home||home==='XX'||target!==home)return out;
 if(!out.workAuthorization||out.workAuthorization==='unknown'){out.workAuthorization='yes';out.workAuthorizationSource='home_country_default';}
 if(out.sponsorshipRequired==null){out.sponsorshipRequired=false;out.sponsorshipSource='home_country_default';}
 return out;
}
