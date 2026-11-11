"use client";
// UK application writing on the job page: the supporting statement (NHS, Civil Service, councils, schools) and
// answers to the employer's own form questions, both written from the CV used for this application.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "./CopyButton";
import { Spinner } from "./ui";
import { patientPost } from "@/lib/patient-post";
import type { FormAnswer, UkStatement } from "@/lib/types";
import styles from "./UKWritingPanel.module.css";

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const MARK = { met: ["✓", "Shown in your CV"], partly: ["~", "Related experience only"], gap: ["!", "Not in your CV: fill the [brackets] or leave it out"] } as const;

export function UKWritingPanel(p: { jobId: string; likely: boolean; statement: UkStatement | null; answers: FormAnswer[]; aiReady: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "statement" | "answer">("");
  const [wait, setWait] = useState("");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState("");

  async function run(kind: "statement" | "answer") {
    if (kind === "answer" && !q.trim()) { setErr("Paste the question from the application form first."); return; }
    setBusy(kind); setErr(""); setWait("");
    try {
      if (kind === "statement") await patientPost(`/api/applications/${p.jobId}/statement`, {}, setWait);
      else { await patientPost(`/api/applications/${p.jobId}/form-answer`, { question: q, words: limit ? Number(limit) : null }, setWait); setQ(""); setLimit(""); }
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong. Try again."); }
    setBusy(""); setWait("");
  }

  const s = p.statement;
  return <div className={styles.panel}>
    <section className={styles.wblock} id="uk-statement">
      <div className={styles.head}><h4>Supporting statement</h4>{p.likely ? <span className={styles.tag}>Usually required</span> : null}</div>
      <p className={styles.lead}>{p.likely
        ? "This employer usually shortlists on a supporting statement scored against the person specification. We write it criterion by criterion, with examples from your CV."
        : "If the application form has a box for a supporting or personal statement, we can write it against the advert's requirements, with examples from your CV."}</p>
      {busy === "statement" ? <p className="small"><Spinner /> {wait || "Reading the person specification and your CV…"}</p> : s ? <>
        <div className={styles.text}>{s.statement}</div>
        <div className={styles.tools}><span className="small muted">{words(s.statement)} words</span><CopyButton text={s.statement} label="Copy statement" /><button type="button" className="btn btn-ghost btn-sm" disabled={!p.aiReady} onClick={() => run("statement")}>Write again</button></div>
        {s.criteria.length ? <><h5 className={styles.sub}>Criteria covered</h5><ul className={styles.criteria}>{s.criteria.map((c) => <li key={c.criterion} data-status={c.status}><span aria-hidden>{MARK[c.status]?.[0] || "•"}</span><span><b>{c.criterion}</b><small>{c.evidence || MARK[c.status]?.[1]}</small></span></li>)}</ul></> : null}
        <p className="small muted">Replace every [bracket] with a real example of your own, or remove it. Never submit anything you cannot back up at interview.</p>
      </> : <button type="button" className="btn btn-primary btn-sm" disabled={!p.aiReady} onClick={() => run("statement")}>Write my supporting statement</button>}
    </section>

    <section className={styles.wblock} id="uk-form-answers">
      <div className={styles.head}><h4>Questions on the application form</h4></div>
      <p className={styles.lead}>Paste a question from the employer&apos;s form (for example &quot;Tell us about a time you dealt with a difficult customer&quot;). We answer it in the STAR style UK employers score, using your CV.</p>
      <label className={styles.label} htmlFor={`fq-${p.jobId}`}>Question</label>
      <textarea id={`fq-${p.jobId}`} className={styles.input} rows={3} maxLength={1200} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Paste the question here" />
      <div className={styles.row}>
        <label className={styles.label} htmlFor={`fl-${p.jobId}`}>Word limit (optional)</label>
        <input id={`fl-${p.jobId}`} className={styles.limit} inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="e.g. 250" />
        <button type="button" className="btn btn-primary btn-sm" disabled={!p.aiReady || busy !== ""} onClick={() => run("answer")}>{busy === "answer" ? <><Spinner /> {wait || "Writing your answer…"}</> : "Write my answer"}</button>
      </div>
      {p.answers.length ? <ol className={styles.answers}>{p.answers.map((a) => <li key={a.at}><b>{a.question}</b><div className={styles.text}>{a.answer}</div><div className={styles.tools}><span className="small muted">{words(a.answer)} words{a.limit ? ` · limit ${a.limit}` : ""}</span><CopyButton text={a.answer} label="Copy answer" /></div></li>)}</ol> : null}
    </section>
    {!p.aiReady ? <p className="note small">Your free trial has ended. Subscribe to write supporting statements and form answers with AI.</p> : null}
    {err ? <p className="note small" role="alert" style={{ borderColor: "var(--warn)" }}>{err}</p> : null}
  </div>;
}
