'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {GuidedSetupSchema,readSetupDraft,SETUP_DRAFT_KEY,type GuidedSetup} from '@/lib/guided-setup';
import {readCvFile} from '@/lib/cv/browser-read';
import {MAX_CV_TEXT,MIN_CV_CHARS} from '@/lib/cv/sniff';
import {readSetupCv,saveSetupCv,type SetupCv} from '@/lib/cv/setup-draft';
import styles from '@/components/GuidedSetup.module.css';
type Result={count:number;searched:number;limited:boolean;matches:{title:string;company:string;location:string|null;evidence:string[]}[];checkedAt:string};
const signup='/login?mode=signup&quiz=done&next=%2Fonboarding%3Fimport%3D1';
export function CvPreview(){
 const [setup,setSetup]=useState<GuidedSetup|null>(null),[ready,setReady]=useState(false),[cv,setCv]=useState<SetupCv|null>(null),[result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[seconds,setSeconds]=useState(0);
 useEffect(()=>{let active=true;void (async()=>{let restored:SetupCv|null=null;let note='';try{restored=await readSetupCv();}catch{note='Your browser could not restore the CV. Choose it again, or skip for now.';}if(!active)return;try{const parsed=GuidedSetupSchema.safeParse(readSetupDraft(localStorage.getItem(SETUP_DRAFT_KEY)));if(parsed.success)setSetup(parsed.data);}catch{}setCv(restored);setError(note);setReady(true);})();return()=>{active=false;};},[]);
 async function check(value:SetupCv,start=performance.now()){
  if(!setup)return;setBusy(true);setError('');setResult(null);
  try{const r=await fetch('/api/setup/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({setup,text:value.text}),signal:AbortSignal.timeout(30000)});const b=await r.json();if(!r.ok)throw new Error(b.error||'Could not check jobs.');setSeconds(Math.max(0.1,(performance.now()-start)/1000));setResult(b);}catch(e){setError(e instanceof Error&&e.name==='TimeoutError'?'This is taking too long. Try again, or continue to signup.':(e as Error).message);}finally{setBusy(false);}
 }
 async function upload(file:File){const start=performance.now();setBusy(true);setError('');setResult(null);try{await saveSetupCv(null);setCv(null);const read=await readCvFile(file);if(!('text' in read))throw new Error('This CV is a scan or photo. Sign up to use our scan reader, or choose a PDF with selectable text, DOCX or TXT.');if(read.text.length<MIN_CV_CHARS)throw new Error('We could not read enough of this CV. Choose a clearer file.');const value={file,text:read.text.slice(0,MAX_CV_TEXT),savedAt:Date.now()};await saveSetupCv(value);setCv(value);await check(value,start);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className={styles.shell}><div className="card panel"><p className="eyebrow">ONE LAST STEP · YOUR CV</p><h1>Let’s find jobs for you</h1><p>Upload your CV to see a first look at jobs that match your roles and CV keywords.</p>
 {!ready?<p role="status">Loading your saved answers…</p>:!setup?<><p role="alert">Finish your search questions first.</p><Link className="btn btn-primary" href="/get-started">Back to questions</Link></>:<>
 <div className={styles.upload}><label className="f">Choose your CV<input type="file" accept=".pdf,.docx,.txt" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value='';}}/></label><p className="small muted">PDF, Word (DOCX) or TXT · Up to 10 MB</p><p className="small">Your file stays in this browser for up to 24 hours. We use its text to check jobs without saving it on our servers before signup. Use this same browser after email confirmation.</p></div>
 {cv?<p className="small">✓ CV ready: <b>{cv.file.name}</b> <button type="button" className="btn-text" disabled={busy} onClick={()=>{void saveSetupCv(null).then(()=>{setCv(null);setResult(null);}).catch(()=>setError('Could not remove the local CV. Please try again.'));}}>Remove CV</button></p>:null}
 {busy?<p role="status">Reading your CV and checking current job listings…</p>:null}{error?<p role="alert" className="err">{error}</p>:null}
 {cv&&!busy&&!result?<button type="button" className="btn btn-ghost" onClick={()=>void check(cv)}>Check my matches again</button>:null}
 {result?<div className={styles.result} aria-live="polite"><h2>{result.count===0?'No initial matches yet':`${result.count} initial job match${result.count===1?'':'es'} found`}</h2><p>Checked {result.searched.toLocaleString()} {result.limited?'most recent ':''}live listings in {seconds.toFixed(1)} seconds.</p><p className="small muted">A first look based on your chosen roles, CV keywords and saved restrictions—not a verified fit score. Experience, education and full job requirements still need checking after signup. This is a snapshot, not a saved search.</p>{result.matches.map((m,i)=><article className={styles.previewCard} key={i}><h3>{m.title}</h3><p>{m.company}{m.location?` · ${m.location}`:''}</p><p className="small">Found in your CV: {m.evidence.join(', ')}</p></article>)}{!result.count?<p>Try another job title or city, or create your account for a full CV review. We will not invent matches.</p>:null}</div>:null}
 <div className={styles.nav}><Link className="btn btn-ghost" href="/get-started">Edit my answers</Link><Link className="btn btn-primary" href={signup} aria-disabled={busy} onClick={e=>{if(busy)e.preventDefault();}}>{result?.count?'Sign up & continue with my CV':'Sign up & continue'}</Link></div>
 <p className="small muted">Create an account to save your CV to your profile, build your improved CV and download its PDF. No CV download is available before signup.</p>
 {!cv?<Link className="btn-text" href={signup}>Skip CV for now →</Link>:null}
 </>}
 </div></section>;
}
