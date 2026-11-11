"use client";
// "Strengthen my CV": the questions a professional CV writer asks about results, one at a time, then the answers
// are written into the CV. Shown where people look at their CV (CV ready step, Profile) for UK searches.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "./ui";
import { answerChoices } from "@/app/onboarding/QuestionsForm";
import { patientPost } from "@/lib/patient-post";
import type { CvQuestion } from "@/lib/types";
import styles from "./CvBoost.module.css";

export interface CvBoostProps { asked: CvQuestion[]; answered: number; results: number; aiReady: boolean; startOpen?: boolean }

const resultsLine = (n: number) => n === 0 ? "Right now your CV shows no results with numbers." : `Right now your CV shows ${n} result${n === 1 ? "" : "s"} with numbers.`;

export function CvBoost(p: CvBoostProps) {
  const router = useRouter();
  const [qs, setQs] = useState<CvQuestion[]>(p.asked);
  const [open, setOpen] = useState(!!p.startOpen && p.asked.length > 0);
  const [i, setI] = useState(0);
  const [a, setA] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"" | "ask" | "apply">("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string>("");

  async function start() {
    setErr(""); setDone("");
    if (qs.length) { setOpen(true); setI(0); return; }
    setBusy("ask"); setMsg("");
    try {
      const r = await patientPost("/api/cv/boost", { action: "ask" }, setMsg) as { questions: CvQuestion[] };
      setQs(r.questions); setI(0); setOpen(true);
    } catch (e) { setErr((e as Error).message); }
    setBusy("");
  }
  async function apply() {
    setBusy("apply"); setErr(""); setMsg("");
    try {
      const r = await patientPost("/api/cv/boost", { action: "apply", answers: a }, setMsg) as { changed: number; answered: number };
      setOpen(false); setQs([]); setA({});
      setDone(r.changed ? "Done. Your results are now in your CV, with the strongest one first in each job." : "Thanks. Your answers are saved and will be used next time your CV is rewritten.");
      router.refresh();
    } catch (e) { setErr((e as Error).message); }
    setBusy("");
  }

  const q = qs[i];
  const filled = qs.filter((x) => (a[x.id] || "").trim()).length;
  const last = i === qs.length - 1;

  if (open && q) {
    const choices = answerChoices(q);
    return <section className={styles.card} aria-label="Strengthen my CV">
      <div className={styles.top}><span className={styles.kicker}>Strengthen my CV</span><span className={styles.step}>Question {i + 1} of {qs.length}</span></div>
      <div className={styles.bar} aria-hidden><span style={{ width: `${((i + 1) / qs.length) * 100}%` }} /></div>
      <form onSubmit={(e) => { e.preventDefault(); if (last) void apply(); else setI(i + 1); }}>
        <label className={styles.q} htmlFor={`boost_${q.id}`}>{q.question}</label>
        <input id={`boost_${q.id}`} className={styles.input} value={a[q.id] || ""} onChange={(e) => setA({ ...a, [q.id]: e.target.value })} placeholder={q.placeholder || "Your answer"} maxLength={600} autoComplete="off" />
        {choices.length ? <div className="q-chips" aria-label="Suggested answers">{choices.map((c) => <button key={c} type="button" className={`q-chip${(a[q.id] || "") === c ? " on" : ""}`} onClick={() => setA({ ...a, [q.id]: c })}>{c}</button>)}</div> : null}
        <p className={styles.help}>A rough figure is fine (&quot;about 20&quot;). Only write what you could explain at an interview. Not sure? Leave it blank.</p>
        {busy === "apply" ? <p className="small" role="status"><Spinner /> {msg || "Writing your results into your CV…"}</p> : null}
        {err ? <p className="err small" role="alert">{err}</p> : null}
        <div className={styles.row}>
          {i > 0 ? <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => setI(i - 1)}>← Back</button> : null}
          <button className="btn btn-primary btn-sm" disabled={!!busy || (last && !filled)}>{last ? (busy === "apply" ? <><Spinner /> Updating</> : "Update my CV") : "Next →"}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => setOpen(false)}>Not now</button>
        </div>
      </form>
    </section>;
  }

  if (p.answered > 0 && !qs.length) {
    return <section className={`${styles.card} ${styles.slim}`} aria-label="Strengthen my CV">
      <p className={styles.doneLine}><span className={styles.tick} aria-hidden>✓</span>{done || `Your CV now shows ${p.results} result${p.results === 1 ? "" : "s"} with numbers. Recruiters notice these first.`}</p>
      <button type="button" className="btn btn-ghost btn-sm" disabled={!p.aiReady || !!busy} onClick={start}>{busy === "ask" ? <><Spinner /> {msg || "Preparing questions…"}</> : "Add more results"}</button>
      {err ? <p className="err small" role="alert">{err}</p> : null}
    </section>;
  }

  return <section className={styles.card} aria-label="Strengthen my CV">
    <span className={styles.kicker}>Strengthen my CV · like a professional CV writer</span>
    <h3 className={styles.title}>Add the numbers UK recruiters look for</h3>
    <p className={styles.lead}>Recruiters shortlist CVs that show results: how many people, how much, how fast. {resultsLine(p.results)} Answer a few quick questions about your recent jobs and we write your answers into your CV, with the strongest result first.</p>
    <ul className={styles.points}><li>About 3 minutes</li><li>{qs.length ? `${qs.length} question${qs.length === 1 ? "" : "s"} waiting` : "4 to 6 short questions"}</li><li>Nothing added that you did not tell us</li></ul>
    {done ? <p className={styles.doneLine}><span className={styles.tick} aria-hidden>✓</span>{done}</p> : null}
    {err ? <p className="err small" role="alert">{err}</p> : null}
    <div className={styles.row}>
      <button type="button" className="btn btn-gold" disabled={!p.aiReady || !!busy} onClick={start}>{busy === "ask" ? <><Spinner /> {msg || "Reading your CV…"}</> : qs.length ? "Continue →" : "Strengthen my CV →"}</button>
      {!p.aiReady ? <span className="small muted">Available while your trial or plan is active.</span> : null}
    </div>
  </section>;
}
