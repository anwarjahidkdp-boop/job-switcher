"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

export function PastePanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", padding: "16px 16px 4px" }}>
        <h2 style={{ fontSize: 20 }}>Your Opportunities</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(!open); setErr(""); }}>{open ? "Close" : "Paste a job"}</button>
      </div>
      {open ? (
        <div style={{ padding: "4px 16px 16px" }} className="stack">
          <p className="small muted">Found a job on Bdjobs, LinkedIn, Facebook, a newspaper or WhatsApp? Paste the full job text and the link. JobPao reads, matches and explains it, and you apply on that site yourself. We never ask for your password.</p>
          <textarea placeholder="Paste the job description here" value={text} onChange={(e) => setText(e.target.value)} />
          <input type="url" placeholder="Job link (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
          {err ? <p className="err">{err}</p> : null}
          <div className="row">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={async () => {
              if (text.trim().length < 120) { setErr("Paste the full job description (at least a few lines)."); return; }
              setBusy(true); setErr("");
              const r = await fetch("/api/jobs/paste", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, url }) });
              const j = await r.json().catch(() => ({}));
              setBusy(false);
              if (!r.ok) { setErr(j.error || "Could not read this job."); return; }
              router.push(`/jobs/${j.id}`);
            }}>{busy ? <><Spinner /> Reading the job</> : "Analyse this job"}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
