"use client";
import { useState } from "react";
import { Spinner } from "@/components/ui";

/** Sends the Gmail steps to the person's email, to finish on a computer. */
export function EmailGuideButton({ site }: { site: string }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const [err, setErr] = useState("");
  if (sent) return <p className="small" role="status" style={{ margin: "6px 0 0" }}>✓ Sent to <b>{sent}</b>. Open it on a computer and follow it; this page updates by itself.</p>;
  return (
    <div style={{ marginTop: 6 }}>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        try {
          const r = await fetch("/api/setup/email-guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j.to) throw new Error(j.error || "Could not send the email.");
          setSent(j.to);
        } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
      }}>{busy ? <><Spinner /> Sending</> : "Email me these steps"}</button>
      {err ? <p role="alert" className="err small" style={{ marginTop: 6 }}>{err}</p> : null}
    </div>
  );
}
