"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addDaysTo, daysUntil, fmtDate } from "@/lib/dates";
import { STATUS_LABEL, type AppStatus } from "@/lib/types";
import type { GapAction } from "@/lib/gap-actions";
import { Spinner } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { addSkillAction, appliedAction, dismissAction, openedAction, snoozeAction } from "@/app/actions";

export function GapList({ gaps }: { gaps: { t: string; skill: string | null; label: string | null; action?: GapAction | null }[] }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<{ skill: string; label: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <ul className="why-list">
        {gaps.map((g) => (
          <li key={g.t}><span className="mk gap">!</span><span>{g.t}{g.skill ? <> <button className="btn-text small" onClick={() => setConfirm({ skill: g.skill!, label: g.label! })}>I have this</button></> : null}{g.action ? <> <Link className="btn-text small" href={g.action.href}>{g.action.label}</Link></> : null}</span></li>
        ))}
      </ul>
      {confirm ? (
        <div className="banner" style={{ marginTop: 12 }}>
          <p className="small">Add <b>{confirm.label}</b> to your verified profile? Only add skills you really have; we use them in every application.</p>
          <div className="row">
            <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => start(async () => { try { await addSkillAction(confirm.skill); setConfirm(null); router.refresh(); } catch { setConfirm(null); } })}>Yes, add it</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PackTabs(props: {cv:React.ReactNode;cvEditor:React.ReactNode;canEdit?:boolean;updatedAt:string;jobId:string;cover:string;subject:string;email:string;to:string|null;checklist:string[];showEmail?:boolean}) {
 const router=useRouter();
 const [panel,setPanel]=useState<{doc:'cv'|'cover';mode:'view'|'edit'|'download'}|null>(null);
 const [extra,setExtra]=useState<'email'|'check'|null>(null);
 const [draft,setDraft]=useState(props.cover),[version,setVersion]=useState(props.updatedAt),[busy,setBusy]=useState(false),[error,setError]=useState('');
 function open(doc:'cv'|'cover',mode:'view'|'edit'|'download') {setError('');setPanel({doc,mode});if(doc==='cover'&&mode==='edit'){setDraft(props.cover);setVersion(props.updatedAt);}}
 async function saveCover(){
  setBusy(true);setError('');
  try{const r=await fetch(`/api/applications/${props.jobId}/documents`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({document:'cover',baseUpdatedAt:version,text:draft})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Could not save.');setPanel(null);router.refresh();}
  catch(e){setError(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}
 }
 return <>
  <div className="application-document-grid">{(['cv','cover'] as const).map(doc=><section className="application-document-card" key={doc} aria-label={doc==='cv'?'CV document actions':'Cover letter document actions'}><h3>{doc==='cv'?'CV':'Cover letter'}</h3><p className="small muted">Prepared for this application</p><div className="row"><button className="btn btn-primary btn-sm" onClick={()=>open(doc,'view')}>View</button><button className="btn btn-ghost btn-sm" disabled={props.canEdit===false} title={props.canEdit===false?"Sent applications cannot be edited":undefined} onClick={()=>open(doc,'edit')}>Edit</button><button className="btn btn-ghost btn-sm" onClick={()=>open(doc,'download')}>Download</button></div></section>)}</div>
  {panel?<section className={`application-document-panel document-panel-${panel.mode}`} aria-label={`${panel.doc==='cv'?'CV':'Cover letter'} ${panel.mode}`}><div className="row" style={{justifyContent:'space-between'}}><h3>{panel.mode==='view'?'View':panel.mode==='edit'?'Edit':'Download'} {panel.doc==='cv'?'CV':'cover letter'}</h3><button className="btn btn-text btn-sm" onClick={()=>setPanel(null)}>Close</button></div>
   {panel.mode==='view'?(panel.doc==='cv'?props.cv:<><div className="copybox">{props.cover}</div><CopyButton text={props.cover} label="Copy cover letter"/></>):null}
   {panel.mode==='edit'?(panel.doc==='cv'?props.cvEditor:<form onSubmit={e=>{e.preventDefault();void saveCover();}}><label className="f">Cover letter<textarea rows={14} value={draft} maxLength={16000} onChange={e=>setDraft(e.target.value)} required disabled={busy}/></label><p className="small muted">Changes apply to this application only. No AI charge.</p><div className="row"><button className="btn btn-primary btn-sm" disabled={busy}>{busy?'Saving…':'Save changes'}</button><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={()=>setPanel(null)}>Cancel</button></div>{error?<p role="alert" className="err small">{error}</p>:null}</form>):null}
   {panel.mode==='download'?<div className="row" style={{marginTop:12}}><a className="btn btn-primary btn-sm" href={`/api/cv/download?format=print&jobId=${props.jobId}${panel.doc==='cover'?'&document=cover':''}`} target="_blank" rel="noopener">Download PDF</a><a className="btn btn-ghost btn-sm" href={`/api/cv/download?format=doc&jobId=${props.jobId}${panel.doc==='cover'?'&document=cover':''}`}>Download Word</a></div>:null}
  </section>:null}
  {props.showEmail !== false ? <section className="application-email-card"><h3>✉ Email draft</h3><p className="small">Copy the email, attach your CV and cover letter as requested, then send it.</p><div className="row"><button className="btn btn-primary btn-sm" onClick={()=>setExtra(extra==='email'?null:'email')}>View email draft</button><CopyButton text={props.email} label="Copy email"/><button className="btn btn-ghost btn-sm" onClick={()=>setExtra(extra==='check'?null:'check')}>Checklist</button></div></section> : <div style={{marginTop:14}}><button className="btn btn-ghost btn-sm" onClick={()=>setExtra(extra==='check'?null:'check')}>Review document checklist</button></div>}
  {props.showEmail !== false && extra==='email'?<div className="application-document-panel"><p className="small muted">To: {props.to||"Employer's email address"}</p><p><b>Subject:</b> {props.subject}</p><div className="copybox">{props.email}</div><div className="row"><CopyButton text={props.subject} label="Copy subject"/><CopyButton text={props.email} label="Copy email"/>{props.to?<a className="btn btn-ghost btn-sm" href={`mailto:${encodeURIComponent(props.to)}?subject=${encodeURIComponent(props.subject)}&body=${encodeURIComponent(props.email)}`}>Open in my email app</a>:null}</div><p className="small muted">Attach the CV and cover letter downloads yourself when sending from your email app.</p></div>:null}
  {extra==='check'?<ul className="why-list">{props.checklist.map(c=><li key={c}><span className="mk ok">✓</span><span>{c}</span></li>)}</ul>:null}
 </>;
}

const DONE: AppStatus[] = ["applied", "interview", "offer", "closed", "withdrawn"];

export function ActionsPanel(p: { jobId: string; status: AppStatus | null; hasPack: boolean; reminderDate: string | null; appliedAt: string | null; deadline: string | null; today: string; applyMethod: string; applyTarget: string | null; url: string | null; notYet: boolean; gmailReady: boolean; gmail: string | null; gmailStatus: string | null; canApply?: boolean; blockingReason?:string; compact?: boolean; journey?:boolean; continueLabel?:string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"main" | "later" | "notyet" | "send">(p.notYet && p.status && !DONE.includes(p.status) ? "notyet" : "main");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const dl = daysUntil(p.deadline, p.today);
  const defDate = p.reminderDate || (p.deadline ? (dl! > 3 ? addDaysTo(p.today, dl! - 3) : addDaysTo(p.today, 1)) : addDaysTo(p.today, 2));
  const [date, setDate] = useState(defDate);
  const em = p.applyMethod === "email";
  const act = (f: () => Promise<unknown>) => start(async () => { setErr(""); try { await f(); router.refresh(); } catch (e) { setErr((e as Error).message || "Something went wrong."); } });

  async function send() {
    setBusy("Sending your application from " + p.gmail); setErr("");
    const r = await fetch(`/api/applications/${p.jobId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
    const j = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) { setErr(j.error || "Could not send the application."); setMode("main"); return; }
    setNotice(`Sent to ${j.to} from ${j.from}. You can see it in your Gmail Sent folder.`);
    router.refresh();
  }
  async function saveReminder(d: string) {
    setErr("");
    if (p.deadline && d > p.deadline) { setErr(`This is after the deadline of ${fmtDate(p.deadline)}. Choose an earlier date.`); return; }
    const r = await fetch("/api/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: p.jobId, date: d }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || "Could not set the reminder."); return; }
    setMode("main");
    router.refresh();
  }

  if (busy) return <><p><Spinner /> {busy}</p></>;
  const gmailNote = p.gmailStatus === "connected" ? "Gmail connected. Review and send this email application." : p.gmailStatus === "failed" ? "Gmail could not be connected. Try again." : p.gmailStatus === "cancelled" ? "Gmail was not connected." : "";
  if(p.canApply===false && !(p.status && DONE.includes(p.status))) return p.compact ? null : <><h3>Review before applying</h3><p className="note small" role="status">{p.blockingReason || "Application eligibility needs verification."}</p><p className="small muted">{p.hasPack?"Your prepared documents are available for review.":"Prepare a review draft to see your CV and cover letter."} JobPao sending remains paused. If you already applied outside JobPao, record it in Track your application below.</p>{p.url?<a className="btn btn-ghost btn-sm" href={p.url} target="_blank" rel="noopener noreferrer nofollow">Check the original post ↗</a>:null}</>;
  if (mode === "send") return (
    <>
      <h3>Send this application?</h3>
      <ul className="small" style={{ paddingLeft: 18, margin: "8px 0 0" }}>
        <li>To: <b>{p.applyTarget}</b></li>
        <li>From: <b>{p.gmail}</b></li>
        <li>Attached: your tailored CV and cover letter (Word files)</li>
      </ul>
      <p className="small muted" style={{ marginTop: 8 }}>Check the Tailored CV, Cover letter and Email tabs first. The email is sent only when you press Send.</p>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={send}>Send application</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setMode("main")}>Cancel</button>
      </div>
    </>
  );
  if (p.status && DONE.includes(p.status)) return <><h3>{STATUS_LABEL[p.status]}</h3><p className="small muted">Added to your applications on {fmtDate((p.appliedAt || p.today).slice(0, 10))}.</p>{notice ? <p className="note" style={{ marginTop: 8 }}>{notice}</p> : null}
    <div className="row" style={{ marginTop: 10 }}>
      {["applied", "interview", "offer"].includes(p.status) ? <a className="btn btn-primary btn-sm" href="#interview">{p.status === "applied" ? "Got an interview call?" : "Interview prep"}</a> : null}
      <Link className="btn btn-ghost btn-sm" href="/applications">View applications</Link>
    </div></>;
  if (mode === "notyet") return (
    <>
      <h3>No problem. When should we remind you?</h3>
      <div className="stack" style={{ marginTop: 10, gap: 8 }}>
        <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => act(() => snoozeAction(p.jobId, addDaysTo(p.today, 1)))}>Remind tomorrow</button>
        {dl != null && dl > 2 ? <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => act(() => snoozeAction(p.jobId, addDaysTo(p.today, dl - 2)))}>Remind 2 days before the deadline ({fmtDate(addDaysTo(p.today, dl - 2))})</button> : null}
        <button className="btn btn-ghost btn-sm" onClick={() => setMode("later")}>Choose another date</button>
      </div>
      {err ? <p role="alert" className="err" style={{ marginTop: 10 }}>{err}</p> : null}
    </>
  );
  if (mode === "later") return (
    <>
      <h3>When would you like to apply?</h3>
      <label className="f" htmlFor="remdate" style={{ marginTop: 10 }}>Reminder date<input type="date" id="remdate" value={date} min={p.today} max={p.deadline || undefined} onChange={(e) => setDate(e.target.value)} /></label>
      <p className="small" style={{ marginTop: 8 }}>Deadline: <b>{fmtDate(p.deadline)}</b></p>
      {p.deadline && date > p.deadline ? <p className="small err">This is after the deadline of {fmtDate(p.deadline)}. Choose an earlier date.</p> : null}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => saveReminder(date)}>Set reminder</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setMode("main")}>Cancel</button>
      </div>
      {err ? <p role="alert" className="err" style={{ marginTop: 10 }}>{err}</p> : null}
      <p className="small muted" style={{ marginTop: 10 }}>This saves a reminder only. Your documents are prepared when you press Apply.</p>
    </>
  );
  if (p.status === "waiting" && !p.journey) return (
    <>
      <h3>Did you submit your application?</h3>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => act(() => appliedAction(p.jobId))}>Yes, Applied</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setMode("notyet")}>Not yet</button>
      </div>
      {err ? <p role="alert" className="err" style={{ marginTop: 10 }}>{err}</p> : null}
    </>
  );
  const remind = p.status === "reminder" ? <p className="small" style={{ marginBottom: 10 }}>Reminder: <b>{fmtDate(p.reminderDate)}</b> · Deadline: <b>{fmtDate(p.deadline)}</b></p> : null;
  if (p.hasPack) return (
    <>
      {remind}
      <h3>Your application is ready</h3>
      {!em ? <p className="small muted">Complete and submit the form on the employer’s website. JobPao prepares your documents and tracks your confirmation; it does not automatically fill or submit external forms.</p> : !p.gmailReady ? <p className="small muted">Direct Gmail sending is not configured on this server. Use the Email tab to send the application yourself.</p> : null}
      {gmailNote ? <p className="note" style={{ marginTop: 8 }}>{gmailNote}</p> : null}
      {em ? (
        <div className="stack" style={{ marginTop: 10, gap: 8 }}>
          {!p.gmailReady
            ? <button className="btn btn-ghost" disabled>Gmail setup pending</button>
            : p.gmail
            ? <button className="btn btn-primary" onClick={() => { setErr(""); setMode("send"); }}>Review and send from {p.gmail}</button>
            : <a className="btn btn-primary" href={`/api/gmail/connect?next=${encodeURIComponent(`/jobs/${p.jobId}`)}`}>Connect Gmail to send applications</a>}
          {p.gmailReady ? <p className="small muted">{p.gmail ? "Sends the email with your tailored CV and cover letter attached, from your own Gmail." : "With your permission, JobPao sends each application from your Gmail after you review and press Send application. We can only send, never read your email."}</p> : null}
          <p className="small muted" style={{ marginTop: 4 }}>Or send it yourself:</p>
        </div>
      ) : null}
      <ol className="small" style={{ paddingLeft: 18, margin: "8px 0 0" }}>
        {em ? <><li>Copy the email and send it to <b>{p.applyTarget}</b> from your own email</li><li>Attach your tailored CV and the cover letter if requested (PDF or an accepted Word file)</li><li>Come back and confirm</li></>
          : <><li>Open the application page</li><li>Upload your tailored CV</li><li>Upload the cover letter PDF or paste it into the cover-letter field, as requested</li><li>Submit, then confirm here</li></>}
      </ol>
      <div className="row" style={{ marginTop: 12 }}>
        {p.url && !em
          ? <a className="btn btn-primary btn-sm" href={p.url} target="_blank" rel="noopener noreferrer nofollow" onClick={() => act(() => openedAction(p.jobId))}>{p.continueLabel || "Open employer application"}{p.journey ? " ↗" : ""}</a>
          : <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => act(() => openedAction(p.jobId))}>{em ? "I have sent the email" : "I opened the application"}</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => setMode("later")}>{p.status === "reminder" ? "Change reminder" : p.journey ? "Remind me later" : "Apply later"}</button>
      </div>
      {notice ? <p className="note" style={{ marginTop: 10 }}>{notice}</p> : null}
      {err ? <p role="alert" className="err" style={{ marginTop: 10 }}>{err}</p> : null}
    </>
  );
  if (dl != null && dl < 0) return <><h3>This vacancy has closed</h3><p className="small muted">The deadline was {fmtDate(p.deadline)}.</p></>;
  return (
    <>
      {remind}
      {!p.compact ? <h3>What would you like to do?</h3> : null}
      <div className={p.compact ? "jd-secondary" : "stack"} style={{ marginTop: p.compact ? 0 : 10, gap: 8 }}>
        <button className={`btn btn-ghost${p.compact ? " btn-sm" : ""}`} onClick={() => setMode("later")}>Apply Later</button>
        <button className={`btn btn-text${p.compact ? " btn-sm" : ""}`} disabled={pending} onClick={() => start(async () => { try { await dismissAction(p.jobId); } catch { /* still leave the page */ } router.push("/inbox"); })}>Not interested</button>
      </div>
      {err ? <p role="alert" className="err" style={{ marginTop: 10 }}>{err}</p> : null}
    </>
  );
}
