"use client";
import { useState } from "react";
import { useSave } from "@/components/useSave";
import { noReplyYetAction, statusAction } from "@/app/actions";
import { CopyButton } from "@/components/CopyButton";

/** After applying: "Any reply?" in one tap, and a ready follow-up email when there is no reply yet. */
export function ReplyPanel(p: { jobId: string; company: string; daysSince: number; followUp: { subject: string; body: string } | null; to: string | null; canFollowUp: boolean; followUps: boolean }) {
  const { pending, err, save: act } = useSave();
  const [none, setNone] = useState(false);
  return (
    <div className="card panel" id="reply">
      <h3>Any reply from {p.company}?</h3>
      <p className="small muted">You applied {p.daysSince <= 0 ? "today" : p.daysSince === 1 ? "yesterday" : `${p.daysSince} days ago`}. Employer replies come to your own email; tell us here so we can help with the next step.</p>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => act(() => statusAction(p.jobId, "interview"))}>Got an interview call</button>
        <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => act(() => statusAction(p.jobId, "closed"))}>Not selected</button>
        <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => { setNone(true); void noReplyYetAction(p.jobId).catch(() => {}); }}>No reply yet</button>
      </div>
      {err ? <p className="err small" style={{ marginTop: 8 }}>{err}</p> : null}
      {none ? (
        p.followUp && p.canFollowUp ? (
          <div style={{ marginTop: 14 }}>
            <p className="small"><b>Send a short follow-up.</b> A polite note after a week keeps you on the recruiter&apos;s mind. Check it, then send it from your email.</p>
            <pre className="note" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", marginTop: 8 }}>{`Subject: ${p.followUp.subject}\n\n${p.followUp.body}`}</pre>
            <div className="row" style={{ marginTop: 8 }}>
              {p.to ? <a className="btn btn-primary btn-sm" href={`mailto:${encodeURIComponent(p.to)}?subject=${encodeURIComponent(p.followUp.subject)}&body=${encodeURIComponent(p.followUp.body)}`}>Open in my email</a> : null}
              <CopyButton text={p.followUp.body} label="Copy text" />
            </div>
          </div>
        ) : (
          <p className="small muted" style={{ marginTop: 12 }}>{!p.followUps ? "Most employers take two to three weeks to reply. We will ask you again in a few days, and keep showing you new matches meanwhile." : p.canFollowUp ? "This job was applied for on the company's site, so there is no recruiter email to follow up with. Most employers reply within two to three weeks; we will ask you again." : "It is a bit early: most employers take at least a week. We will ask you again in a few days, and have a follow-up email ready if you need one."}</p>
        )
      ) : null}
    </div>
  );
}
