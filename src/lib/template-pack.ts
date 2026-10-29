// Deterministic application pack (no AI), ported from the prototype templatePack().
// Used when AI is unavailable or over the monthly cap. Uses only the verified Master CV and profile.
import { rule, HOME_COUNTRY, type CountryCode } from "./countries";
import { hasSkillSet } from "./matching";
import { skillLabel } from "./taxonomy";
import type { ApplicationPack, Job, MasterCV, MatchProfile } from "./types";

export function templatePack(job: Job, m: MasterCV, P: MatchProfile, opts: { needVisa: boolean; homeCountry?: CountryCode }): ApplicationPack {
  const set = hasSkillSet(P);
  const rel = [...(job.required || []), ...(job.preferred || [])].filter((s) => set.has(s)).map(skillLabel);
  const hits = (b: string) => rel.filter((r) => b.toLowerCase().includes(r.toLowerCase().split(" ")[0])).length;
  const bullets = (m.experience[0]?.bullets || []).slice().sort((a, b) => hits(b) - hits(a));
  const allSkills = [...(m.skills_core || []), ...(m.skills_tools || [])];
  const abroad = job.country !== (opts.homeCountry || HOME_COUNTRY) && opts.needVisa;
  const years = Math.floor(P.years);
  const role = P.currentTitle && P.currentCompany ? `I currently work as ${P.currentTitle} at ${P.currentCompany}, with ${years} years of experience.` : `I have ${years} years of experience.`;
  return {
    summary: m.summary,
    top_bullets: bullets,
    // Only Master CV skills, the job's matches first (labels may differ from master wording; checkPack re-orders against the master).
    skills_order: [...allSkills.filter((s) => rel.some((r) => r.toLowerCase() === s.toLowerCase())), ...allSkills.filter((s) => !rel.some((r) => r.toLowerCase() === s.toLowerCase()))],
    emphasis: rel.length ? [`Moved ${rel.slice(0, 3).join(", ")} to the front because this job asks for them.`] : [],
    cover_letter: `Dear Hiring Manager,\n\nI am writing to apply for the ${job.title} position at ${job.company}. ${role}\n\n${m.summary}\n\n${rel.length ? `My documented experience includes ${rel.slice(0, 3).join(", ")}, which is relevant to the requirements of this position.` : "My CV outlines the professional experience and qualifications I would bring to this role."} I would welcome the opportunity to discuss my background and suitability for the position.\n\n${P.notice ? `My notice period is ${P.notice} days. ` : ""}${abroad ? "I would need visa sponsorship to take up the role. " : ""}Thank you for your consideration.\n\nSincerely,\n${m.name}\n${m.contact}`,
    email_subject: `Application for ${job.title} – ${m.name}`,
    email_body: `Dear Hiring Manager,\n\nPlease find attached my CV for the ${job.title} position at ${job.company}. ${role.replace("I currently work as", "I currently work as")}\n\nI would be glad to discuss my application at your convenience.\n\nBest regards,\n${m.name}\n${m.contact}`,
    checklist: rule(job.country).checklist.slice(),
  };
}
