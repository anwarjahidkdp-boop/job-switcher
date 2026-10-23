import Link from "next/link";
import { missingApplicationFields } from "@/lib/application-profile";
import type { AnswerLibrary, DealBreakers } from "@/lib/career-safety";
export function ApplicationProfileNotice({ answers, rules, onProfile = false }: { answers: AnswerLibrary; rules: DealBreakers; onProfile?: boolean }) {
  const missing = missingApplicationFields(answers,rules);
  if (!missing.length) return null;
  const required = missing.filter(f=>f.required).length;
  return <div className="banner application-profile-notice" role="status" style={{ marginTop: 14 }}>
    <div><div className="application-notice-title"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 10 18H2Z"/><path d="M12 9v5M12 17h.01"/></svg><b>Application details incomplete · {missing.length} unanswered</b></div>
      <p className="small" style={{ marginTop: 4 }}>{required ? "Some required preferences still need an answer. " : ""}Complete your answers so applications use your confirmed information.</p>
      {onProfile ? <p className="small" style={{ marginTop: 4 }}>Still needed: {missing.map(f=>f.label.replace(" (days)","").replace(" (years)","")).join(" · ")}</p> : null}
    </div>
    <Link className="btn btn-ghost btn-sm" href={onProfile ? "#application-safety" : "/profile#application-safety"}>Complete my details</Link>
  </div>;
}
