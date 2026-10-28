'use client';
import { useRouter } from 'next/navigation';
import { GuidedSetup } from '@/components/GuidedSetup';
import { draftEnvelope, SETUP_DRAFT_KEY } from '@/lib/guided-setup';
export function StartSearch(){const router=useRouter();return <GuidedSetup onComplete={async d=>{try{localStorage.setItem(SETUP_DRAFT_KEY,draftEnvelope(d,'review'));}catch{throw new Error('This browser could not save your answers. Enable site storage or use another browser before creating your account.');}router.push('/get-started/preview');}}/>;}
