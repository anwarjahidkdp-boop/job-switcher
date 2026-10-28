'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { readSetupCv,saveSetupCv } from '@/lib/cv/setup-draft';
import { GuidedSetupSchema, readSetupDraft, SETUP_DRAFT_KEY } from '@/lib/guided-setup';
export function GuidedHandoff(){const started=useRef(false);const [error,setError]=useState('');const [attempt,setAttempt]=useState(0);
 useEffect(()=>{if(started.current)return;started.current=true;let raw:string|null=null;try{raw=localStorage.getItem(SETUP_DRAFT_KEY);}catch{}
 const saved=readSetupDraft(raw),parsed=GuidedSetupSchema.safeParse(saved);if(!parsed.success){setError('Your saved answers are unavailable in this browser. Return to the search setup, or continue with account setup below.');return;}
 void (async()=>{try{const r=await fetch('/api/onboarding/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data)});const b=await r.json();if(!r.ok)throw new Error(b.error||'Could not save your answers.');
if(b.imported&&!b.existing){const cv=await readSetupCv();if(cv){const form=new FormData();form.set('file',cv.file);form.set('text',cv.text);form.set('country',parsed.data.country);const upload=await fetch('/api/onboarding/cv',{method:'POST',body:form});const saved=await upload.json();if(!upload.ok)throw new Error(saved.error||'Could not save your CV. Your local file is kept; retry below.');await saveSetupCv(null);}}
try{localStorage.removeItem(SETUP_DRAFT_KEY);}catch{}window.location.replace('/onboarding');}catch(e){setError((e as Error).message);}})();
 },[attempt]);
 return <div className="ob card panel" style={{margin:'30px auto'}}><h1>Bringing your answers with you</h1>{error?<><p role="alert" className="err">{error}</p><div className="row" style={{marginTop:16}}><button className="btn btn-primary" onClick={()=>{started.current=false;setError('');setAttempt(x=>x+1);}}>Retry saving</button><Link className="btn btn-ghost" href="/get-started">Review search setup</Link><a href="/onboarding">Continue account setup</a></div></>:<p role="status">Saving your answers and any CV you added. You will not need to upload it again.</p>}</div>;
}

/** Email recovery links can lose their next parameter; resume a valid local setup only for a new account. */
export function GuidedDraftResume(){useEffect(()=>{try{const d=readSetupDraft(localStorage.getItem(SETUP_DRAFT_KEY));if(GuidedSetupSchema.safeParse(d).success)window.location.replace('/onboarding?import=1');}catch{}},[]);return null;}
