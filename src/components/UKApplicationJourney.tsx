import React, { type ReactNode } from 'react';
import Link from 'next/link';
import { CopyButton } from './CopyButton';
import type { UKApplicationAnswer, UKApplicationRoute } from '@/lib/uk-application';
import styles from './UKApplicationJourney.module.css';

export function UKApplicationJourney({ prepared, opened, submitted, route, children }: { prepared: boolean; opened: boolean; submitted: boolean; route: UKApplicationRoute; children?: ReactNode }) {
  const current = submitted ? 4 : opened ? 3 : prepared ? 2 : 1;
  const steps = [{ title: 'Prepare', note: 'Your CV & cover letter', href: '#application' }, { title: 'Review', note: 'Documents & saved answers', href: '#uk-review' }, { title: 'Submit', note: route.kind === 'email' ? 'Email the application' : 'On the original website', href: '#uk-submit' }, { title: 'Track', note: 'Confirm after submission', href: '#application-progress' }];
  return <div className={styles.journey}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>YOUR UK APPLICATION</p><h2>Your application, step by step</h2><p>Start with your CV. Check your details. Follow the instructions below to submit.</p></div><span className={styles.route}>{route.label}</span></div>
    <ol className={styles.steps} aria-label="UK application steps">{steps.map((s, i) => <li key={s.title} data-current={current === i + 1} data-done={submitted || (i === 0 && prepared)}><a href={prepared || i === 0 ? s.href : "#application"} aria-current={current === i + 1 ? 'step' : undefined}><span className={styles.number}>{submitted || (i === 0 && prepared) ? '✓' : String(i + 1).padStart(2, '0')}</span><span><b>{s.title}</b><small>{s.note}</small></span></a></li>)}</ol>
    <p className={styles.truth}>Opening a website or preparing documents does not count as a submitted application.</p>
    {children}
  </div>;
}

export function UKApplicationStep({ id, number, title, sub, children }: { id: string; number: number; title: string; sub: string; children: ReactNode }) {
  return <section id={id} className={styles.section} aria-label={`Step ${number}: ${title}`}><div className={styles.sectionHead}><span className={styles.number}>{String(number).padStart(2, '0')}</span><div><h3>{title}</h3><p>{sub}</p></div></div>{children}</section>;
}

export function UKApplicationAnswers({ answers }: { answers: UKApplicationAnswer[] }) {
  return <div className={styles.answers}>
    <p className="small muted">Use these saved answers as a starting point. Confirm they are still correct; answer job-specific questions from your own experience.</p>
    <div className={styles.answerGrid}>{answers.map(a => <div className={styles.answer} key={a.label}><span>{a.label}</span><b>{a.value || 'Confirm in your profile'}</b>{a.note ? <small>{a.note}</small> : null}{a.value ? <CopyButton text={a.value} label={`Copy ${a.label.toLowerCase()}`} /> : <Link prefetch={false} className="btn btn-ghost btn-sm" href="/profile">Add or confirm answer</Link>}</div>)}</div>
    <Link prefetch={false} className="btn-text small" href="/profile">Review saved profile answers →</Link>
    <p className="small muted">For a supporting statement, use the reviewed cover letter as a starting point and address each criterion in the advert. Do not invent qualifications or experience.</p>
  </div>;
}
