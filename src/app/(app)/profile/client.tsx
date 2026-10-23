"use client";
import { useState } from "react";
import { ProfileCardTitle } from "@/components/ProfileCardTitle";
import { useRouter } from "next/navigation";
import { addSkillAction, reviewFactAction, setCountryAction, setNeedsVisaAction } from "@/app/actions";
import { CountrySelect } from "@/components/CountrySelect";
import { useSave } from "@/components/useSave";
import { rule } from "@/lib/countries";

export function CountryPanel({ current, needsVisa, homeCountry }: { current: string; needsVisa: boolean; homeCountry: string }) {
  const { pending, err, save } = useSave();
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  return (
    <div className="card panel profile-card profile-country" data-tone="accent"><div className="profile-card-topline"><ProfileCardTitle icon="country">Job-search country</ProfileCardTitle><span className="pill p-neutral">Active search</span></div>
      <p className="small">Subscription country: <b>{rule(homeCountry).name}</b> (fixed). Searching abroad keeps the same subscription.</p>
      <label className="f" htmlFor="countrysel">I am applying for jobs in
        <CountrySelect id="countrysel" value={selected} disabled={pending} label="Target country" first={homeCountry} onChange={setSelected} />
      </label>
      {selected !== current ? <div className="banner warn" style={{ marginTop: 12 }}><div>
        <p>Switching to {rule(selected).name} clears your target roles, cities, salary, work preferences, country-specific CV details. Your improved CV will be adapted to the new country’s format, reference conventions and default style using your saved career information. You will set them up again using that country’s currency and questions. Returning to {rule(current).name} also requires fresh setup.</p>
        <p className="small">Your uploaded CV, verified career facts, Career Safety, Answer Library and previous applications stay saved.</p>
        <button className="btn btn-primary" disabled={pending} onClick={() => save(() => setCountryAction(selected, selected !== homeCountry), () => router.push("/onboarding"))}>Change country and set up again</button>
        <button className="btn btn-text" disabled={pending} onClick={() => setSelected(current)}>Cancel</button>
      </div></div> : null}
      {current !== homeCountry ? <label className="row small" style={{ marginTop: 10, gap: 8, flexWrap: "nowrap" }}><input type="checkbox" checked={needsVisa} disabled={pending} onChange={(e) => { const v = e.target.checked; save(() => setNeedsVisaAction(v)); }} /> I need visa sponsorship</label> : null}
      {err ? <p role="alert" className="err" style={{ marginTop: 8 }}>{err}</p> : null}
      <p className="small muted" style={{ marginTop: 8 }}>One country is active at a time. CV format, salary currency and matching follow your job-search country.</p>
    </div>
  );
}

export function SkillAdder() {
  const [v, setV] = useState("");
  const { pending, err, save } = useSave();
  return (
    <>
    <form className="row" style={{ marginTop: 12, flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); if (!v.trim()) return; save(() => addSkillAction(v), () => setV("")); }}>
      <input type="text" placeholder="Add a skill you have" value={v} onChange={(e) => setV(e.target.value)} maxLength={60} aria-label="Add a skill you have" />
      <button className="btn btn-ghost btn-sm" disabled={pending}>Add</button>
    </form>
    {err ? <p role="alert" className="err small" style={{ marginTop: 6 }}>{err}</p> : null}
    </>
  );
}

export function FactReview({ facts }: { facts: { id: string; kind: string; text: string }[] }) {
  const { pending, err, save } = useSave();
  // Answered items leave the list at once; the page refresh then catches up.
  const [done, setDone] = useState<string[]>([]);
  const answer = (id: string, keep: boolean) => save(() => reviewFactAction(id, keep), () => setDone((d) => [...d, id]));
  const left = facts.filter((f) => !done.includes(f.id));
  if (!left.length) return <p className="small">✓ Thanks, all confirmed.</p>;
  return (
    <>
      {err ? <p role="alert" className="err small">{err}</p> : null}
      {left.map((f) => (
        <div key={f.id} className="qitem">
          <div className="small"><span className="muted">{f.kind}:</span> {f.text}</div>
          <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
            <button className="btn-text small" disabled={pending} onClick={() => answer(f.id, true)}>It&apos;s correct</button>
            <button className="btn-text small" disabled={pending} onClick={() => answer(f.id, false)}>Remove</button>
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

export function GmailPanel({ email, status, ready }: { email: string | null; status: string | null; ready: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const note = status === "connected" ? "Gmail connected." : status === "failed" ? "Gmail could not be connected. Try again." : status === "cancelled" ? "Gmail was not connected." : "";
  return (
    <div className="card panel profile-card" data-tone="accent"><ProfileCardTitle icon="email">Apply from your Gmail</ProfileCardTitle>
      {note ? <p className="note" style={{ marginBottom: 8 }}>{note}</p> : null}
      {!ready ? <>
        <p className="small muted">Gmail sending is awaiting server setup. You can still download your CV and cover letter and send them from your email.</p>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} disabled>Gmail setup pending</button>
      </> : email ? <>
        <p className="small">Connected: <b>{email}</b></p>
        <p className="small muted" style={{ marginTop: 4 }}>When you press Apply on a job that takes email applications, we send it from this address with your tailored CV and cover letter. Nothing is sent without your press. We can only send, never read your email.</p>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} disabled={busy} onClick={async () => { setBusy(true); await fetch("/api/gmail/disconnect", { method: "POST" }); setBusy(false); router.refresh(); }}>Disconnect Gmail</button>
      </> : <>
        <p className="small muted">With your permission, JobPao sends each application from your own Gmail after you review and press Send application. We can only send, never read your email.</p>
        <a className="btn btn-primary btn-sm" style={{ marginTop: 10 }} href="/api/gmail/connect?next=/profile">Connect Gmail</a>
      </>}
    </div>
  );
}
