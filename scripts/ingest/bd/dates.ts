export const latinDigits=(s:string)=>s.replace(/[০-৯]/g,n=>String('০১২৩৪৫৬৭৮৯'.indexOf(n)));
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
const bangla=['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
export function sourceDate(raw:unknown):string|null {
 if(typeof raw!=='string')return null;let s=latinDigits(raw.normalize('NFC')).replace(/(\d)(st|nd|rd|th)\b/gi,'$1');
 for(let i=0;i<12;i++)s=s.replaceAll(bangla[i],months[i]).replaceAll(bangla[i].replaceAll('য়','য়'),months[i]);
 let y:number,m:number,d:number;let a=s.match(/\b(20\d{2})-(\d{2})-(\d{2})(?=T|\b)/);
 if(a){y=+a[1];m=+a[2];d=+a[3];}else{
  a=s.match(/\b(\d{1,2})[ /.-]+([a-z]+)[ ,/-]+(20\d{2})\b/i);
  if(a){d=+a[1];m=months.findIndex(x=>x.startsWith(a![2].toLowerCase()))+1;y=+a[3];}
  else {a=s.match(/\b([a-z]+)[ ]+(\d{1,2}),?[ ]+(20\d{2})\b/i);if(a){m=months.findIndex(x=>x.startsWith(a![1].toLowerCase()))+1;d=+a[2];y=+a[3];}
   else {a=s.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);if(!a)return null;d=+a[1];m=+a[2];y=+a[3];}}
 }
 if(m<1||m>12)return null;const date=new Date(Date.UTC(y,m-1,d));return date.getUTCDate()===d&&date.getUTCMonth()===m-1?date.toISOString().slice(0,10):null;
}
