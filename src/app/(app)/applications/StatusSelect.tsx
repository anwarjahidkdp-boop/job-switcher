"use client";
import { useSave } from "@/components/useSave";
import { statusAction } from "@/app/actions";

export function StatusSelect({ jobId }: { jobId: string }) {
  const { pending, err, save } = useSave();
  return (
    <select aria-label="Update status" disabled={pending} defaultValue="" style={{ width: "auto", fontSize: 13, padding: "5px 8px" }}
      onChange={(e) => { const v = e.target.value; if (v) save(() => statusAction(jobId, v)); }} title={err || undefined}>
      <option value="">Update…</option><option value="interview">Interview</option><option value="offer">Offer</option><option value="closed">Rejected / Closed</option><option value="withdrawn">Withdrawn</option>
    </select>
  );
}
