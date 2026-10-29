"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "./ui";
import { SubscribePrompt } from "./SubscribePrompt";

export function PrepareApplicationButton({jobId,label='Prepare Application',openPack=false,locked=false}:{jobId:string;label?:string;openPack?:boolean;locked?:boolean}) {
 const router=useRouter();
 const mounted=useRef(true),currentJob=useRef(jobId);
 useEffect(()=>{mounted.current=true;currentJob.current=jobId;return()=>{mounted.current=false;};},[jobId]);
 const isCurrent=()=>mounted.current&&currentJob.current===jobId;
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[subscribe,setSubscribe]=useState(false);
 async function prepare(){
  if(busy)return;
  if(locked){setSubscribe(true);return;}
  setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch(`/api/applications/${jobId}/prepare`,{method:'POST'});
   const j=await r.json().catch(()=>({}));
   if(!isCurrent())return;
   if(!r.ok){if(r.status===402){setSubscribe(true);return;}throw new Error(j.error || 'Could not prepare the application.');}
   if(j.notice)setNotice(j.notice);
   if(openPack){
    // A fresh query loads the saved pack before Next.js resolves its anchor.
    router.push(`/jobs/${jobId}?application=review&prepared=${Date.now()}#application`);
   }else router.refresh();
  }catch(e){if(isCurrent())setError(e instanceof Error ? e.message : 'Could not prepare the application. Try again.');}
  finally{if(isCurrent())setBusy(false);}
 }
 return <div className="jd-prepare">
  <button type="button" className={`btn btn-primary btn-sm${openPack?' queue-review-cta':''}`} disabled={busy} aria-busy={busy} onClick={prepare}>{busy ? <><Spinner/>Preparing…</>:label}</button>
  {busy ? <p className="note small" role="status">Writing your CV &amp; cover letter…</p>:null}
  {error ? <p className="err small" role="alert">{error}</p>:null}
  {notice ? <p className="note small" role="status">{notice}</p>:null}
  {subscribe?<SubscribePrompt close={()=>setSubscribe(false)}/>:null}
 </div>;
}
