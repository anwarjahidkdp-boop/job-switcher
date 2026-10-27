import Link from "next/link";
import type {Scored} from "@/lib/matching";
import {fitLabel} from "@/lib/matching";
import {salaryText} from "@/lib/countries";
import {STATUS_LABEL} from "@/lib/types";
import {Ring,DeadlineChip} from "@/components/ui";
import {fitCard} from "@/lib/server/search-summary";
import {gapLabel} from "@/lib/score-gap";

export function OpportunityRow({ x, today, status, ai, hideFit = false }: { x: Scored; today: string; status?: keyof typeof STATUS_LABEL; ai?: { fit: string; reason: string }; hideFit?: boolean }) {
  const { job, m } = x;
  // The label follows the same group rule as every count (fitCard): a high score outside the field is not a Strong Fit.
  const group = fitCard(x);
  const label = !m.relevant ? "Outside your field" : m.expired ? "Deadline passed" : fitLabel(m.score);
  const tone = group === "ex" ? "high" : group === "rest" ? "low" : "";
  const gap = hideFit ? null : gapLabel(x);
  // The whole card opens the job (the title link stretches over it); the gap link sits above it and opens the job's career guide.
  return (
    <div className="opp">
      <Ring score={m.score} band={m.band} />
      <div style={{ minWidth: 0 }}>
        <h4><Link prefetch={false} className="opp-open" href={`/jobs/${job.id}`}>{job.title}</Link></h4>
        <div className="meta">{job.company}{job.location ? ` · ${job.location}` : ""}{salaryText(job.salaryMin, job.salaryMax, job.country) ? ` · ${salaryText(job.salaryMin, job.salaryMax, job.country)}` : ""}{job.ownerId ? ` · ${job.source}` : ""}{job.isSample ? " · Sample" : ""}</div>
        <div className="why">{m.matched.slice(0, 3).map((t) => "✓ " + t).join(" · ")}{m.gaps[0] ? <> · <span style={{ color: "var(--warn)" }}>⚠ {m.gaps[0].t.split(";")[0]}</span></> : null}</div>
        {hideFit ? null : <span className={`chip-chance ${tone}`}>{label}</span>}
        {gap ? <Link prefetch={false} className="chip-gap" href={`/insights/job/${job.id}`}>{gap}</Link> : null}
        {ai?.reason ? <div className={`ai-check ${ai.fit === "strong" ? "ok" : "warn"}`}><b>AI fit check:</b> {ai.reason}</div> : null}
      </div>
      <div className="dlc stack" style={{ gap: 6, alignItems: "flex-end" }}><DeadlineChip deadline={job.deadline} today={today} />{status ? <span className="pill p-neutral">{STATUS_LABEL[status]}</span> : null}{hideFit ? null : <span className="hide">{label}</span>}</div>
    </div>
  );
}
