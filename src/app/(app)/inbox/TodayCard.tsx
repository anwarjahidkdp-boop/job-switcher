import Link from "next/link";
import type { Plan } from "@/lib/today";
import type { NotificationRow } from "@/lib/server/notify";

/** Top of the dashboard: the 7-day trial plan (during a trial) and what is new today. */
export function TodayCard({ plan, items, summary }: { plan: Plan | null; items: NotificationRow[]; summary: [string, number][] }) {
  if (!plan && !items.length) return null;
  return (
    <div className="card panel today" id="trial">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ margin: 0 }}>Today for you</h3>
        {plan ? <span className="small muted">{plan.ended ? "Your free week is over" : `Day ${plan.day} of your 7-day free trial`}</span> : null}
      </div>
      {plan ? (
        <>
          <div className="plan" aria-hidden="true">{plan.steps.map((s, i) => <i key={i} className={s.done ? "done" : s === plan.next ? "cur" : ""} />)}</div>
          {plan.next && !plan.summaryTime ? (
            <div className="today-next">
              <div><b>{plan.next.title}</b><div className="small muted">{plan.next.why}</div></div>
              <Link className="btn btn-primary btn-sm" href={plan.next.href}>{plan.next.cta}</Link>
            </div>
          ) : null}
          {plan.summaryTime ? (
            <div className="today-next" style={{ display: "block" }}>
              <b>Your week with JobPao</b>
              <div className="tiles" style={{ marginTop: 10 }}>{summary.map(([l, n]) => <div key={l} className="card tile"><b>{n}</b><span className="small muted">{l}</span></div>)}</div>
              <div className="row" style={{ marginTop: 12 }}>
                <Link className="btn btn-primary btn-sm" href="/upgrade">Keep my assistant working</Link>
                <span className="small muted">New matches and ready applications every day.</span>
              </div>
            </div>
          ) : null}
          <ul className="today-steps">{plan.steps.map((s) => <li key={s.title}><span className={`mk ${s.done ? "ok" : ""}`}>{s.done ? "✓" : "○"}</span><span className={s.done ? "muted" : ""}>Day {s.day}: {s.title}</span></li>)}</ul>
        </>
      ) : null}
      {items.length ? (
        <div className="today-items">
          {items.map((n) => <Link key={n.id} href={n.link || "/inbox"} className="ntf new"><span className="ntf-dot" aria-hidden="true" /><span style={{ flex: 1 }}><b>{n.title}</b>{n.body ? <span className="small muted" style={{ display: "block" }}>{n.body}</span> : null}</span></Link>)}
          <Link className="btn btn-text" href="/notifications">All notifications</Link>
        </div>
      ) : null}
    </div>
  );
}
