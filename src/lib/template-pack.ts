// Deterministic application pack (no AI), ported from the prototype templatePack().
// Used when AI is unavailable or over the monthly cap. Uses only the verified Master CV and profile.
import { rule, HOME_COUNTRY, type CountryCode } from "./countries";
import { hasSkillSet } from "./matching";
import { skillLabel } from "./taxonomy";
import type { ApplicationPack, Job, MasterCV, MatchProfile } from "./types";

/** "SR CAREER SOLUTIONS UK LIMITED" -> "SR Career Solutions UK Limited": shouted names read badly in a letter; short acronyms stay. */
export function displayCompany(name: string): string {
  if (!name || /[a-z]/.test(name)) return name;
  return name.replace(/[A-Z][A-Z'&]*/g, (w) => (w.length <= 3 && !/^(?:AND|THE|FOR|OF)$/.test(w) ? w : w[0] + w.slice(1).toLowerCase()));
}

export function templatePack(job: Job, m: MasterCV, P: MatchProfile, opts: { needVisa: boolean; homeCountry?: CountryCode }): ApplicationPack {
  const set = hasSkillSet(P);
  const rel = [...(job.required || []), ...(job.preferred || [])].filter((s) => set.has(s)).map(skillLabel);
  const hits = (b: string) => rel.filter((r) => b.toLowerCase().includes(r.toLowerCase().split(" ")[0])).length;
  const bullets = (m.experience[0]?.bullets || []).slice().sort((a, b) => hits(b) - hits(a));
  const allSkills = [...(m.skills_core || []), ...(m.skills_tools || [])];
  const abroad = job.country !== (opts.homeCountry || HOME_COUNTRY) && opts.needVisa;
  // The CV's own summary wins: a letter must not say "5 years" under a CV that says "3 years' experience".
  const stated = (m.summary || "").match(/\b(\d{1,2})\+?\s*years?(?:'|’)?\s+(?:of\s+)?(?:experience|expertise)/i);
  const years = stated ? Number(stated[1]) : Math.floor(P.years);
  const company = displayCompany(job.company);
  const article = (t: string) => (/^[aeiou]/i.test(t) && !/^(?:uni|eu|one)/i.test(t) ? "an" : "a");
  const current = m.experience.find((e) => !e.end) || null;
  const role = P.currentTitle && P.currentCompany
    ? `I currently work as ${article(P.currentTitle)} ${P.currentTitle} at ${P.currentCompany}${years > 0 ? `, and I have ${years} year${years === 1 ? "" : "s"} of experience` : ""}.`
    : years > 0 ? `I have ${years} year${years === 1 ? "" : "s"} of relevant experience.` : "";
  // Evidence in the first person, from the verified CV: "Support 12 residents..." -> "I support 12 residents...".
  const firstPerson = (b: string) => `I ${/^[A-Z][a-z]/.test(b) ? b[0].toLowerCase() + b.slice(1) : b}`.replace(/[.;]\s*$/, "");
  const evidence = bullets.length ? `${current ? "In this role" : "In my most recent role"}, ${firstPerson(bullets[0])}${bullets[1] ? `, and ${firstPerson(bullets[1]).replace(/^I /, "I also ")}` : ""}.` : "";
  const quals = (m.certifications || []).filter((c) => !/in progress|pending|expected/i.test(c)).slice(0, 3).map((c) => c.replace(/\s*\((?:19|20)\d{2}\)\s*$/, ""));
  const qualLine = quals.length ? `I hold ${quals.length > 1 ? `${quals.slice(0, -1).join(", ")} and ${quals.at(-1)}` : quals[0]}.` : "";
  const midSentence = (t: string) => t.replace(/\b[A-Z][a-z]+\b/g, (w) => w.toLowerCase());
  const asked = rel.slice(0, 3).map(midSentence);
  const fit = asked.length ? `The advert asks for ${asked.length > 1 ? `${asked.slice(0, -1).join(", ")} and ${asked.at(-1)}` : asked[0]}, and my CV shows this experience.` : "";
  // British, Irish and Australasian letters to an unnamed reader close "Yours faithfully"; North America uses "Sincerely".
  const close = ["GB", "IE", "AU", "NZ"].includes(job.country) ? "Yours faithfully" : "Sincerely";
  const para = (...parts: string[]) => parts.filter(Boolean).join(" ");
  return {
    summary: m.summary,
    top_bullets: bullets,
    // Only Master CV skills, the job's matches first (labels may differ from master wording; checkPack re-orders against the master).
    skills_order: [...allSkills.filter((s) => rel.some((r) => r.toLowerCase() === s.toLowerCase())), ...allSkills.filter((s) => !rel.some((r) => r.toLowerCase() === s.toLowerCase()))],
    emphasis: rel.length ? [`Moved ${rel.slice(0, 3).join(", ")} to the front because this job asks for them.`] : [],
    cover_letter: [
      "Dear Hiring Manager,",
      para(`I am writing to apply for the ${job.title} position at ${company}.`, role),
      para(evidence, qualLine) || m.summary,
      para(fit, "I would welcome the opportunity to discuss how my experience could support your team."),
      para(P.notice ? `My notice period is ${P.notice} days.` : "", abroad ? "I would need visa sponsorship to take up the role." : "", "Thank you for your consideration."),
      `${close},\n${m.name}\n${m.contact}`,
    ].join("\n\n"),
    email_subject: `Application for ${job.title} – ${m.name}`,
    email_body: `Dear Hiring Manager,\n\nPlease find attached my CV and cover letter for the ${job.title} position at ${company}. ${role}\n\nI would be glad to discuss my application at your convenience.\n\nBest regards,\n${m.name}\n${m.contact}`,
    checklist: rule(job.country).checklist.slice(),
  };
}
