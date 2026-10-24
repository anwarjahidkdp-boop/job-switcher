import {applyQueue} from './apply-queue';
import {rule} from './countries';
import {todayStr,daysUntil,fmtDate} from './dates';
import type {UserState} from './server/state';
/** Only selected, still-unsent opportunities, in the current search country's calendar. */
export function deadlineItems(st:UserState,now=new Date()){
 const tz=rule(st.country).timeZone,today=todayStr(tz,now);
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',hourCycle:'h23'}).format(now));
 if(hour<8)return [];
 return applyQueue({...st,today}).flatMap(x=>{
  if(!x.job.deadline)return [];
  const days=daysUntil(x.job.deadline,today);
  if(days==null||![3,1,0].includes(days))return [];
  const when=days===0?'Deadline today':days===1?'Deadline tomorrow':'Deadline in 3 days';
  return [{...x,days,key:`deadline:${x.job.id}:${x.job.deadline}:${days}`,title:`${when}: ${x.job.company}`,body:`${x.job.title} · ${fmtDate(x.job.deadline)}. ${days===0?'Check the exact closing time in the original post.':'Review the original post and plan your application.'}`}];
 });
}
export function deadlineSummary(items:ReturnType<typeof deadlineItems>){
 return items.slice(0,5).map(x=>`${x.job.title} at ${x.job.company}: ${x.days===0?'deadline today':x.days===1?'deadline tomorrow':'deadline in 3 days'} (${fmtDate(x.job.deadline)}).`).join('\n')+(items.length>5?'\nOpen JobPao for the remaining deadlines.':'')+'\nCheck the original post for its exact closing time.';
}
