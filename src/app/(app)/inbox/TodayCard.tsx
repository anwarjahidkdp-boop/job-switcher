import styles from "./TodayCard.module.css";
import Link from "next/link";
import { type Plan } from "@/lib/today";
import type { NotificationRow } from "@/lib/server/notify";

/** One step of the work JobPao did: a big figure, what it is, and a short detail line. */
export interface DoneItem { n: string; label: string; sub?: string; href?: string; icon: string }

const Ic = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />;

/** Top of the dashboard: what JobPao has done for the person so far, and anything new. */
export function TodayCard({ plan, items, done, summary }: { plan: Plan | null; items: (NotificationRow & { applicationStatus?: string })[]; done: DoneItem[]; summary: [string, number][] }) {
  if (!done.length && !items.length) return null;
  const days = plan && !plan.ended ? plan.day : 0;
  const appliedItems = items.filter((n) => n.applicationStatus);
  const otherItems = items.filter((n) => n !== appliedItems[0]);
  const applicationCards = appliedItems.slice(0, 1).map((n) => {
    const title = n.title.replace(`${n.applicationStatus} · `, "");
    const match = title.match(/^(\d+(?:\.\d+)?% match):?\s*/i);
    return <Link prefetch={false} key={n.id} href={n.link || "/applications"} className={styles.application}>
      <span className={styles.ribbon} aria-hidden="true" />
      <span className={styles.latest}>Latest application</span>
      <span className={styles.badge}>✓ {n.applicationStatus}</span>
      <b className={styles.applicationTitle}>{match ? title.slice(match[0].length) : title}</b>
      {match ? <span className={styles.match}>{match[1]}</span> : null}
      <span className={styles.applicationLink}>{n.link === "/applications" ? "View application →" : "View opportunities →"}</span>
    </Link>;
  });
  return (
    <div className="card panel today" id="trial">
      <h3 className={styles.heading}><span aria-hidden="true">↗</span> {days ? `Your progress · Day ${days}` : plan?.ended ? "Your trial progress" : "Your career progress"}</h3>
      {done.length ? <ol className={styles.progress} aria-label="What JobPao did for you">{done.map((d) => {
        const body = <><span className={styles.icon}><Ic d={d.icon} /></span><span className={styles.copy}><span className={styles.label}>{d.label}</span>{d.sub ? <span className={styles.detail}>{d.sub}</span> : null}</span><b className={`${styles.number} num`}>{d.n}</b></>;
        return <li key={d.label} className={`${styles.item}${d.label === "Applications submitted" && applicationCards.length ? ` ${styles.withPocket}` : ""}`}>{d.href ? <Link prefetch={false} href={d.href} className={styles.metric}>{body}</Link> : <div className={styles.metric}>{body}</div>}{d.label === "Applications submitted" && applicationCards.length ? <div className={styles.pocket}>{applicationCards}</div> : null}</li>;
      })}</ol> : null}
      {plan?.summaryTime ? (
        <div className="today-next" style={{ display: "block" }}>
          <b>Your trial with JobPao</b>
          <div className="tiles" style={{ marginTop: 10 }}>{summary.map(([l, n]) => <div key={l} className="card tile"><b>{n}</b><span className="small muted">{l}</span></div>)}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <Link prefetch={false} className="btn btn-primary btn-sm" href="/upgrade">Keep my assistant working</Link>
            <span className="small muted">New matches and ready applications every day.</span>
          </div>
        </div>
      ) : null}
      {items.length ? (
        <div className="today-items">
          {otherItems.map((n) => <Link prefetch={false} key={n.id} href={n.link || "/inbox"} className="ntf new"><span className="ntf-dot" aria-hidden="true" /><span style={{ flex: 1, minWidth: 0 }}><b>{n.title}</b>{n.body ? <span className="small muted" style={{ display: "block" }}>{n.body}</span> : null}</span></Link>)}
          <Link prefetch={false} className="btn btn-text" href="/notifications">All notifications</Link>
        </div>
      ) : null}
    </div>
  );
}
