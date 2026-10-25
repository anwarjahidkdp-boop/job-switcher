// Salary questions for interview preparation, written for this job: the posted pay, the person's own saved
// expectation, current pay and notice, in the job country's currency and pay period. Numbers come only from
// those sources; anything we do not hold is a [placeholder] the person fills in.
import { money, rule } from "../countries";
import type { InterviewPrep, Job } from "../types";

export interface SalaryFacts {
  expected: number | null;
  current: number | null;
  negotiable: boolean;
  noticeDays: number | null;
}

type Q = InterviewPrep["questions"][number];

const pos = (n: unknown) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : null);

/** Expected pay: the saved answer first, then the preferred range; current pay only from the saved answer. */
/** Figures saved for another country's currency are left out, so a taka figure is never quoted for a UK job. */
export function salaryFacts(answers: { expectedSalary?: number | null; currentSalary?: number | null; salaryNegotiable?: boolean; noticeDays?: number | null; salaryCountry?: string; currentSalaryCountry?: string } | null | undefined,
  prefs: { salaryMin: number | null; salaryMax: number | null; notice: number | null } | null | undefined, jobCountry: string, searchCountry: string): SalaryFacts {
  const same = (c: string | undefined, fallback: string) => (c || fallback) === jobCountry;
  return {
    expected: same(answers?.salaryCountry, searchCountry) ? pos(answers?.expectedSalary) ?? pos(prefs?.salaryMin) : null,
    current: same(answers?.currentSalaryCountry, searchCountry) ? pos(answers?.currentSalary) : null,
    negotiable: answers?.salaryNegotiable === true,
    noticeDays: pos(answers?.noticeDays) ?? pos(prefs?.notice),
  };
}

/** Round to a figure people say out loud (৳45,000 not ৳44,873; £34,500 not £34,412). */
function roundSay(n: number): number {
  const step = n >= 100000 ? 5000 : n >= 10000 ? 500 : n >= 1000 ? 50 : 1;
  return Math.round(n / step) * step;
}

/** The range to ask for: inside the posted band when it exists, never below the person's own expectation. */
export function askRange(job: Pick<Job, "salaryMin" | "salaryMax">, f: SalaryFacts): { low: number; high: number } | null {
  const pMin = pos(job.salaryMin), pMax = pos(job.salaryMax);
  if (pMin && pMax && pMax >= pMin) {
    // Aim for the upper half of the posted band; if the person expects more, start at their figure.
    const mid = roundSay((pMin + pMax) / 2);
    const low = f.expected ? Math.max(roundSay(f.expected), mid) : mid;
    const high = Math.max(low, roundSay(pMax));
    return { low: Math.min(low, high), high };
  }
  const posted = pMax ?? pMin;
  if (f.expected) {
    const low = roundSay(Math.max(f.expected, posted ?? 0));
    return { low, high: roundSay(low * 1.1) };
  }
  if (posted) return { low: roundSay(posted), high: roundSay(posted) };
  return null;
}

function noticeText(days: number | null): string {
  if (!days) return "[your notice period, e.g. one month]";
  if (days % 30 === 0) return days === 30 ? "one month" : `${days / 30} months`;
  if (days % 7 === 0) return days === 7 ? "one week" : `${days / 7} weeks`;
  return `${days} days`;
}

export function salaryQuestions(job: Job, f: SalaryFacts): Q[] {
  const r = rule(job.country);
  const per = r.per === "year" ? "a year" : "a month";
  const m = (n: number) => money(n, job.country);
  const pMin = pos(job.salaryMin), pMax = pos(job.salaryMax);
  const posted = pMin && pMax ? `${m(pMin)} to ${m(pMax)} ${per}` : pMax ? `up to ${m(pMax)} ${per}` : pMin ? `from ${m(pMin)} ${per}` : null;
  const range = askRange(job, f);
  const say = range ? (range.low === range.high ? `${m(range.low)} ${per}` : `${m(range.low)} to ${m(range.high)} ${per}`) : `[your expected range, e.g. a figure ${per} you have checked against similar ${job.title} roles]`;
  const flex = f.negotiable ? "I'm open to discussing the full package" : "I'm happy to discuss the full package";
  // In the UK and similar markets you can steer away from current pay; in Bangladesh and the Gulf it is routinely asked.
  const askedOften = ["BD", "IN", "PK", "AE", "SA", "QA", "KW", "OM", "BH", "MY"].includes(job.country);

  const expectWhy = posted
    ? `The post lists ${posted}. They check you fit the budget; anchoring in the upper half leaves room to agree.`
    : "No pay is posted, so they want a number first. Give a researched range, not one figure, and tie it to the role.";
  const expectAnswer = posted
    ? `Based on the responsibilities of this ${job.title} role and my experience, I'm looking for ${say}, which sits within the range in your advert. ${flex}, including benefits and growth.`
    : `For a ${job.title} role with these responsibilities, I'm looking for ${say}. ${flex}, including benefits, and I'd like to understand the budget you have in mind for this position.`;

  const out: Q[] = [
    { topic: "salary", question: "What are your salary expectations?", why: expectWhy, answer: expectAnswer },
    askedOften
      ? { topic: "salary", question: "What is your current salary?", why: "Employers here usually ask this to set the offer. Be honest; give your expectation in the same answer.",
          answer: `My current salary is ${f.current ? `${m(f.current)} ${per}` : "[your current monthly salary]"}, plus [any allowances or bonus]. For this role, with more responsibility, I'm looking for ${say}.` }
      : { topic: "salary", question: "What is your current salary?", why: "You can answer, but it is fair to keep the focus on the value of this role rather than your past pay.",
          answer: `I'd rather focus on the value of this role. Based on the responsibilities and the market for ${job.title} roles, I'm looking for ${say}, and I'm open to discussing the full package.` },
    { topic: "salary", question: "Our budget is lower than your expectation. Would you still consider the role?", why: "They test how firm your number is. Stay positive and talk about the whole package, not only base pay.",
      answer: `I'm genuinely interested in this role at ${job.company}. If the base salary is fixed, could we look at the rest of the package, such as [a joining bonus, allowances, extra leave or an early salary review after six months]? I'd like to find a figure that works for both of us.` },
    { topic: "salary", question: "When can you join us?", why: "They plan the start date and check your notice period.",
      answer: `My notice period is ${noticeText(f.noticeDays)}. I'll hand over my work properly, and I can start soon after${f.noticeDays ? "" : " [your earliest joining date]"}.` },
  ];
  return out;
}

