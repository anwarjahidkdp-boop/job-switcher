import Link from 'next/link';
import {PageHead} from '@/components/PageHead';
import {OpportunityRow} from '@/components/OpportunityRow';
import {requireAppState} from '@/lib/server/page';
import {opportunitySections} from '@/lib/matching';
import {portals,rule} from '@/lib/countries';
import {nowMs} from '@/lib/today';
import {dayStart,summaryRows,SUMMARY_FILTERS,type SummaryFilter} from '@/lib/server/search-summary';
import {sinceParam} from '@/lib/visit';
import {PastePanel} from '../inbox/PastePanel';
export const metadata={title:'All opportunities'};

const LABEL:Record<SummaryFilter,string>={found:'Jobs found',matched:'Best match',ex:'Strong Fit',st:'Best Fit',po:'Good Fit',rest:'Stretch & others'};
const NOTE:Record<SummaryFilter,string>={found:'Every job we checked for you, highest score first.',matched:'Jobs that match 70% and above.',ex:'Scores of 90% and above.',st:'Scores from 80% to 89%.',po:'Scores from 70% to 79%.',rest:'Under 70%, outside your field, or past the deadline.'};

export default async function Opportunities({searchParams}:{searchParams:Promise<{fit?:string;when?:string;since?:string}>}){
 const {st}=await requireAppState('/opportunities');
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
 const today=sp.when==='today'||fresh!=null;
 const since=fresh!=null?new Date(fresh):today?dayStart(rule(st.country).timeZone,new Date(nowMs())):null;
 const period=fresh!=null?'Opportunity Briefing':'Today';
 const rows=summaryRows(st.scored,since,fit);
 const unlisted=!today&&fit==='found'?Math.max(0,st.analysed-st.scored.length):0;
 const href=(f:SummaryFilter,t:boolean)=>`/opportunities?fit=${f}${t?(fresh!=null?`&when=new&since=${fresh}`:'&when=today'):''}`;
 return <><PageHead compact back={{href:'/inbox',label:'Back to Home'}} title={<>{LABEL[fit]} · {today?period:'All time'}</>} sub={`${rows.length} ${rows.length===1?'job':'jobs'}. ${NOTE[fit]}`}/>
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
   {rows.length?rows.map(x=><OpportunityRow key={x.job.id} x={x} today={st.today} status={st.apps[x.job.id]?.status} ai={st.aiCheck.get(x.job.id)}/>):<p className="muted" style={{padding:16}}>{fresh!=null?'No new roles in this group since your last briefing.':today?'No jobs in this group were added today.':'No jobs in this group yet.'}</p>}
   {unlisted?<p className="muted small" style={{padding:'12px 16px',borderTop:'1px solid var(--line)'}}>We also checked {unlisted.toLocaleString('en-GB')} more {unlisted===1?'job':'jobs'} outside your target roles. They are not listed here.</p>:null}
  </div></>;
}
