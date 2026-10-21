"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSkillAction, reviewFactAction, setCountryAction, setHomeCountryAction, setNeedsVisaAction } from "@/app/actions";
import { CountrySelect } from "@/components/CountrySelect";
import { rule } from "@/lib/countries";

export function CountryPanel({ current, needsVisa, homeCountry }: { current: string; needsVisa: boolean; homeCountry: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="card panel"><h3>Target country</h3>
      <label className="f" htmlFor="countrysel">I am applying for jobs in
        <CountrySelect id="countrysel" value={current} disabled={pending} label="Target country" first={homeCountry} onChange={(c) => { start(async () => { await setCountryAction(c, needsVisa); setMsg(`Now applying in ${rule(c).name}. CV format, currency and matches updated.`); router.refresh(); }); }} />
      </label>
      <label className="f" htmlFor="homesel" style={{ marginTop: 10 }}>I live in
        <CountrySelect id="homesel" value={homeCountry} disabled={pending} label="Country you live in" first={homeCountry} onChange={(c) => { start(async () => { await setHomeCountryAction(c); setMsg("Saved. Visa needs, your Pro price and how you pay follow the country you live in."); router.refresh(); }); }} />
      </label>
      {current !== homeCountry ? <label className="row small" style={{ marginTop: 10, gap: 8, flexWrap: "nowrap" }}><input type="checkbox" checked={needsVisa} disabled={pending} onChange={(e) => { const v = e.target.checked; start(async () => { await setNeedsVisaAction(v); router.refresh(); }); }} /> I need visa sponsorship</label> : null}
      <p className="small muted" style={{ marginTop: 8 }}>{msg || "Changing it reformats your CV, switches the salary currency and checklist, and shows jobs in that country."}</p>
    </div>
  );
}

export function SkillAdder() {
  const router = useRouter();
  const [v, setV] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="row" style={{ marginTop: 12, flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); if (!v.trim()) return; start(async () => { await addSkillAction(v); setV(""); router.refresh(); }); }}>
      <input type="text" placeholder="Add a skill you have" value={v} onChange={(e) => setV(e.target.value)} maxLength={60} aria-label="Add a skill you have" />
      <button className="btn btn-ghost btn-sm" disabled={pending}>Add</button>
    </form>
  );
}

export function FactReview({ facts }: { facts: { id: string; kind: string; text: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <>
      {facts.map((f) => (
        <div key={f.id} className="qitem">
          <div className="small"><span className="muted">{f.kind}:</span> {f.text}</div>
          <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
            <button className="btn-text small" disabled={pending} onClick={() => start(async () => { await reviewFactAction(f.id, true); router.refresh(); })}>It&apos;s correct</button>
            <button className="btn-text small" disabled={pending} onClick={() => start(async () => { await reviewFactAction(f.id, false); router.refresh(); })}>Remove</button>
          </div>
        </div>
      ))}
    </>
  );
}

export function DangerZone() {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  if (!confirm) return <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setConfirm(true)}>Delete my data and account</button>;
  return (
    <div className="banner warn" style={{ marginTop: 10 }}>
      <p className="small">This permanently deletes your CVs, photo, profile, applications and forwarded emails. It cannot be undone.</p>
      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={async () => { setBusy(true); const r = await fetch("/api/account/delete", { method: "POST" }); if (r.ok) { router.replace("/"); router.refresh(); } else setBusy(false); }}>Yes, delete everything</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>Cancel</button>
      </div>
    </div>
  );
}

export function GmailPanel({ email, status }: { email: string | null; status: string | null }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const note = status === "connected" ? "Gmail connected." : status === "failed" ? "Gmail could not be connected. Try again." : status === "cancelled" ? "Gmail was not connected." : "";
  return (
    <div className="card panel"><h3>Apply from your Gmail</h3>
      {note ? <p className="note" style={{ marginBottom: 8 }}>{note}</p> : null}
      {email ? <>
        <p className="small">Connected: <b>{email}</b></p>
        <p className="small muted" style={{ marginTop: 4 }}>When you press Apply on a job that takes email applications, we send it from this address with your tailored CV and cover letter. Nothing is sent without your press. We can only send, never read your email.</p>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} disabled={busy} onClick={async () => { setBusy(true); await fetch("/api/gmail/disconnect", { method: "POST" }); setBusy(false); router.refresh(); }}>Disconnect Gmail</button>
      </> : <>
        <p className="small muted">With your permission, JobPao sends each application from your own Gmail when you press Apply. We can only send, never read your email.</p>
        <a className="btn btn-primary btn-sm" style={{ marginTop: 10 }} href="/api/gmail/connect?next=/profile">Connect Gmail</a>
      </>}
    </div>
  );
}
