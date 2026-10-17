"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import type { InterviewPrep, InterviewTopic } from "@/lib/types";

type Mode = "in_person" | "phone" | "video";
const MODES: [Mode, string, string][] = [["in_person", "In person", "Address"], ["phone", "Phone", "Phone number (optional)"], ["video", "Video call", "Meeting link"]];
const TOPIC: Record<InterviewTopic, string> = { about_you: "About you", role: "The role", technical: "Skills", behavioural: "Experience", company: "Motivation", salary: "Salary" };

const pad = (n: number) => String(n).padStart(2, "0");
function localParts(iso: string) {
  const d = new Date(iso);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
function when(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const t = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  const rel = days === 0 ? "Today" : days === 1 ? "Tomorrow" : days > 1 ? `In ${days} days` : "Done";
  return { label: `${day}, ${t}`, rel, past: days < 0 };
}

export function InterviewPanel(p: { jobId: string; company: string; at: string | null; mode: Mode | null; where: string | null; notes: string | null; prep: InterviewPrep | null; prepAi: boolean; aiReady: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [f, setF] = useState({ date: "", time: "10:00", mode: "in_person" as Mode, where: p.where || "", notes: p.notes || "" });
  // Shown in the viewer's own time zone, so it is rendered only in the browser.
  const inBrowser = useSyncExternalStore(() => () => {}, () => true, () => false);
  const shown = inBrowser && p.at ? when(p.at) : null;

  function open() {
    const lp = p.at ? localParts(p.at) : { date: "", time: "10:00" };
    setF({ date: lp.date, time: lp.time, mode: p.mode || "in_person", where: p.where || "", notes: p.notes || "" });
    setErr(""); setEditing(true);
  }
  async function save() {
    if (!f.date) { setErr("Choose the interview date."); return; }
    setBusy("Saving"); setErr("");
    const r = await fetch(`/api/applications/${p.jobId}/interview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, tzOffsetMin: new Date(`${f.date}T${f.time || "09:00"}`).getTimezoneOffset() }) });
    const j = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) { setErr(j.error || "Could not save the interview."); return; }
    setEditing(false);
    router.refresh();
  }
  async function prepare() {
    setBusy("Preparing your interview questions"); setErr(""); setNotice("");
    const r = await fetch(`/api/applications/${p.jobId}/interview/prep`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) { setErr(j.error || "Could not prepare the interview."); return; }
    if (j.notice) setNotice(j.notice);
    router.refresh();
  }

  const label = MODES.find((m) => m[0] === f.mode)![2];
  if (editing) return (
    <div className="card panel" id="interview">
      <h2 style={{ fontSize: 19 }}>Interview details</h2>
      <div className="ivform">
        <label className="f">Date<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label className="f">Time<input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label>
        <label className="f">How<select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as Mode })}>{MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="f">{label}<input value={f.where} maxLength={300} onChange={(e) => setF({ ...f, where: e.target.value })} placeholder={f.mode === "video" ? "https://…" : ""} /></label>
      </div>
      <label className="f" style={{ marginTop: 10 }}>Notes (who called, what to bring)<textarea rows={3} maxLength={2000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={save}>{busy ? <Spinner /> : null} Save interview</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
      </div>
      {err ? <p className="err" style={{ marginTop: 10 }}>{err}</p> : null}
    </div>
  );

  if (!p.at) return (
    <div className="card panel ivcall" id="interview">
      <div>
        <h2 style={{ fontSize: 19 }}>Got an interview call?</h2>
        <p className="small muted" style={{ marginTop: 4 }}>Add it here. We keep track of it and prepare you: likely questions for this job, sample answers from your own CV, and a checklist.</p>
      </div>
      <button className="btn btn-primary btn-sm" onClick={open}>Add interview call</button>
    </div>
  );

  const href = p.where && /^https?:\/\//i.test(p.where) ? p.where : null;
  return (
    <div className="card panel" id="interview">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap" }}>
        <div>
          <p className="eyebrow">Interview · {p.company}</p>
          <h2 style={{ fontSize: 19, marginTop: 4 }}>{shown?.label ?? "\u00a0"}</h2>
          <p className="small muted" style={{ marginTop: 6 }}>
            {shown ? <><span className={`pill ${shown.past ? "p-lo" : "p-st"}`}>{shown.rel}</span>{" "}</> : null}
            {MODES.find((m) => m[0] === p.mode)?.[1] || "Interview"}
            {p.where ? <> · {href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow">Join link ↗</a> : p.where}</> : null}
          </p>
        </div>
        <button className="btn btn-text small" onClick={open}>Edit</button>
      </div>
      {p.notes ? <p className="note" style={{ marginTop: 10 }}>{p.notes}</p> : null}

      <div className="ivprep">
        {busy ? <p><Spinner /> {busy}</p> : !p.prep ? (
          <>
            <h3>Prepare for this interview</h3>
            <p className="small muted" style={{ marginTop: 4 }}>We read the job description and your CV, then list the questions you are likely to get, with sample answers you can practise.</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={prepare}>Prepare me for this interview</button>
          </>
        ) : (
          <>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3>Likely questions ({p.prep.questions.length})</h3>
              <span className="small muted">{p.prepAi ? "Prepared with Claude from this job and your CV" : "Standard preparation"}</span>
            </div>
            <p className="small muted" style={{ marginTop: 4 }}>Answers use only what is in your CV. Replace anything in [brackets] with your own real example, then practise out loud.</p>
            <div className="ivqs">
              {p.prep.questions.map((q, i) => (
                <details key={i} className="ivq" open={i === 0}>
                  <summary><span className="ivtopic">{TOPIC[q.topic] || "Question"}</span><span>{q.question}</span></summary>
                  <p className="small muted" style={{ marginTop: 8 }}><b>Why they ask:</b> {q.why}</p>
                  <div className="copybox" style={{ marginTop: 8 }}>{q.answer}</div>
                </details>
              ))}
            </div>
            {p.prep.ask_them.length ? <><h3 style={{ marginTop: 16 }}>Questions you can ask them</h3><ul className="why-list">{p.prep.ask_them.map((x) => <li key={x}><span className="mk ok">?</span><span>{x}</span></li>)}</ul></> : null}
            {p.prep.checklist.length ? <><h3 style={{ marginTop: 16 }}>Before the interview</h3><ul className="why-list">{p.prep.checklist.map((x) => <li key={x}><span className="mk ok">✓</span><span>{x}</span></li>)}</ul></> : null}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={prepare}>{p.aiReady && !p.prepAi ? "Prepare again with Claude" : "Prepare again"}</button>
          </>
        )}
        {notice ? <p className="note" style={{ marginTop: 10 }}>{notice}</p> : null}
        {err ? <p className="err" style={{ marginTop: 10 }}>{err}</p> : null}
      </div>
    </div>
  );
}
