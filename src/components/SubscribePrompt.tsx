"use client";
import Link from "next/link";
export function SubscribePrompt({close,feature="prepare a new application"}:{close:()=>void;feature?:string}){
 return <div role="presentation" className="modal-backdrop" onClick={close} style={{position:"fixed",inset:0,zIndex:9999,display:"grid",placeItems:"center",background:"rgba(10,24,47,.65)",padding:16}}>
  <div role="dialog" aria-modal="true" aria-labelledby="subscription-dialog-title" className="card panel" onClick={e=>e.stopPropagation()} style={{width:"min(100%,430px)",background:"var(--surface,white)",padding:24}}>
   <h2 id="subscription-dialog-title">Continue with JobPao Pro</h2>
   <p style={{margin:"12px 0"}}>Your 5-day trial has ended. Subscribe to {feature}. Your prepared documents, job matches, and application history remain available.</p>
   <div className="row"><Link className="btn btn-primary" href="/upgrade?from=trial">View subscription plans</Link><button type="button" className="btn btn-ghost" onClick={close}>Not now</button></div>
  </div>
 </div>;
}