/** Checklist lines that help the person prepare the pay conversation. */
export function salaryChecklist(job: Job, f: SalaryFacts): string[] {
  const out = ["Decide your pay range and your lowest acceptable figure before the interview"];
  if (!pos(job.salaryMin) && !pos(job.salaryMax)) out.push(`Check pay for similar ${job.title} roles before the interview, as this post gives no salary`);
  if (!f.expected) out.push("Save your expected salary in your profile so your answers can use it");
  return out;
}

/** Replace any salary questions with the job-specific set and add the pay checklist lines, keeping everything else. */
export function withSalaryPrep(prep: InterviewPrep, job: Job, f: SalaryFacts): InterviewPrep {
  const rest = prep.questions.filter((q) => q.topic !== "salary");
  const lines = salaryChecklist(job, f).filter((l) => !prep.checklist.includes(l));
  return { ...prep, questions: [...rest, ...salaryQuestions(job, f)], checklist: [...prep.checklist, ...lines] };
}

export interface OfferAdvice { counter: number | null; verdict: string; tips: string[]; email: { subject: string; body: string } }

/**
 * After an offer: whether and how much to ask for, from the offered figure, the posted range and the person's own
 * expectation. A counter stays inside the posted range and is never more than 15% above the offer.
 */
export function offerAdvice(job: Pick<Job, "title" | "company" | "country" | "salaryMin" | "salaryMax">, f: SalaryFacts, offered: number, name: string): OfferAdvice {
  const m = (n: number) => money(n, job.country);
  const per = rule(job.country).per === "year" ? "a year" : "a month";
  const cap = pos(job.salaryMax);
  // Ask only when the offer is under the person's own figure or under the top of the posted range.
  const want = f.expected && f.expected > offered ? f.expected : cap && cap > offered ? offered * 1.08 : null;
  let counter: number | null = want ? roundSay(Math.min(want, offered * 1.15, cap && cap > offered ? cap : Infinity)) : null;
  if (counter && counter <= offered * 1.02) counter = null;
  const verdict = counter
    ? `${m(offered)} ${per} is below ${f.expected && offered < f.expected ? "your expected salary" : "the top of the advertised range"}. Ask for ${m(counter)} ${per}.`
    : f.expected || cap
      ? `${m(offered)} ${per} already meets ${f.expected && offered >= f.expected ? "your expected salary" : "the top of the advertised range"}. Rather than more base pay, you can ask about benefits, leave or an early salary review.`
      : `There is no advertised range or saved expected salary to compare ${m(offered)} ${per} with. If it is fair for the role, ask about benefits, leave or an early salary review; save your expected salary in your profile for a firmer answer.`;
  const ask = counter ? `Based on my experience and the responsibilities of the role, I would like to ask whether a salary of ${m(counter)} ${per} would be possible.` : "Before I confirm, could you share more about the benefits, leave and when salaries are next reviewed?";
  return {
    counter, verdict,
    tips: [
      "Thank them first and show you want the job. Asking politely once is normal and professional.",
      "Ask once, with one clear figure and a reason (your experience, the role's scope or the market).",
      "If base pay cannot move, ask about a joining bonus, allowances, extra leave or a salary review after six months.",
      "Get the final offer in writing before you resign from your current job.",
    ],
    email: {
      subject: `${job.title} offer`,
      body: `Dear Hiring Manager,\n\nThank you for offering me the ${job.title} position at ${job.company}. I am excited about the role and the team.\n\n${ask} I am confident I can add value quickly, and I am keen to agree terms so I can confirm.\n\nThank you again, and I look forward to hearing from you.\n\nKind regards,\n${name}`,
    },
  };
}
