"use client";
import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { offerAdvice, type SalaryFacts } from "@/lib/interview/salary";
import type { Job } from "@/lib/types";

/** Offer received: what to ask for and a ready reply, worked out in the browser from the figure the person types. */
export function OfferPanel(p: { job: Pick<Job, "title" | "company" | "country" | "salaryMin" | "salaryMax">; facts: SalaryFacts; name: string; sym: string; per: string }) {
  const [v, setV] = useState("");
  const offered = Number(v.replace(/[^\d.]/g, ""));
  const a = offered > 0 ? offerAdvice(p.job, p.facts, offered, p.name) : null;
  return (
    <div className="card panel" id="offer">
      <p className="eyebrow">Offer received · {p.job.company}</p>
      <h2 style={{ fontSize: 19, marginTop: 4 }}>Negotiate your salary</h2>
      <p className="small muted" style={{ marginTop: 4 }}>Type the salary they offered. We compare it with the advertised range and your expected salary, then write a polite reply you can send.</p>
      <label className="f" style={{ marginTop: 10, maxWidth: 280 }}>Offered salary ({p.sym.trim()} {p.per})
        <input type="text" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. 60000" />
      </label>
      {a ? (
        <>
          <p className="note" style={{ marginTop: 12 }}><b>{a.verdict}</b></p>
          <ul className="why-list" style={{ marginTop: 8 }}>{a.tips.map((t) => <li key={t}><span className="mk ok">✓</span><span>{t}</span></li>)}</ul>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}><h3>Reply to the employer</h3><CopyButton text={`Subject: ${a.email.subject}\n\n${a.email.body}`} label="Copy reply" /></div>
          <div className="copybox" style={{ marginTop: 8 }}>{`Subject: ${a.email.subject}\n\n${a.email.body}`}</div>
        </>
      ) : null}
    </div>
  );
}
