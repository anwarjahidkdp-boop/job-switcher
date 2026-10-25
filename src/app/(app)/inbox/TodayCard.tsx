import styles from "./TodayCard.module.css";
import Link from "next/link";
import { type Plan } from "@/lib/today";

export interface DoneItem { n: string; label: string; sub?: string; href?: string; icon: string }
export interface LatestApplication { title:string; company:string; score?:number; status:string; href:string }
const Ic = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />;

export function TodayCard({ plan, done, latest, interviews, offers }: { plan: Plan | null; done: DoneItem[]; latest?:LatestApplication; interviews:number; offers:number }) {
  const days = plan && !plan.ended ? plan.day : 0;
  return <section className={`card panel ${styles.overview}`} id="trial" aria-labelledby="progress-heading">
    <div className={styles.sectionHead}>
      <h2 id="progress-heading" className={styles.heading}><span aria-hidden="true">↗</span> {days ? `Your progress · Day ${days}` : "Your career progress"}</h2>
      <Link href="/insights#career-reports" className={styles.reportLink}>View report <span aria-hidden="true">↗</span></Link>
    </div>
    <ol className={styles.progress} aria-label="Your career progress">{done.map((d,i) => {
      const body = <><span className={styles.icon}><Ic d={d.icon} /></span><span className={styles.copy}><span className={styles.label}>{d.label}</span>{d.sub ? <span className={styles.detail}>{d.sub}</span> : null}</span><b className={`${styles.number} num`}>{d.n}</b></>;
      return <li key={d.label} className={`${styles.item}${i===0&&latest?` ${styles.withPocket}`:""}`}>
        {d.href ? <Link prefetch={false} href={d.href} className={styles.metric}>{body}</Link> : <div className={styles.metric}>{body}</div>}
        {i===0&&latest ? <div className={styles.pocket}><Link prefetch={false} href={latest.href} className={styles.application}>
          <span className={styles.ribbon} aria-hidden="true"/>
          <span className={styles.applicationCopy}><span className={styles.latest}>Latest submission <span className={styles.badge}>✓ {latest.status}</span></span><b className={styles.applicationTitle}>{latest.title}</b><span className={styles.company}>{latest.company}</span></span>
          <span className={styles.applicationLink}>{latest.score!=null?<><b>{latest.score}%</b><span>match</span></>:<span aria-hidden="true">↗</span>}</span>
        </Link></div> : null}
      </li>;
    })}</ol>
    <div className={styles.outcomes} aria-label="Application outcomes"><Link href="/applications"><b>{interviews}</b><span>Interviews</span></Link><Link href="/applications"><b>{offers}</b><span>Offers</span></Link><Link href="/applications" className={styles.track}>Track applications <span aria-hidden="true">→</span></Link></div>
    {plan?.summaryTime?<div className={styles.trialEnd}><span>Your five-day trial report is ready.</span><Link href="/upgrade">Continue with Pro →</Link></div>:null}
  </section>;
}
