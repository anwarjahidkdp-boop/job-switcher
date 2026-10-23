import {expect,it} from 'vitest';
import {cvBirthDate,fillPersonalFromCv,personalFromCv} from './personal-read';
const source=`Personal Details:
Father's Name : Synthetic Father
Mother's Name : Synthetic Mother
Date of Birth : 05 December 1987
Gender : Male Marital
Status : Married
Nationality : Bangladeshi
Religion : Islam
Permanent address : Synthetic road, Ward 01, Dhaka.
Current Location : Dhaka.
References:
Name : Synthetic Referee`;
it('reads labelled personal information, including a wrapped table label, without asking again',()=>{
 expect(personalFromCv(source)).toEqual({fatherName:'Synthetic Father',motherName:'Synthetic Mother',dob:'1987-12-05',marital:'Married',nationality:'Bangladeshi',religion:'Islam',address:'Synthetic road, Ward 01, Dhaka.'});
});
it('keeps saved edits and fills only the missing fields from the actual CV',()=>{
 expect(fillPersonalFromCv({fatherName:'Edited Father',motherName:''},source)).toMatchObject({fatherName:'Edited Father',motherName:'Synthetic Mother',dob:'1987-12-05'});
});
it('does not infer birth dates from age or education dates, or accept impossible/ambiguous dates',()=>{
 expect(personalFromCv('Graduated 2008\nAge: 40\nStarted work: 2009')).toEqual({});
 expect(cvBirthDate('03/04/1987')).toBeNull();expect(cvBirthDate('31/02/1987')).toBeNull();
 expect(cvBirthDate('25/12/1987')).toBe('1987-12-25');expect(cvBirthDate('05 ডিসেম্বর ১৯৮৭')).toBe('1987-12-05');
});
it('handles a label and value on consecutive lines without reading a neighbouring field as the value',()=>{
 expect(personalFromCv("Father's Name\nSynthetic Father\nMother's Name\nDate of Birth\n05 December 1987")).toEqual({fatherName:'Synthetic Father',dob:'1987-12-05'});
});
