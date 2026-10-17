"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addDaysTo, daysUntil, fmtDate } from "@/lib/dates";
import { STATUS_LABEL, type AppStatus } from "@/lib/types";
import { Spinner } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { addSkillAction, appliedAction, dismissAction, openedAction, snoozeAction } from "@/app/actions";

export function GapList({ gaps }: { gaps: { t: string; skill: string | null; label: string | null }[] }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<{ skill: string; label: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <ul className="why-list">
        {gaps.map((g) => (
          <li key={g.t}><span className="mk gap">!</span><span>{g.t}{g.skill ? <> <button className="btn-text small" onClick={() => setConfirm({ skill: g.skill!, label: g.label! })}>I have this</button></> : null}</span></li>
        ))}
      </ul>
      {confirm ? (
        <div className="banner" style={{ marginTop: 12 }}>
          <p className="small">Add <b>{confirm.label}</b> to your verified profile? Only add skills you really have; we use them in every application.</p>
          <div className="row">
            <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => start(async () => { await addSkillAction(confirm.skill); setConfirm(null); router.refresh(); })}>Yes, add it</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PackTabs(props: { emphasis: string[]; cv: React.ReactNode; jobId: string; cover: string; subject: string; email: string; to: string | null; checklist: string[] }) {
  const [t, setT] = useState<"cv" | "cover" | "email" | "check">("cv");
  const tabs: [typeof t, string][] = [["cv", "Tailored CV"], ["cover", "Cover letter"], ["email", "Email"], ["check", "Checklist"]];
  return (
    <>
      <div className="tabs" role="tablist" style={{ marginTop: 12 }}>
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={t === k} onClick={() => setT(k)}>{l}</button>)}
      </div>
      <div style={{ marginTop: 14 }}>
        <div hidden={t !== "cv"}>
          {props.emphasis.length ? <div className="note" style={{ marginBottom: 12 }}>{props.emphasis.map((e, i) => <div key={i}>{e}</div>)}</div> : null}
          {props.cv}
          <div className="row" style={{ marginTop: 12 }}>
            <a className="btn btn-ghost btn-sm" href={`/api/cv/download?format=doc&jobId=${props.jobId}`}>Download tailored CV (Word)</a>
            <a className="btn btn-ghost btn-sm" href={`/api/cv/download?format=print&jobId=${props.jobId}`} target="_blank" rel="noopener">Save as PDF</a>
          </div>
        </div>
        {t === "cover" ? <><div className="copybox">{props.cover}</div><div style={{ marginTop: 10 }}><CopyButton text={props.cover} label="Copy cover letter" /></div></> : null}
        {t === "email" ? <>
          <p className="small muted">To: {props.to || "(the employer's address, if they accept email)"}</p>
          <p className="small" style={{ margin: "6px 0" }}><b>Subject:</b> {props.subject}</p>
          <div className="copybox">{props.email}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <CopyButton text={props.subject} label="Copy subject" /><CopyButton text={props.email} label="Copy email" />
            {props.to ? <a className="btn btn-ghost btn-sm" href={`mailto:${encodeURIComponent(props.to)}?subject=${encodeURIComponent(props.subject)}&body=${encodeURIComponent(props.email)}`}>Open in my email app</a> : null}
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>When you send it yourself, attach your tailored CV. Job Switcher never sends anything without your press.</p>
        </> : null}
        {t === "check" ? <ul className="why-list">{props.checklist.map((c) => <li key={c}><span className="mk ok">✓</span><span>{c}</span></li>)}</ul> : null}
      </div>
    </>
  );
}

const DONE: AppStatus[] = ["applied", "interview", "offer", "closed", "withdrawn"];

export function ActionsPanel(p: { jobId: string; status: AppStatus | null; hasPack: boolean; reminderDate: string | null; appliedAt: string | null; deadline: string | null; today: string; applyMethod: string; applyTarget: string | null; url: string | null; notYet: boolean; gmailReady: boolean; gmail: string | null; gmailStatus: string | null }) {
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

  async function prepare() {
    setBusy("Preparing your application"); setErr("");
    const r = await fetch(`/api/applications/${p.jobId}/prepare`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) { setErr(j.error || "Could not prepare the application."); return; }
    if (j.notice) setNotice(j.notice);
    router.refresh();
  }
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

  if (busy) return <><p><Spinner /> {busy}</p>{busy.startsWith("Preparing") ? <p className="small muted" style={{ marginTop: 8 }}>Tailoring your CV and writing a cover letter from your verified profile.</p> : null}</>;
  const gmailNote = p.gmailStatus === "connected" ? "Gmail connected. You can now apply in one tap." : p.gmailStatus === "failed" ? "Gmail could not be connected. Try again." : p.gmailStatus === "cancelled" ? "Gmail was not connected." : "";
  if (mode === "send") return (
    <>
      <h3>Send this application?</h3>
      <ul className="small" style={{ paddingLeft: 18, margin: "8px 0 0" }}>
        <li>To: <b>{p.applyTarget}</b></li>
        <li>From: <b>{p.gmail}</b></li>
        <li>Attached: your tailored CV and cover letter</li>
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
      {err ? <p className="err" style={{ marginTop: 10 }}>{err}</p> : null}
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
      {err ? <p className="err" style={{ marginTop: 10 }}>{err}</p> : null}
      <p className="small muted" style={{ marginTop: 10 }}>We prepare the application now, so it is ready when the reminder arrives.</p>
    </>
  );
  if (p.status === "waiting") return (
    <>
      <h3>Did you submit your application?</h3>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => act(() => appliedAction(p.jobId))}>Yes, Applied</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setMode("notyet")}>Not yet</button>
      </div>
      {err ? <p className="err" style={{ marginTop: 10 }}>{err}</p> : null}
    </>
  );
  const remind = p.status === "reminder" ? <p className="small" style={{ marginBottom: 10 }}>Reminder: <b>{fmtDate(p.reminderDate)}</b> · Deadline: <b>{fmtDate(p.deadline)}</b></p> : null;
  if (p.hasPack) return (
    <>
      {remind}
      <h3>Your application is ready</h3>
      {gmailNote ? <p className="note" style={{ marginTop: 8 }}>{gmailNote}</p> : null}
      {em && p.gmailReady ? (
        <div className="stack" style={{ marginTop: 10, gap: 8 }}>
          {p.gmail
            ? <button className="btn btn-primary" onClick={() => { setErr(""); setMode("send"); }}>Apply now from {p.gmail}</button>
            : <a className="btn btn-primary" href={`/api/gmail/connect?next=${encodeURIComponent(`/jobs/${p.jobId}`)}`}>Connect Gmail to apply in one tap</a>}
          <p className="small muted">{p.gmail ? "Sends the email with your tailored CV and cover letter attached, from your own Gmail." : "With your permission, Job Switcher sends each application from your Gmail when you press Apply. We can only send, never read your email."}</p>
          <p className="small muted" style={{ marginTop: 4 }}>Or send it yourself:</p>
        </div>
      ) : null}
      <ol className="small" style={{ paddingLeft: 18, margin: "8px 0 0" }}>
        {em ? <><li>Copy the email and send it to <b>{p.applyTarget}</b> from your own email</li><li>Attach your tailored CV</li><li>Come back and confirm</li></>
          : <><li>Open the application page</li><li>Upload your tailored CV</li><li>Paste the cover letter and answers</li><li>Submit, then confirm here</li></>}
      </ol>
      <div className="row" style={{ marginTop: 12 }}>
        {p.url && !em
          ? <a className="btn btn-primary btn-sm" href={p.url} target="_blank" rel="noopener noreferrer nofollow" onClick={() => act(() => openedAction(p.jobId))}>Open Application Page</a>
          : <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => act(() => openedAction(p.jobId))}>{em ? "I have sent the email" : "I opened the application"}</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => setMode("later")}>{p.status === "reminder" ? "Change reminder" : "Apply later"}</button>
      </div>
      {notice ? <p className="note" style={{ marginTop: 10 }}>{notice}</p> : null}
      {err ? <p className="err" style={{ marginTop: 10 }}>{err}</p> : null}
    </>
  );
  if (dl != null && dl < 0) return <><h3>This vacancy has closed</h3><p className="small muted">The deadline was {fmtDate(p.deadline)}.</p></>;
  return (
    <>
      {remind}
      <h3>What would you like to do?</h3>
      <div className="stack" style={{ marginTop: 10, gap: 8 }}>
        <button className="btn btn-primary" onClick={prepare}>Prepare Application</button>
        <button className="btn btn-ghost" onClick={() => setMode("later")}>Apply Later</button>
        <button className="btn btn-text" disabled={pending} onClick={() => start(async () => { await dismissAction(p.jobId); router.push("/inbox"); })}>Not interested</button>
      </div>
      {err ? <p className="err" style={{ marginTop: 10 }}>{err}</p> : null}
    </>
  );
}
