"use client";
import { useState } from "react";
import { Spinner } from "@/components/ui";

interface Row { s: string; label: string; n: number; v: number; pct: number; impact: { before: number; after: number; where: string[] } | null }

export function SkillRows({ rows, aiReady }: { rows: Row[]; aiReady: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [plan, setPlan] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <>
      {rows.map((r) => (
        <div key={r.s}>
          <div className={`skbar ${r.v < 1 ? "no" : ""}`}>
            <span>{r.label}</span><div className="bar"><i style={{ width: `${r.pct}%` }} /></div><b className="num small">{r.n}</b>
            <span className="small" style={{ color: r.v === 1 ? "var(--good)" : r.v > 0 ? "var(--warn)" : "var(--bad)" }}>
              {r.v === 1 ? "✓ In profile" : r.v > 0 ? "⚠ Not confirmed" : "✕ Missing"}
              {r.v < 1 ? <> <button className="btn-text small" onClick={() => setOpen({ ...open, [r.s]: !open[r.s] })}>See impact</button></> : null}
            </span>
          </div>
          {open[r.s] && r.impact ? (
            <div className="card panel" style={{ margin: "6px 0 10px", background: "var(--bg)" }}>
              <p className="small"><b>{r.label}</b> appeared in {r.n} relevant jobs analysed while it is {r.v > 0 ? "not confirmed in" : "absent from"} your profile.{r.impact.after > r.impact.before ? ` If you add it once you genuinely have it, ${r.impact.after - r.impact.before} more of the current jobs would reach Strong Match.` : ""}</p>
              <p className="small muted" style={{ marginTop: 6 }}>Seen in: {r.impact.where.join("; ")}</p>
              {plan[r.s] ? <div className="copybox" style={{ marginTop: 10 }}>{plan[r.s]}</div> : aiReady ? (
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} disabled={!!busy} onClick={async () => {
                  setBusy(r.s);
                  const res = await fetch("/api/insights/roadmap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skill: r.s }) });
                  const j = await res.json().catch(() => ({}));
                  setPlan({ ...plan, [r.s]: res.ok ? j.text : j.error || "Could not write a plan." });
                  setBusy(null);
                }}>{busy === r.s ? <><Spinner /> Writing a plan</> : "Suggest a learning roadmap"}</button>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
}
