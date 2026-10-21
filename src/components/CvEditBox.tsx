"use client";
// "Ask AI to change your CV": the person types one change; the server applies it to their facts and Master CV.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import { MAX_EDIT_CHARS } from "@/lib/cv-edit";

const EXAMPLES = "For example: remove the skill Tally · change my end date at ABC Ltd to March 2024 · update my HSC result to GPA 4.00 · add that I passed ACCA F5";

export function CvEditBox({ aiReady, style }: { aiReady: boolean; style?: React.CSSProperties }) {
  const router = useRouter();
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  async function submit() {
    if (!v.trim() || busy) return;
    setBusy(true); setErr(""); setDone("");
    try {
      const r = await fetch("/api/cv/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction: v.trim() }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Your CV could not be updated. Try again.");
      setDone(j.message || "Your CV was updated.");
      setV("");
      router.refresh();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="card panel" style={style}>
      <h3>Ask AI to change your CV</h3>
      {!aiReady ? <p className="note">AI changes are not set up on this server yet.</p> : (
        <form className="stack" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="f" htmlFor="cvedit">Tell us what to change in your CV
            <textarea id="cvedit" rows={3} value={v} maxLength={MAX_EDIT_CHARS} disabled={busy} placeholder={EXAMPLES} onChange={(e) => setV(e.target.value)} />
          </label>
          <p className="small muted">One change at a time. We only add what you write here; we never invent qualifications or jobs.</p>
          {err ? <p className="err">{err}</p> : null}
          {done ? <p className="small">Done: {done}</p> : null}
          <div className="row"><button className="btn btn-primary" disabled={busy || !v.trim()}>{busy ? <><Spinner /> Updating your CV…</> : "Update my CV"}</button></div>
        </form>
      )}
    </div>
  );
}
