"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import type { CvQuestion } from "@/lib/types";
import { patientPost } from "@/lib/patient-post";

/** Tap-to-fill answers: the question's own suggestions, else the examples in its placeholder ("e.g. A / B"). */
export function answerChoices(q: CvQuestion): string[] {
  if (q.suggestions?.length) return q.suggestions.slice(0, 4);
  const p = q.placeholder.replace(/^e\.g\.?\s*/i, "").trim();
  if (!p || /leave blank|skip/i.test(p)) return [];
  return p.split(/\s+\/\s+|;\s+/).map((x) => x.trim()).filter((x) => x && x.length <= 60).slice(0, 3);
}

/** Setup questions. Answers are kept on this device until saved, so a failed save or a reload never loses them. */
export function QuestionsForm({ docId, questions, saved }: { docId: string; questions: CvQuestion[]; saved: Record<string, string> }) {
  const router = useRouter();
  const key = `jp_answers_${docId}`;
  const [a, setA] = useState<Record<string, string>>(saved);
  const [busy, setBusy] = useState<"" | "save" | "skip">("");
  const [err, setErr] = useState("");
  const [index,setIndex] = useState(0);
  const current=questions[index];
  const [msg, setMsg] = useState("");
  useEffect(() => {
    // Restore a draft typed earlier on this device (localStorage is not available during the server render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const d = JSON.parse(localStorage.getItem(key) || "null"); if (d && typeof d === "object") setA((x) => ({ ...x, ...d })); } catch {}
  }, [key]);
  const set = (id: string, v: string) => setA((x) => {
    const n = { ...x, [id]: v };
    try { localStorage.setItem(key, JSON.stringify(n)); } catch {}
    return n;
  });
  async function send(skip: boolean) {
    setBusy(skip ? "skip" : "save"); setErr(""); setMsg(skip ? "" : "AI is reading your answers…");
    try {
      await patientPost("/api/onboarding/answers", { answers: a, skip }, setMsg);
      try { localStorage.removeItem(key); } catch {}
      router.refresh();
    } catch (e) {
      setErr(`${(e as Error).message} Your answers are kept on this device.`);
      setBusy("");
    }
  }
  return (
    <>
      <div className="q-skipbar"><span>Only missing CV details appear here. Each answer is optional; your search answers are already saved.</span><button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => send(true)}>Skip questions →</button></div>
      <form onSubmit={(e) => { e.preventDefault(); if(index<questions.length-1){setIndex(i=>i+1);}else void send(false); }}>
        <div className="stack" style={{ marginTop: 14 }}>
          {current ? <p className="small muted" role="status">CV detail {index+1} of {questions.length}</p>:<p>Your CV needs no extra answers. Continue to review your saved setup.</p>}
          {(current?[current]:[]).map((q) => {
            const choices = answerChoices(q);
            return (
              <div key={q.id} className={`card panel${q.id.startsWith("fresh_") ? " q-fresh" : ""}`}>
                {q.id.startsWith("fresh_") ? <span className="q-fresh-k">Please check: your CV may be out of date</span> : null}
                <label className="f" htmlFor={`a_${q.id}`}>{q.question}<input type="text" id={`a_${q.id}`} value={a[q.id] || ""} onChange={(e) => set(q.id, e.target.value)} placeholder={q.placeholder || ""} maxLength={1000} /></label>
                <p className="small muted"><b>Why this helps:</b> {q.id.startsWith("fresh_") ? "Your answer can correct outdated roles or dates before we prepare your CV." : "Your answer adds a missing detail to your CV; include only facts you can confirm."} <b>If skipped:</b> we leave unconfirmed information out rather than inventing it.</p>
                {choices.length ? <div className="q-chips" aria-label="Suggested answers">{choices.map((c) => <button key={c} type="button" className={`q-chip${(a[q.id] || "") === c ? " on" : ""}`} onClick={() => { set(q.id, c); if (/\s$/.test(c)) document.getElementById(`a_${q.id}`)?.focus(); }}>{c.trim()}{/\s$/.test(c) ? " …" : ""}</button>)}</div> : null}
              </div>
            );
          })}
        </div>
        {busy && msg ? <p style={{ marginTop: 16 }} role="status"><Spinner /> {msg}</p> : null}
        {err ? <p role="alert" className="err" style={{ marginTop: 14 }}>{err}</p> : null}
        <div className="row" style={{ marginTop: 20 }}>
          {index>0?<button type="button" className="btn btn-ghost" disabled={!!busy} onClick={()=>setIndex(i=>i-1)}>← Back</button>:null}
          <button className="btn btn-primary" disabled={!!busy}>{busy === "save" ? <><Spinner /> Saving</> : index<questions.length-1 ? "Next detail →" : "Review my saved setup →"}</button>
          <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => send(true)}>{busy === "skip" ? <><Spinner /> Skipping</> : "Skip questions"}</button>
        </div>
      </form>
    </>
  );
}
