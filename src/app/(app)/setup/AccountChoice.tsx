"use client";
import { useState } from "react";
import { useSave } from "@/components/useSave";
import { setSiteAccountAction } from "@/app/actions";

/** One question with a few answers; picking one shows only its instructions underneath and saves the answer. */
export function AccountChoice({ site, value, options, panels }: { site: string; value: string | null; options: { v: string; label: string }[]; panels: Record<string, React.ReactNode> }) {
  const [picked, setPicked] = useState(value);
  const { err, save } = useSave();
  const pick = (v: string) => {
    setPicked(v);
    save(() => setSiteAccountAction(site, v));
  };
  return (
    <div style={{ marginTop: 8 }}>
      <div className="sg-choices" role="radiogroup">
        {options.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={picked === o.v} className={`sg-choice${picked === o.v ? " on" : ""}`} onClick={() => pick(o.v)}>
            <span className="sg-dot" />{o.label}
          </button>
        ))}
      </div>
      {err ? <p role="alert" className="err small" style={{ marginTop: 6 }}>{err}</p> : null}
      {picked ? <div style={{ marginTop: 10 }}>{panels[picked]}</div> : null}
    </div>
  );
}
