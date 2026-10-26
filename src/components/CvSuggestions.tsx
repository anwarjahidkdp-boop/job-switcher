"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import type { CvSuggestion } from "@/lib/types";
import { patientPost } from "@/lib/patient-post";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error || "We could not save that. Please try again.");
  return j;
}

/** Changes the CV writer recommends but leaves to the person: pick an option to apply it, or keep the line. */
/** With `toggle`, a button opens the list in place (used right under "Your CV is ready"). */
export function CvSuggestions({ items, toggle }: { items: CvSuggestion[]; toggle?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!toggle);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  if (!items.length) return null;
  const act = async (id: string, option: number | null) => {
    setBusy(id); setErr("");
    try { await post("/api/cv/suggestion", { id, option }); router.refresh(); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  };
  const btn = toggle ? <button type="button" className="sugg-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}><span><b>Recommended changes for your CV</b><span className="small">{items.length} {items.length === 1 ? "change needs" : "changes need"} your choice</span></span><span className="sugg-toggle-n">{items.length}</span><span aria-hidden="true" className="sugg-toggle-go">{open ? "Hide ▲" : "Review ▼"}</span></button> : null;
  if (!open) return btn;
  return (
    <>{btn}
    <div className="card panel sugg" style={{ marginTop: 12 }}>
      <h3 style={{ margin: 0 }}>Recommended changes <span className="imp-n">{items.length}</span></h3>
      <p className="small muted" style={{ margin: "4px 0 10px" }}>These could change a status or meaning, so we only change them when you choose.</p>
      {items.map((s) => (
        <div key={s.id} className="sugg-item" aria-busy={busy === s.id}>
          <p className="eyebrow" style={{ margin: 0 }}>{s.section}</p>
          {s.reason ? <p className="small" style={{ margin: "2px 0 6px" }}>{s.reason}</p> : null}
          <p className="sugg-cur"><span className="small muted">Now: </span><s>{s.current}</s></p>
          <div className="sugg-opts">
            {s.options.map((o, i) => (
              <button key={i} type="button" className="sugg-opt" disabled={!!busy} onClick={() => act(s.id, i)}><span className="small muted">Use: </span>{o}</button>
            ))}
            <button type="button" className="btn btn-text btn-sm" disabled={!!busy} onClick={() => act(s.id, null)}>Keep as it is</button>
          </div>
          {busy === s.id ? <p className="small"><Spinner /> Updating your CV</p> : null}
        </div>
      ))}
      {err ? <p role="alert" className="err">{err}</p> : null}
    </div>
    </>
  );
}

/** Rewrites the whole Master CV again in corporate style from the original CV, keeping every change the person made. */
export function PolishCvButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        try { await patientPost("/api/cv/build", {}); router.refresh(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
      }}>{busy ? <><Spinner /> Rewriting every line</> : "Rewrite in corporate style"}</button>
      {err ? <span className="err small">{err}</span> : null}
    </>
  );
}
