"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "./ui";

export function PrepareApplicationButton({jobId,label='Prepare Application',openPack=false}:{jobId:string;label?:string;openPack?:boolean}) {
 const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function prepare(){
  if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch(`/api/applications/${jobId}/prepare`,{method:'POST'});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j.error || 'Could not prepare the application.');
   if(j.notice)setNotice(j.notice);
   if(openPack){
    // A fresh query loads the saved pack before Next.js resolves its anchor.
    router.push(`/jobs/${jobId}?application=review&prepared=${Date.now()}#application`);
   }else router.refresh();
  }catch(e){setError(e instanceof Error ? e.message : 'Could not prepare the application. Try again.');}
  finally{setBusy(false);}
 }
 return <div className="jd-prepare">
  <button type="button" className={`btn btn-primary btn-sm${openPack?' queue-review-cta':''}`} disabled={busy} aria-busy={busy} onClick={prepare}>{busy ? <><Spinner/>Preparing CV &amp; cover letter…</>:label}</button>
  {error ? <p className="err small" role="alert">{error}</p>:null}
  {notice ? <p className="note small" role="status">{notice}</p>:null}
 </div>;
}
