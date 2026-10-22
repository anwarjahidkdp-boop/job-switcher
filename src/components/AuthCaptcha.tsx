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
  const id=turnstile.render(ref.current,{sitekey:siteKey,callback:(token:string)=>{setFailed(false);onToken(token);},"expired-callback":()=>onToken(""),"error-callback":()=>{onToken("");setFailed(true);},"refresh-expired":"auto"});
  return ()=>{turnstile.remove(id);};
 },[ready,siteKey,onToken]);
 return <div><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={()=>setReady(true)} onError={()=>setFailed(true)}/><div ref={ref}/>{failed?<p role="alert">Security check could not load. Check your connection and reload this page.</p>:null}</div>;
}
