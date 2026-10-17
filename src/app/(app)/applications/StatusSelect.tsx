"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { statusAction } from "@/app/actions";

export function StatusSelect({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select aria-label="Update status" disabled={pending} defaultValue="" style={{ width: "auto", fontSize: 13, padding: "5px 8px" }}
      onChange={(e) => { const v = e.target.value; if (v) start(async () => { await statusAction(jobId, v); router.refresh(); }); }}>
      <option value="">Update…</option><option value="interview">Interview</option><option value="offer">Offer</option><option value="closed">Rejected / Closed</option><option value="withdrawn">Withdrawn</option>
    </select>
  );
}
