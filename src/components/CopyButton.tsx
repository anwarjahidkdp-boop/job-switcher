"use client";
import { useState } from "react";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setFailed(false); setDone(true); setTimeout(() => setDone(false), 2000); } catch { setDone(false); setFailed(true); }
      }}
    >
      {done ? "Copied" : failed ? "Copy failed: select the text" : label}
    </button>
  );
}
