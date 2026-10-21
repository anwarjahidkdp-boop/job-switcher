"use client";
// A searchable dropdown of every country: popular ones first, then A to Z. Type to filter, arrows + Enter to pick.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ALL_COUNTRIES } from "@/lib/countries";

export function CountrySelect({ value, onChange, id, disabled, label, first }: { value: string; onChange: (code: string) => void; id?: string; disabled?: boolean; label?: string; first?: string }) {
  const auto = useId();
  const listId = (id || auto) + "-list";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // The visitor's own country goes to the very top of the list.
  const all = useMemo(() => { const f = first && ALL_COUNTRIES.find((c) => c.code === first); return f ? [{ ...f, popular: true }, ...ALL_COUNTRIES.filter((c) => c !== f)] : ALL_COUNTRIES; }, [first]);
  const current = all.find((c) => c.code === value);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter((c) => c.name.toLowerCase().includes(s) || c.code.toLowerCase() === s)
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(s)) - Number(!b.name.toLowerCase().startsWith(s)));
  }, [q, all]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { box.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" }); }, [hi]);

  const pick = (code: string) => { setOpen(false); setQ(""); if (code !== value) onChange(code); };

  return (
    <div className="csel" ref={box}>
      <button type="button" id={id} className="csel-btn" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => { setHi(0); setOpen((o) => !o); }}>
        <span>{current?.name || "Another country"}</span><span aria-hidden="true" className="csel-car">▾</span>
      </button>
      {open ? (
        <div className="csel-pop">
          <input ref={input} type="text" placeholder="Search a country" value={q} aria-controls={listId} aria-label="Search a country"
            onChange={(e) => { setQ(e.target.value); setHi(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); if (items[hi]) pick(items[hi].code); }
              else if (e.key === "Escape") setOpen(false);
            }} />
          <ul id={listId} role="listbox" className="csel-list">
            {items.map((c, i) => (
              <li key={c.code} data-i={i} role="option" aria-selected={c.code === value} className={`${i === hi ? "hi" : ""} ${c.code === value ? "on" : ""} ${!q && c.popular && !items[i + 1]?.popular ? "sep" : ""}`}
                onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(c.code); }}>
                {c.name}{c.code === value ? <span aria-hidden="true"> ✓</span> : null}
              </li>
            ))}
            {!items.length ? <li className="muted">No country matches “{q}”</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
