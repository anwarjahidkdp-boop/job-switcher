"use client";
import Script from "next/script";
import {useEffect,useRef,useState} from "react";
interface Turnstile { render(el:HTMLElement,options:Record<string,unknown>):string; remove(id:string):void }
const api=()=> (window as Window & {turnstile?:Turnstile}).turnstile;
/** Supabase validates the token server-side. Site key is public; secret stays in Auth settings. */
export function AuthCaptcha({siteKey,onToken}:{siteKey:string;onToken:(token:string)=>void}) {
 const ref=useRef<HTMLDivElement>(null);const [ready,setReady]=useState(false);const [failed,setFailed]=useState(false);
 useEffect(()=>{
  const turnstile=api();if(!ready||!ref.current||!turnstile)return;
  // Stay hidden unless Cloudflare needs the visitor to click. The standard widget is 300px wide; on narrow phones it
  // would spill past the form, so a shown widget uses the compact (150px) size there.
  const id=turnstile.render(ref.current,{sitekey:siteKey,appearance:"interaction-only",size:ref.current.clientWidth<300?"compact":"normal",callback:(token:string)=>{setFailed(false);onToken(token);},"expired-callback":()=>onToken(""),"error-callback":()=>{onToken("");setFailed(true);},"refresh-expired":"auto"});
  return ()=>{turnstile.remove(id);};
 },[ready,siteKey,onToken]);
 return <div><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={()=>setReady(true)} onError={()=>setFailed(true)}/><div ref={ref} style={{display:"flex",justifyContent:"center"}}/>{failed?<p role="alert">Security check could not load. Check your connection and reload this page.</p>:null}</div>;
}
