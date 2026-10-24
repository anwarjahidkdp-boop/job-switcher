"use client";
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';

async function shrinkPhoto(file:File):Promise<Blob>{
 const url=URL.createObjectURL(file);
 try{
  const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Choose a readable image.'));i.src=url;});
  const size=Math.min(img.width,img.height),canvas=document.createElement('canvas');
  canvas.width=canvas.height=320;
  canvas.getContext('2d')!.drawImage(img,(img.width-size)/2,((img.height-size)/2)*.5,size,size,0,0,320,320);
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not process the photo.')),'image/jpeg',.85));
 }finally{URL.revokeObjectURL(url);}
}

/** Shared uploader for the design toolbar and the button directly below the CV photo. */
export function CvPhotoPicker({hasPhoto,html}:{hasPhoto:boolean;html?:string}){
 const input=useRef<HTMLInputElement>(null),router=useRouter();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false);
 async function upload(file:File){
  if(busy)return;
  setBusy(true);setMessage('Updating photo…');setError(false);
  try{
   const body=new FormData();body.append('photo',await shrinkPhoto(file),'photo.jpg');
   const response=await fetch('/api/photo',{method:'POST',body});
   if(!response.ok){const result=await response.json().catch(()=>({}));throw new Error(result.error||'Could not update the photo.');}
   setMessage('Photo updated. Your CV and application documents use this photo.');router.refresh();
  }catch(e){setError(true);setMessage(e instanceof Error?e.message:'Could not update the photo.');}
  finally{setBusy(false);if(input.current)input.current.value='';}
 }
 return <div className="cv-photo-picker" aria-busy={busy} onClick={e=>{if(html && !busy && (e.target as HTMLElement).closest('[data-cv-photo-edit]'))input.current?.click();}}>
  {html?<div dangerouslySetInnerHTML={{__html:html}}/>:<button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Updating…':hasPhoto?'Change photo':'Add photo'}</button>}
  <input ref={input} type="file" accept="image/*" className="hide" aria-label={hasPhoto?'Change CV photo':'Add CV photo'} disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);}}/>
  {message?<p className={`small cv-photo-picker-status${error?' err':' muted'}`} role={error?'alert':'status'}>{message}</p>:null}
 </div>;
}
