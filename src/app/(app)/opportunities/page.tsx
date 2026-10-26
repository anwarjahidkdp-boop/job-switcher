import Link from 'next/link';
import {PageHead} from '@/components/PageHead';
import {OpportunityRow} from '@/components/OpportunityRow';
import {requireAppState} from '@/lib/server/page';
import {countFoundSince} from '@/lib/server/state';
import {opportunitySections} from '@/lib/matching';
import {portals,rule} from '@/lib/countries';
import {nowMs} from '@/lib/today';
import {dayStart,jobsBehind,jobTotals,SUMMARY_FILTERS,type SummaryFilter} from '@/lib/server/search-summary';
import {sinceParam,VISIT_COOKIE} from '@/lib/visit';
import {briefingWindow} from '@/lib/server/briefing';
import {cookies} from 'next/headers';
import {PastePanel} from '../inbox/PastePanel';
export const metadata={title:'All opportunities'};

const LABEL:Record<SummaryFilter,string>={found:'Jobs found',matched:'Top match',ex:'Strong Fit',st:'Best Fit',po:'Good Fit',rest:'Stretch & others'};
const NOTE:Record<SummaryFilter,string>={found:'Every job we checked for you, highest score first.',matched:'Jobs that match 70% and above.',ex:'Scores of 90% and above.',st:'Scores from 80% to 89%.',po:'Scores from 70% to 79%.',rest:'Under 70%, outside your field, or past the deadline.'};

// Empty fit groups point to the career guide, so a zero is a next step and not a dead end.
const GROW:Partial<Record<SummaryFilter,string>>={matched:' Matches of 70% and above come when your CV shows the skills employers ask for.',ex:' A 90%+ score needs your CV to cover most of what a job asks for.',st:' An 80%+ score needs your CV to cover most key skills of a role.',po:' A 70%+ score needs your CV to show the core skills of your target role.'};

export default async function Opportunities({searchParams}:{searchParams:Promise<{fit?:string;when?:string;since?:string}>}){
 const {st,db}=await requireAppState('/opportunities');
 const sp=await searchParams;
 const fit=SUMMARY_FILTERS.find(f=>f===sp.fit);
 if(!fit){
  const {ranked}=opportunitySections(st.scored,st.dismissed,st.apps);
  return <><PageHead compact back={{href:'/inbox',label:'Back to Home'}} title={<>All opportunities</>} sub="Available matches, highest score first. Submitted applications stay in Applied."/><div className="card" style={{marginTop:18}}><PastePanel sites={portals(st.country)}/>
  {ranked.length?ranked.map(x=><OpportunityRow key={x.job.id} x={x} today={st.today} status={st.apps[x.job.id]?.status} ai={st.aiCheck.get(x.job.id)}/>):<p className="muted" style={{padding:16}}>No new opportunities right now.</p>}
  </div></>;
 }
 // The jobs behind a number on the Home summary: same rules as the summary, so the count and the list agree.
 // "New for you" on Home links with the visit window (when=new&since=); older links ask for today.
 const fresh=sp.when==='new'?sinceParam(sp.since,nowMs()):null;
 const legacyToday=sp.when==='today'&&fresh==null;
 // The period switch opens the same fresh-jobs window as Home (briefingWindow), never a different one.
 const briefSince=fresh??(await briefingWindow(db,st,(await cookies()).get(VISIT_COOKIE)?.value,nowMs())).since.getTime();
 const today=fresh!=null||legacyToday;
 const since=fresh!=null?new Date(fresh):legacyToday?dayStart(rule(st.country).timeZone,new Date(nowMs())):null;
 const period=legacyToday?'Today':'Today\'s Fresh Jobs';
 // Count and list come from jobsBehind, the same source as every number on Home, so they always agree.
 const all=Math.max(st.analysed,st.scored.length);
 const checked=since?await countFoundSince(db,{...st,analysed:all},since):all;
 const {rows,count,unlisted}=jobsBehind(st.scored,since,fit,checked);
 const allTime=since?jobTotals(st.scored,null,all)[fit]:count;
 const href=(f:SummaryFilter,t:boolean)=>`/opportunities?fit=${f}${t?(legacyToday?'&when=today':`&when=new&since=${briefSince}`):''}`;
 return <><PageHead compact back={{href:'/inbox',label:'Back to Home'}} title={<>{LABEL[fit]} · {today?period:'All time'}</>} sub={`${count.toLocaleString('en-GB')} ${count===1?'job':'jobs'}. ${NOTE[fit]}`}/>
  <div className="card panel" style={{marginTop:18,display:'grid',gap:10}}>
   <nav className="row" style={{gap:6,flexWrap:'wrap'}} aria-label="Period">
    <Link prefetch={false} className={`seg${today?' on':''}`} href={href(fit,true)} aria-current={today?'page':undefined}>{period}</Link>
    <Link prefetch={false} className={`seg${today?'':' on'}`} href={href(fit,false)} aria-current={today?undefined:'page'}>All time</Link>
   </nav>
   <nav className="row" style={{gap:6,flexWrap:'wrap'}} aria-label="Fit">
    {SUMMARY_FILTERS.map(f=><Link prefetch={false} key={f} className={`seg${f===fit?' on':''}`} href={href(f,today)} aria-current={f===fit?'page':undefined}>{LABEL[f]}</Link>)}
   </nav>
  </div>
  <div className="card" style={{marginTop:12}}>
   {rows.length?rows.map(x=><OpportunityRow key={x.job.id} x={x} today={st.today} status={st.apps[x.job.id]?.status} ai={st.aiCheck.get(x.job.id)}/>):unlisted?null:<p className="muted" style={{padding:16}}>{fresh!=null?'No fresh jobs in this group yet today.':today?'No jobs in this group were found for you today.':'No jobs in this group yet.'}</p>}
   {!count&&GROW[fit]?<div className="fit-grow">
    <p><b>How to get more {LABEL[fit]} roles</b>{GROW[fit]} Your career guide shows the skills, courses and CV details that raise your score.</p>
    <div className="row" style={{gap:8,flexWrap:'wrap'}}>
     <Link prefetch={false} className="btn btn-primary" href="/insights#career-guidance">Open career guide →</Link>
     {today&&allTime?<Link prefetch={false} className="btn btn-ghost" href={href(fit,false)}>See all-time {LABEL[fit]}</Link>:null}
    </div>
   </div>:null}
   {unlisted?<p className="muted small" style={{padding:'12px 16px',borderTop:'1px solid var(--line)'}}>We also checked {unlisted.toLocaleString('en-GB')} more {unlisted===1?'job':'jobs'} with a lower fit or outside your target roles. They are not listed here.</p>:null}
  </div></>;
}
