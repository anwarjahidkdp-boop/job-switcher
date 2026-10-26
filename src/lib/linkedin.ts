// "Update your LinkedIn profile": every LinkedIn section written from the person's verified Master CV, within
// LinkedIn's length limits. LinkedIn does not let other apps edit a profile, so the person copies each part in.
// No AI call and nothing new is invented: it only re-arranges what the CV already says.
import { cname, cc } from "./countries";
import type { MasterCV } from "./types";

export const LI_LIMITS = { headline: 220, about: 2600, experience: 2000, skills: 50, titles: 5 } as const;

export interface LinkedinRole { title: string; company: string; location: string | null; dates: string; description: string }
export interface LinkedinKit {
  headline: string;
  about: string;
  experience: LinkedinRole[];
  skills: string[];
  /** The skills worth pinning at the top of the Skills section. */
  topSkills: string[];
  education: string[];
  certifications: string[];
  languages: string[];
  openTo: { titles: string[]; location: string; mode: string | null };
  tips: string[];
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function ym(s: string | null): string {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(s || "");
  if (!m) return "";
  return m[2] && +m[2] >= 1 && +m[2] <= 12 ? `${MON[+m[2] - 1]} ${m[1]}` : m[1];
}
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const uniq = (xs: string[]) => { const seen = new Set<string>(); return xs.map(clean).filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase())); };

/** Join parts, dropping the last ones until it fits; never cuts a part in the middle. */
function fit(parts: string[], sep: string, max: number): string {
  const p = parts.filter(Boolean);
  while (p.length > 1 && p.join(sep).length > max) p.pop();
  const s = p.join(sep);
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : s;
}

/** Lines are kept whole: once the next line would pass the limit, the rest is left out. */
function fitLines(lines: string[], max: number): string {
  const out: string[] = [];
  for (const l of lines) {
    const next = [...out, l].join("\n");
    if (next.length > max) break;
    out.push(l);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function linkedinKit(m: MasterCV, o: { targetRoles: string[]; country: string; locations?: string[]; mode?: string | null }): LinkedinKit {
  const cur = m.experience[0];
  const segs = m.headline.split(/\s*[·|•]\s*/).map(clean).filter(Boolean);
  const lead = cur && !cur.end ? `${cur.title} at ${cur.company}` : segs[0] || cur?.title || "";
  const strengths = segs.length > 1 ? segs.slice(1) : m.skills_core.slice(0, 3);
  const headline = fit([lead, fit(strengths, " · ", LI_LIMITS.headline)], " | ", LI_LIMITS.headline);

  const skills = uniq([...m.skills_core, ...m.skills_tools, ...(m.extra_skills || [])]).slice(0, LI_LIMITS.skills);
  const topSkills = uniq(m.skills_core).slice(0, 5);
  const titles = uniq(o.targetRoles).slice(0, LI_LIMITS.titles);
  const country = cname(cc(o.country));
  const where = uniq(o.locations || []).slice(0, 3).join(", ") || country;

  const about = fitLines([
    clean(m.summary),
    "",
    ...(topSkills.length ? ["What I bring:", ...uniq(m.skills_core).slice(0, 6).map((s) => `• ${s}`), ""] : []),
    ...(m.skills_tools.length ? [`Tools: ${uniq(m.skills_tools).join(", ")}`, ""] : []),
    ...(m.education[0] ? [`Education: ${clean(m.education[0])}`] : []),
    ...(m.certifications.length ? [`Certifications: ${uniq(m.certifications).join("; ")}`] : []),
    ...(titles.length ? ["", `I'm interested in ${titles.join(", ")} roles in ${where}. Feel free to connect or send me a message.`] : []),
  ], LI_LIMITS.about);

  const experience = m.experience.map((e) => ({
    title: clean(e.title), company: clean(e.company), location: e.location ? clean(e.location) : null,
    dates: [ym(e.start), e.end ? ym(e.end) : e.start ? "Present" : ""].filter(Boolean).join(" – "),
    description: fitLines(e.bullets.map((b) => `• ${clean(b)}`), LI_LIMITS.experience),
  }));

  const code = cc(o.country);
  const tips = [
    "Add a clear, friendly head-and-shoulders photo and a simple banner: a profile without a photo looks unfinished to recruiters.",
    "Pin your top 5 skills in the Skills section, in the order shown here.",
    "Set a custom profile link with your name (Edit public profile & URL), then add it to your CV.",
    "If your current employer can see your profile, set Open to Work to “Recruiters only” and remove the last line of the About text.",
    ...(code === "GB" ? ["A UK CV has no photo, but your LinkedIn profile should have one. Keep both showing the same job titles and dates."] : []),
    ...(code === "BD" ? ["Many Bangladeshi recruiters search LinkedIn in English: keep every section in English and list Bangla and English under Languages."] : []),
  ];

  return {
    headline, about, experience, skills, topSkills,
    education: uniq(m.education), certifications: uniq(m.certifications), languages: uniq(m.languages),
    openTo: { titles, location: where, mode: o.mode && o.mode !== "Any" ? o.mode : null },
    tips,
  };
}

/** Only a public LinkedIn profile link (linkedin.com/in/...); anything else is refused. */
export function linkedinUrl(raw: unknown): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    const host = u.hostname.toLowerCase();
    if (!(host === "linkedin.com" || host.endsWith(".linkedin.com"))) return null;
    const m = /^\/in\/([A-Za-z0-9\-_%]{3,100})\/?$/.exec(u.pathname);
    return m ? `https://www.linkedin.com/in/${m[1]}` : null;
  } catch { return null; }
}
