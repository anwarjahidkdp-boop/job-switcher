import type { PersonalDetails } from '../types';
import {validBirthDate} from '../eligibility';
const digit=(s:string)=>s.replace(/[০-৯]/g,c=>String('০১২৩৪৫৬৭৮৯'.indexOf(c)));
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
const bnMonths=['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
/** Only a labelled source date; never infer from age, employment or graduation dates. */
export function cvBirthDate(value:string):string|null {
 const text=digit(value).trim();if(validBirthDate(text))return text;
 let y:number,m:number,d:number;
 const numeric=text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\b|$)/);
 const words=text.toLowerCase().match(/^(\d{1,2})(?:st|nd|rd|th)?[\s,-]+([^\d,]+?)[\s,-]+(\d{4})(?:\b|$)/);
 if(numeric){d=Number(numeric[1]);m=Number(numeric[2]);y=Number(numeric[3]);if(d<=12&&m<=12&&d!==m)return null;}
 else if(words){d=Number(words[1]);y=Number(words[3]);const name=words[2].trim();m=months.findIndex(n=>n===name||n.slice(0,3)===name)+1;if(!m)m=bnMonths.indexOf(name)+1;}
 else return null;
 const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return validBirthDate(iso)?iso:null;
}
const fields:[Exclude<keyof PersonalDetails,'references'>,string][]=[
 ['fatherName',"father(?:['’]s)?\\s*name|পিতার\\s*নাম"],['motherName',"mother(?:['’]s)?\\s*name|মাতার\\s*নাম"],
 ['dob','date\\s*of\\s*birth|birth\\s*date|d\\.?o\\.?b\\.?|জন্ম\\s*তারিখ|জন্মতারিখ'],
 ['nationality','nationality|নাগরিকত্ব|জাতীয়তা|জাতীয়তা'],['marital','marital\\s*status|বৈবাহিক\\s*অবস্থা'],
 ['religion','religion|ধর্ম'],['address','permanent\\s*address|স্থায়ী\\s*ঠিকানা|স্থায়ী\\s*ঠিকানা'],
];
/** Source-only extraction from explicit labels, at no model cost. Saved user edits take precedence. */
export function personalFromCv(text:string):PersonalDetails {
 const out:PersonalDetails={};const input=text.replace(/\r/g,'').replace(/[\t]+/g,' ').replace(/\bMarital\s*\n\s*Status/gi,'\nMarital Status');
 const pattern=new RegExp(`(?:^|\\n)\\s*(${fields.map(([,label])=>label).join('|')})\\s*[:：ঃ-]?\\s*`,'gim');
 const hits=[...input.matchAll(pattern)];
 for(let i=0;i<hits.length;i++){
  const hit=hits[i];const spec=fields.find(([,label])=>new RegExp(`^(?:${label})$`,'i').test(hit[1]));if(!spec)continue;
  const tail=input.slice(hit.index!+hit[0].length,hits[i+1]?.index??input.length);
  const value=tail.split('\n').map(s=>s.trim()).find(Boolean)?.replace(/^[:：ঃ-]\s*/,'').trim()||'';
  if(!value||value.length>(spec[0]==='address'?200:120)||/^(?:references?|declaration|signature|personal details?)\b/i.test(value))continue;
  if(spec[0]==='dob'){const dob=cvBirthDate(value);if(dob)out.dob=dob;}else out[spec[0]]=value;
 }
 return out;
}
export function fillPersonalFromCv(saved:PersonalDetails|undefined|null,text:string):PersonalDetails {
 const parsed=personalFromCv(text);const filled={...parsed,...saved};
 // Empty saved placeholders do not erase explicit source text; a nonempty manual edit wins.
 for(const [key] of fields)if(!saved?.[key]?.trim()&&parsed[key])filled[key]=parsed[key];
 if(saved?.dob){const dob=cvBirthDate(saved.dob);if(dob)filled.dob=dob;}
 return filled;
}
