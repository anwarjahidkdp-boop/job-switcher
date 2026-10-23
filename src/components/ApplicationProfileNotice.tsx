import Link from "next/link";
import { missingApplicationFields } from "@/lib/application-profile";
import type { AnswerLibrary, DealBreakers } from "@/lib/career-safety";
export function ApplicationProfileNotice({ answers, rules, onProfile = false }: { answers: AnswerLibrary; rules: DealBreakers; onProfile?: boolean }) {
  const missing = missingApplicationFields(answers,rules);
  if (!missing.length) return null;
  const required = missing.filter(f=>f.required).length;
  return <div className="banner warn" role="status" style={{ marginTop: 14 }}>
    <div><b>Application details incomplete · {missing.length} unanswered</b>
      <p className="small" style={{ marginTop: 4 }}>{required ? "Some required preferences still need an answer. " : ""}Complete your answers so applications use your confirmed information.</p>
      {onProfile ? <p className="small" style={{ marginTop: 4 }}>Still needed: {missing.map(f=>f.label.replace(" (days)","").replace(" (years)","")).join(" · ")}</p> : null}
    </div>
    <Link className="btn btn-ghost btn-sm" href={onProfile ? "#application-safety" : "/profile#application-safety"}>Complete my details</Link>
  </div>;
}
