"use client";
import { useState } from "react";
import { useSave } from "@/components/useSave";
import { Spinner } from "@/components/ui";
import { markLinkedinUpdatedAction, saveLinkedinAction } from "@/app/actions";
import { linkedinUrl } from "@/lib/linkedin";

export function LinkedinConnect({ url }: { url: string | null }) {
  const { pending, err, save } = useSave();
  const [v, setV] = useState(url || "");
  const [edit, setEdit] = useState(!url);
  const [bad, setBad] = useState("");
  if (!edit && url) return (
    <p className="small" style={{ marginTop: 10 }}>
      <a href={url} target="_blank" rel="noopener noreferrer">{url.replace(/^https:\/\/www\./, "")} ↗</a>{" "}
      <button type="button" className="btn btn-text btn-sm" onClick={() => setEdit(true)}>Change</button>
    </p>
  );
  return (
    <form className="row" style={{ marginTop: 10, gap: 8 }} onSubmit={(e) => {
      e.preventDefault();
      if (!linkedinUrl(v)) { setBad("Enter your LinkedIn profile link, like linkedin.com/in/your-name."); return; }
      setBad("");
      save(() => saveLinkedinAction(v), () => setEdit(false));
    }}>
      <input type="text" inputMode="url" autoComplete="url" aria-label="LinkedIn profile link" value={v} onChange={(e) => setV(e.target.value)} placeholder="linkedin.com/in/your-name" style={{ flex: "1 1 240px", minWidth: 0 }} />
      <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? <Spinner /> : null} Connect LinkedIn</button>
      {bad || err ? <p role="alert" className="err" style={{ flexBasis: "100%" }}>{bad || err}</p> : null}
    </form>
  );
}

export function LinkedinDone({ done }: { done: boolean }) {
  const { pending, err, save } = useSave();
  return (
    <section className="card panel li-done" aria-live="polite">
      {done ? <p><b>✓ LinkedIn updated.</b> <span className="small muted">Update it again whenever your CV changes.</span></p> : <p className="small muted">Pasted everything into LinkedIn?</p>}
      <button type="button" className={`btn btn-sm ${done ? "btn-ghost" : "btn-primary"}`} disabled={pending} onClick={() => save(() => markLinkedinUpdatedAction(!done))}>
        {pending ? <Spinner /> : null} {done ? "Mark as not done" : "I’ve updated my LinkedIn"}
      </button>
      {err ? <p role="alert" className="err">{err}</p> : null}
    </section>
  );
}
