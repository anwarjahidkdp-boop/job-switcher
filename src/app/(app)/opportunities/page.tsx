import {PageHead} from '@/components/PageHead';
import {OpportunityRow} from '@/components/OpportunityRow';
import {requireAppState} from '@/lib/server/page';
import {opportunitySections} from '@/lib/matching';
import {portals} from '@/lib/countries';
import {PastePanel} from '../inbox/PastePanel';
export const metadata={title:'All opportunities'};
export default async function Opportunities(){
 const {st}=await requireAppState('/opportunities');
 const {ranked}=opportunitySections(st.scored,st.dismissed,st.apps);
 return <><PageHead compact back={{href:'/inbox',label:'Back to Home'}} title={<>All opportunities</>} sub="Available matches, highest score first. Submitted applications stay in Applied."/><div className="card" style={{marginTop:18}}><PastePanel sites={portals(st.country)}/>
 {ranked.length?ranked.map(x=><OpportunityRow key={x.job.id} x={x} today={st.today} status={st.apps[x.job.id]?.status} ai={st.aiCheck.get(x.job.id)}/>):<p className="muted" style={{padding:16}}>No new opportunities right now.</p>}
 </div></>;
}
