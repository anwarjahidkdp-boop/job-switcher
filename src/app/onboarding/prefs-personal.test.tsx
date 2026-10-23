import React from 'react';
import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.stubGlobal('React',React);
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
vi.mock('../actions',()=>({setCountryAction:vi.fn()}));
import {PrefsStep} from './steps';
import {personalFields,convention} from '@/lib/cv/conventions';
const props={editing:true,initial:{roles:'Accountant',locations:'Dhaka',salaryMin:70000,salaryMax:null,notice:30,mode:'Any' as const},countryLabel:'Bangladesh',currency:'BDT per month',fields:personalFields('BD'),personalCountry:true,refs:{mode:convention('BD').refs,count:0},isBD:true,country:'BD',revision:0,needsVisa:false,abroad:false};
it('shows personal facts read from the CV with Edit instead of asking the same questions again',()=>{
 const html=renderToStaticMarkup(<PrefsStep {...props} personal={{fatherName:'Synthetic Father',motherName:'Synthetic Mother',dob:'1987-12-05',nationality:'Bangladeshi',marital:'Married',religion:'Islam',address:'Synthetic address'}}/>);
 expect(html).toContain('Synthetic Father');expect(html).toContain('Synthetic Mother');expect(html).toContain('1987-12-05');expect(html).toContain('Edit');expect(html).not.toContain('id="pd_dob"');expect(html).not.toContain('id="pd_fatherName"');
});
it('asks for a missing Bangladesh birth date while keeping other missing personal fields optional',()=>{
 const html=renderToStaticMarkup(<PrefsStep {...props} personal={{}}/>);
 expect(html).toContain('id="pd_dob"');expect(html).toContain('type="date"');expect(html).toContain('Add other personal details (optional)');
});
