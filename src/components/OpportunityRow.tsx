import Link from "next/link";
import type {Scored} from "@/lib/matching";
import {fitLabel} from "@/lib/matching";
import {money,perLabel} from "@/lib/countries";
import {STATUS_LABEL} from "@/lib/types";
import {Ring,DeadlineChip} from "@/components/ui";

export function OpportunityRow({ x, today, status, ai, hideFit = false }: { x: Scored; today: string; status?: keyof typeof STATUS_LABEL; ai?: { fit: string; reason: string }; hideFit?: boolean }) {
  const { job, m } = x;
  return (
    <Link prefetch={false} className="opp" href={`/jobs/${job.id}`}>
      <Ring score={m.score} band={m.band} />
      <div style={{ minWidth: 0 }}>
        <h4>{job.title}</h4>
        <div className="meta">{job.company}{job.location ? ` · ${job.location}` : ""}{job.salaryMax ? ` · ${money(job.salaryMin, job.country)}–${money(job.salaryMax, job.country)}${perLabel(job.country)}` : ""}{job.ownerId ? ` · ${job.source}` : ""}{job.isSample ? " · Sample" : ""}</div>
        <div className="why">{m.matched.slice(0, 3).map((t) => "✓ " + t).join(" · ")}{m.gaps[0] ? <> · <span style={{ color: "var(--warn)" }}>⚠ {m.gaps[0].t.split(";")[0]}</span></> : null}</div>
        {hideFit ? null : <span className={`chip-chance ${m.score >= 90 ? "high" : m.score < 70 ? "low" : ""}`}>{fitLabel(m.score)}</span>}
        {ai?.reason ? <div className={`ai-check ${ai.fit === "strong" ? "ok" : "warn"}`}><b>AI fit check:</b> {ai.reason}</div> : null}
      </div>
      <div className="dlc stack" style={{ gap: 6, alignItems: "flex-end" }}><DeadlineChip deadline={job.deadline} today={today} />{status ? <span className="pill p-neutral">{STATUS_LABEL[status]}</span> : null}{hideFit ? null : <span className="hide">{fitLabel(m.score)}</span>}</div>
    </Link>
  );
}
