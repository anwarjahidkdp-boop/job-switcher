"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import type {AppStatus} from '@/lib/types';
export function ApplicationProgress(p:{jobId:string;status:AppStatus;appliedAt:string|null;interviewAt?:string|null;history:{status:string|null;event:string}[];trial:boolean;remaining:number}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const reported=!!p.appliedAt;
 const interview=!!p.interviewAt||p.status==='interview'||p.history.some(e=>e.status==='interview');
 const offer=p.status==='offer'||p.history.some(e=>e.status==='offer');
 async function update(action:string){setBusy(true);setError('');try{const r=await fetch(`/api/applications/${p.jobId}/progress`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,confirm:true})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Could not update.');router.refresh();}catch(e){setError(e instanceof Error?e.message:'Could not update.');}finally{setBusy(false);}}
 return <section className="application-progress" id="application-progress" aria-label="Application progress"><h3>Track your application</h3><div className="application-progress-steps">{[['Prepared',true],['Applied',reported],['Interview',interview],['Offer',offer]].map(([label,reached])=><span key={String(label)} data-reached={String(reached)}>{reached?'✓ ':''}{label}</span>)}</div>
  {!reported?<><p className="small">Sent the email or submitted the employer’s form? Confirm it here to move this job to Applied.</p><button className="btn btn-primary" disabled={busy||!['ready','reminder','waiting'].includes(p.status)||(p.trial&&!p.remaining)} onClick={()=>void update('applied')}>{busy?'Updating…':"I’ve applied"}</button><p className="small muted">Only press after submitting. This is your confirmation; JobPao cannot verify emails sent outside the app.{p.trial?' It uses your daily application allowance.':''}</p>{p.trial&&!p.remaining?<Link prefetch={false} className="btn btn-ghost btn-sm" href="/upgrade">Daily allowance used · View Pro</Link>:null}</>:<><p className="small">{p.history.some(e=>e.event==='You confirmed: applied externally')?'Applied · confirmed by you':'Application recorded as sent'}{['closed','withdrawn'].includes(p.status)?` · ${p.status==='closed'?'Closed':'Withdrawn'}`:''}</p><div className="row">{['applied','interview'].includes(p.status)?<><a className="btn btn-primary btn-sm" href="#interview">{interview?'Edit interview details':'Add interview details'}</a><button className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>void update('offer')}>Offer received</button></>:null}<Link prefetch={false} className="btn btn-ghost btn-sm" href="/applications">View Applied</Link></div></>}
  {error?<p className="err small" role="alert">{error}</p>:null}
 </section>;
}
