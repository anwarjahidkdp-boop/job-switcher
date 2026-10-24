'use client';
import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dismissAction } from '@/app/actions';
export function QueueDismissButton({jobId,advance=false}:{jobId:string;advance?:boolean}) {
 const [pending,start]=useTransition(), [error,setError]=useState('');
 const router=useRouter();
 return <><button className="btn btn-text btn-sm" disabled={pending} onClick={()=>start(async()=>{try{await dismissAction(jobId);if(advance)router.replace("/queue");else router.refresh();}catch{setError('Could not remove. Try again.');}})}>{pending?'Removing…':'Remove'}</button>{error?<span role="alert" className="err small">{error}</span>:null}</>;
}
