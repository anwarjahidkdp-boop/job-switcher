// Old CVs: when the newest date on a CV is a year or more ago, or a role is still marked "present", ask the person to
// confirm before we build their CV on it. Answers feed the Master CV like any other answer; nothing is assumed.
import type { CvQuestion } from "./types";

type Exp = { title: string; company: string; start: string | null; end: string | null };
type Edu = { degree?: string; year?: string | null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ym = (s: string | null | undefined): number | null => {
  const m = /^(\d{4})(?:-(\d{1,2}))?/.exec(String(s || "").trim());
  return m ? Number(m[1]) * 12 + (m[2] ? Number(m[2]) - 1 : 0) : null;
};
const label = (n: number) => `${MONTHS[n % 12]} ${Math.floor(n / 12)}`;

/** Up to two check questions for a CV that may be out of date. `today` is YYYY-MM-DD. */
export function freshnessQuestions(x: { experiences?: Exp[]; education?: Edu[] }, today: string): CvQuestion[] {
  const now = ym(today);
  if (now == null) return [];
  const exps = x.experiences || [];
  const dates = [...exps.flatMap((e) => [ym(e.start), ym(e.end)]), ...(x.education || []).map((e) => ym(e.year))].filter((n): n is number => n != null && n <= now);
  const latest = dates.length ? Math.max(...dates) : null;
  const old = latest != null && now - latest >= 12;
  const out: CvQuestion[] = [];
  const current = exps.filter((e) => !e.end && e.start).sort((a, b) => (ym(b.start) || 0) - (ym(a.start) || 0))[0];
  if (current && old) out.push({ id: "fresh_role", question: `Your CV says you still work as ${current.title} at ${current.company}. Is that still true? If you left, when, and where do you work now?`, placeholder: "e.g. Still there, now Senior Accountant / Left in June 2025, now at ABC Ltd", suggestions: ["Yes, I still work there", "Still there, promoted to ", "I left. Now I work at "] });
  if (old) out.push({ id: "fresh_new", question: `The newest date on your CV is ${label(latest!)}. What has changed since then: a new job, promotion, course, exam result or certification?`, placeholder: "e.g. Passed ACCA F7 in 2025; promoted to Team Lead in 2025", suggestions: ["Nothing has changed", "I was promoted to ", "Finished a course: "] });
  return out;
}
