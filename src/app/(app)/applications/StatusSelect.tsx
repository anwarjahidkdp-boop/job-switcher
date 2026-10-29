"use client";
import { useState } from "react";
import Link from "next/link";
import { useSave } from "@/components/useSave";
import { statusAction } from "@/app/actions";

export function StatusSelect({ jobId }: { jobId: string }) {
  const { pending, err, save } = useSave();
  const [v, setV] = useState("");
  return (
    <>
    <Link className="btn btn-primary btn-sm" href={`/jobs/${jobId}#interview`}>Schedule interview</Link>
    <select aria-label="Update status" disabled={pending} value={err && !pending ? "" : v} /* a failed save shows no status that was not saved */ style={{ width: "auto", fontSize: 13, padding: "5px 8px" }}
      onChange={(e) => { const x = e.target.value; setV(x); if (x) save(() => statusAction(jobId, x)); }}>
      <option value="">Update…</option><option value="offer">Offer</option><option value="closed">Rejected / Closed</option><option value="withdrawn">Withdrawn</option>
    </select>
    {err ? <span className="err small" role="alert" style={{ display: "block", marginTop: 4 }}>{err}</span> : null}
    </>
  );
}
