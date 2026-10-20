"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSiteAccountAction } from "@/app/actions";

/** One question with a few answers; picking one shows only its instructions underneath and saves the answer. */
export function AccountChoice({ site, value, options, panels }: { site: string; value: string | null; options: { v: string; label: string }[]; panels: Record<string, React.ReactNode> }) {
  const router = useRouter();
  const [picked, setPicked] = useState(value);
  const [, start] = useTransition();
  const pick = (v: string) => {
    setPicked(v);
    start(async () => { await setSiteAccountAction(site, v); router.refresh(); });
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
      {picked ? <div style={{ marginTop: 10 }}>{panels[picked]}</div> : null}
    </div>
  );
}
