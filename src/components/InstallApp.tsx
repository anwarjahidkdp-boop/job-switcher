"use client";
import {useEffect,useState,useRef} from "react";
import {usePathname} from "next/navigation";
import {createInstaller,INSTALL_GUIDE,installOs,type InstallOs,type InstallPrompt} from "@/lib/pwa/install";

const SESSION_KEY="jp-install-dismissed-session";
const standalone=()=>window.matchMedia?.("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
const dismissed=()=>{try{return sessionStorage.getItem(SESSION_KEY)==="1";}catch{return false;}};
/** This explicit entry works even after a dismissed prompt or uninstall. */
export function InstallButton({className="btn btn-primary"}:{className?:string}){
 return <button type="button" className={className} onClick={()=>window.dispatchEvent(new Event("jobpao:install"))}>Install JobPao</button>;
}
export function InstallApp(){
 const [show,setShow]=useState(false);
 const [open,setOpen]=useState(false);
 const [os,setOs]=useState<InstallOs>("android");
 const dialog=useRef<HTMLDialogElement>(null);
 const [installer]=useState(()=>createInstaller({showGuide:()=>setOpen(true),onInstalled:()=>{setShow(false);setOpen(false);}}));
 const where=usePathname();
 const here=where==="/"||where.startsWith("/inbox");
 // On the landing page the reminder waits until the visitor scrolls past the first screen, so it never covers the headline.
 const [scrolled,setScrolled]=useState(false);
 useEffect(()=>{
  if(where!=="/")return;
  const onScroll=()=>setScrolled(window.scrollY>window.innerHeight*.8);
  onScroll();window.addEventListener("scroll",onScroll,{passive:true});
  return()=>window.removeEventListener("scroll",onScroll);
 },[where]);
 useEffect(()=>{
  navigator.serviceWorker?.register("/sw.js").catch(()=>{});
  const sync=()=>{setOs(installOs(navigator.userAgent,navigator.platform,navigator.maxTouchPoints));setShow(!standalone()&&!installer.isInstalled()&&!dismissed());};
  const timer=setTimeout(sync,0);
  const onPrompt=(event:Event)=>{installer.capture(event as InstallPrompt);setShow(!standalone()&&!dismissed());};
  const onDone=()=>installer.installed();
  const onRequest=()=>{void installer.request();};
  const onVisibility=()=>{if(document.visibilityState==="visible")sync();};
  window.addEventListener("beforeinstallprompt",onPrompt);
  window.addEventListener("appinstalled",onDone);
  window.addEventListener("jobpao:install",onRequest);
  window.addEventListener("focus",sync);
  document.addEventListener("visibilitychange",onVisibility);
  return()=>{clearTimeout(timer);window.removeEventListener("beforeinstallprompt",onPrompt);window.removeEventListener("appinstalled",onDone);window.removeEventListener("jobpao:install",onRequest);window.removeEventListener("focus",sync);document.removeEventListener("visibilitychange",onVisibility);};
 },[installer]);
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
 const hide=()=>{setShow(false);try{sessionStorage.setItem(SESSION_KEY,"1");}catch{}};
 const guide=INSTALL_GUIDE[os];
 return <>
  {show&&here&&(where!=="/"||scrolled)?<div className="ia"><button type="button" className="ia-btn" onClick={()=>void installer.request()}>Install JobPao</button><button type="button" className="ia-x" onClick={hide} aria-label="Hide install reminder for this session">×</button></div>:null}
  <dialog ref={dialog} className="ia-dialog" aria-labelledby="ia-t" onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)}>
   <div className="ia-card">
    <h2 id="ia-t">{guide.title}</h2>
    <p className="small muted">Install again any time. If the browser does not show a prompt, use its menu below.</p>
    <ol>{guide.steps.map(step=><li key={step}>{step}</li>)}</ol>
    <div className="ia-tabs">{(["android","ios","desktop"] as InstallOs[]).map(k=><button type="button" key={k} className={k===os?"on":""} onClick={()=>setOs(k)}>{k==="ios"?"iPhone":k==="android"?"Android":"Computer"}</button>)}</div>
    <p className="small">Your saved CV, preferences and application history belong to your account. Sign in with the same email to get them back. Unsaved edits may be lost.</p>
    <p className="small muted">Already installed? Open JobPao from your home screen. Installing or removing the icon does not delete your JobPao account.</p>
    <button type="button" className="btn btn-primary" onClick={()=>setOpen(false)}>Close</button>
   </div>
  </dialog>
 </>;
}
