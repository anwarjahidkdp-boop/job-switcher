// CV rendering: the three prototype templates (modern sidebar, executive band, classic ATS-safe)
// as one pure HTML-string renderer used for the on-screen preview, the print-to-PDF page and the .doc export.
// All user content is HTML-escaped here.
import { cc, cname, isAccent, isTemplate, rule, ACCENTS, HOME_COUNTRY, type CountryCode, type CvTemplate } from "../countries";
import { fmtYM } from "../dates";
import type { ApplicationPack, CvStyle, MasterCV, PersonalDetails } from "../types";

/**
 * South Asian shorthand amounts written out for an international reader: "2 lacs+" -> "more than 200,000",
 * "1.5 crore" -> "15,000,000". Display only; the stored text is unchanged. Same figure, so no new claim.
 */
const AMT_UNIT: Record<string, number> = { lac: 1e5, lacs: 1e5, lakh: 1e5, lakhs: 1e5, crore: 1e7, crores: 1e7, cr: 1e7 };
export function proAmounts(s: string): string {
  return s.replace(/(\d+(?:\.\d+)?)\s*(lacs?|lakhs?|crores?|cr)\b(\s*\+)?/gi, (_, n: string, u: string, plus?: string) => {
    const v = Math.round(Number(n) * AMT_UNIT[u.toLowerCase()]);
    return Number.isFinite(v) ? `${plus ? "more than " : ""}${v.toLocaleString("en-GB")}` : _;
  });
}

export const esc = (s: unknown) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * The corporate layout is the default everywhere: one ATS-safe column in the restrained style senior finance, legal
 * and management CVs use. The country rules still decide photo, personal details, headings and length.
 */
export const DEFAULT_TPL: CvTemplate = "corporate";
const NAVY = "#1E3A5F";

export function resolveStyle(style: CvStyle | null | undefined, country: CountryCode | string): { tpl: CvTemplate; accent: string } {
  void country;
  const st = style || {};
  const tpl = isTemplate(st.tpl) ? st.tpl : DEFAULT_TPL;
  return { tpl, accent: isAccent(st.accent) ? st.accent : tpl === "corporate" ? NAVY : ACCENTS[0][0] };
}

/** Up to four measurable results already on the CV (a number or %), one per role first, for the highlights block. */
export function careerHighlights(exp: { bullets: string[] }[], max = 4): string[] {
  // A real result: a percentage, money, a large figure or a counted outcome (not "Tally ERP 9" or "Mushak 9.1").
  const measurable = (b: string) => b.length >= 30 && (/\d\s?%|[£$€৳]\s?\d|\b\d{2,}(,\d{3})*\b(?!\.\d)|\b\d+(\.\d+)?\s?(million|lakh|lac|crore|k|m|bn)\b/i.test(b) || /\b\d+\s+(\w+\s)?(staff|people|members|entities|branches|stores|sites|projects|clients|countries|days|weeks|months)\b/i.test(b));
  const out: string[] = [];
  for (const e of exp) { const b = e.bullets.find(measurable); if (b && out.length < max) out.push(b); }
  for (const e of exp) for (const b of e.bullets) if (out.length < max && measurable(b) && !out.includes(b)) out.push(b);
  return out.length >= 2 ? out : [];
}

export function initials(n: string) {
  return String(n || "").replace(/^(md\.?|mohammad|muhammad)\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function polishMaster(m: MasterCV): MasterCV {
  return {
    ...m,
    summary: proAmounts(m.summary || ""),
    experience: (m.experience || []).map((e) => ({ ...e, bullets: (e.bullets || []).map(proAmounts) })),
  };
}

export interface RenderInput {
  master: MasterCV;
  tailored?: Pick<ApplicationPack, "summary" | "top_bullets" | "skills_order"> | null;
  country: CountryCode | string;
  homeCountry?: CountryCode;
  style?: CvStyle | null;
  personal?: PersonalDetails | null;
  /** data: URL or short-lived signed URL. Only shown where the country expects a photo. */
  photoUrl?: string | null;
  /** Word/print-safe markup (tables instead of grid, no placeholders, no highlight marks). */
  forDoc?: boolean;
}

const SAFE_IMG = /^(data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s"'<>]+)$/;

export function renderCvHtml(inp: RenderInput): string {
  const { forDoc } = inp;
  const m = polishMaster(inp.master);
  const t = inp.tailored ? { ...inp.tailored, summary: inp.tailored.summary ? proAmounts(inp.tailored.summary) : inp.tailored.summary, top_bullets: (inp.tailored.top_bullets || []).map(proAmounts) } : inp.tailored;
  const country = cc(inp.country);
  const r = rule(country);
  const { tpl, accent } = resolveStyle(inp.style, country);
  const skills = t && t.skills_order && t.skills_order.length ? t.skills_order : [...(m.skills_core || []), ...(m.skills_tools || [])];
  let exp = (m.experience || []).map((e, i) => ({ ...e, bullets: t && i === 0 && t.top_bullets && t.top_bullets.length ? t.top_bullets : e.bullets || [] }));
  if (r.onePage) exp = exp.map((e, i) => ({ ...e, bullets: e.bullets.slice(0, i === 0 ? 5 : 3) }));
  const pd = inp.personal || {};
  const personal = r.personal ? ([["Nationality", pd.nationality], ["Date of birth", pd.dob], r.visaField ? ["Visa status", pd.visa] : null].filter((x) => x && x[1]) as [string, string][]) : [];
  const contact = String(m.contact || "").split(/\s*·\s*/).filter(Boolean);
  if (country !== (inp.homeCountry || HOME_COUNTRY)) contact.push("Open to relocate to " + cname(country));
  const H = r.doc === "Résumé" ? { sum: "Summary", exp: "Work Experience" } : { sum: "Profile", exp: "Professional Experience" };
  const sumTxt = t && t.summary && t.summary !== m.summary ? (forDoc ? esc(t.summary) : `<mark>${esc(t.summary)}</mark>`) : esc(m.summary);
  const photo = inp.photoUrl && SAFE_IMG.test(inp.photoUrl) ? inp.photoUrl : null;
  const ph = !r.photo ? "" : photo ? `<img class="ph" src="${esc(photo)}" alt="Profile photo" width="104" height="104">` : forDoc ? "" : `<div class="ph ph-empty" title="Add a photo from the toolbar">${esc(initials(m.name))}</div>`;
  const sec = (h: string, body: string) => (body ? `<section class="cs"><h3>${h}</h3>${body}</section>` : "");
  const list = (a: string[] | undefined) => ((a || []).length ? `<ul>${(a || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  const chips = (a: string[]) => (!a.length ? "" : forDoc ? `<p>${a.map(esc).join(" · ")}</p>` : `<div class="cvchips">${a.map((x) => `<span>${esc(x)}</span>`).join("")}</div>`);
  const pers = personal.length ? `<dl class="pd">${personal.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : "";
  const langs = (m.languages || []).length ? `<p>${m.languages.map(esc).join(", ")}</p>` : "";
  const expH = exp.map((e) => {
    const dt = `${fmtYM(e.start)} – ${fmtYM(e.end)}`;
    const co = esc(e.company) + (e.location ? " · " + esc(e.location) : "");
    const head = forDoc
      ? `<table width="100%" cellspacing="0" cellpadding="0"><tr><td><b>${esc(e.title)}</b><br><span class="co">${co}</span></td><td align="right" valign="top" class="dt">${dt}</td></tr></table>`
      : `<div class="rt"><div><b>${esc(e.title)}</b><div class="co">${co}</div></div><span class="dt">${dt}</span></div>`;
    return `<div class="role">${head}<ul>${e.bullets.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  }).join("");
  const nameBlock = `<h2>${esc(m.name)}</h2><p class="hl">${esc(m.headline || "")}</p>`;
  const acc = esc(accent);

  if (tpl === "corporate") {
    const hi = careerHighlights(exp);
    // Results moved into the highlights are not repeated under the role.
    const expC = hi.length ? exp.map((e) => ({ ...e, bullets: e.bullets.filter((b) => !hi.includes(b)) })) : exp;
    // Roles held one after another at the same employer (a promotion) sit under one employer heading.
    const groups: { company: string; location: string | null; roles: typeof expC }[] = [];
    for (const e of expC) {
      const g = groups[groups.length - 1];
      if (g && g.company.trim().toLowerCase() === String(e.company || "").trim().toLowerCase()) g.roles.push(e);
      else groups.push({ company: e.company, location: e.location ?? null, roles: [e] });
    }
    const span = (rs: typeof expC) => { const st = rs.map((r) => r.start).filter(Boolean).sort()[0] || null; const en = rs.some((r) => !r.end) ? null : rs.map((r) => r.end).filter(Boolean).sort().slice(-1)[0] || null; return `${fmtYM(st)} – ${fmtYM(en)}`; };
    const line = (title: string, dt: string, cls: string) => forDoc
      ? `<table width="100%" cellspacing="0" cellpadding="0"><tr><td><b class="${cls}">${title}</b></td><td align="right" class="dt">${dt}</td></tr></table>`
      : `<div class="rt"><b class="${cls}">${title}</b><span class="dt">${dt}</span></div>`;
    const bl = (b: string[]) => (b.length ? `<ul>${b.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
    const roles = groups.map((g) => {
      const co = esc(g.company) + (g.location ? `, ${esc(g.location)}` : "");
      if (g.roles.length === 1) { const e = g.roles[0]; return `<div class="role">${line(esc(e.title), `${fmtYM(e.start)} – ${fmtYM(e.end)}`, "rtl")}<p class="co">${co}</p>${bl(e.bullets)}</div>`; }
      return `<div class="role grp">${line(co, span(g.roles), "co co-h")}${g.roles.map((e) => `<div class="sub">${line(esc(e.title), `${fmtYM(e.start)} – ${fmtYM(e.end)}`, "rtl")}${bl(e.bullets)}</div>`).join("")}</div>`;
    }).join("");
    const expertise = !skills.length ? "" : forDoc
      ? `<p>${skills.map(esc).join(" &nbsp;|&nbsp; ")}</p>`
      : `<ul class="aoe">${skills.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    const head = forDoc
      ? `<table width="100%" cellspacing="0" cellpadding="0"><tr><td valign="top">${nameBlock}<p class="ct">${contact.map(esc).join(" &nbsp;|&nbsp; ")}</p></td>${ph ? `<td align="right" valign="top" width="96">${ph}</td>` : ""}</tr></table>`
      : `<div class="hd"><div>${nameBlock}<p class="ct">${contact.map((x) => `<span>${esc(x)}</span>`).join("")}</p></div>${ph}</div>`;
    const langList = (m.languages || []).length ? `<ul class="plain">${m.languages.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : "";
    const tail = `${sec("Languages", langList)}${sec("Personal details", pers)}`;
    // Country conventions: referees in Australia and New Zealand, the GDPR consent line in Italy.
    const extra = (country === "AU" || country === "NZ" ? sec("Referees", "<p>Available on request.</p>") : "")
      + (country === "IT" ? `<p class="gdpr">Autorizzo il trattamento dei dati personali contenuti nel mio curriculum vitae ai sensi del Regolamento UE 2016/679 (GDPR).</p>` : "");
    const body = `${sec(r.doc === "Résumé" ? "Executive Summary" : "Executive Profile", `<p>${sumTxt}</p>`).replace('class="cs"', 'class="cs sum"')}`
      + `${hi.length ? sec("Career Highlights", `<ul class="hi">${hi.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`) : ""}`
      + `${sec("Areas of Expertise", expertise)}${sec(H.exp, roles)}${sec("Education", list(m.education))}${sec("Professional Qualifications", list(m.certifications))}`
      + (forDoc ? tail : tail ? `<div class="two">${tail}</div>` : "") + extra;
    if (forDoc) return `<div class="corp">${head}<hr>${body}</div>`;
    return `<article class="cv t-corp" style="--cva:${acc}"><header>${head}</header>${body}</article>`;
  }
  if (tpl === "modern") {
    const side = `${ph}${sec("Contact", contact.map((x) => `<p>${esc(x)}</p>`).join(""))}${sec("Skills", chips(skills))}${sec("Languages", langs)}${sec("Personal details", pers)}`;
    const main = `<header>${nameBlock}</header>${sec(H.sum, `<p>${sumTxt}</p>`)}${sec(H.exp, expH)}${sec("Education", list(m.education))}${sec("Professional qualifications", list(m.certifications))}`;
    if (forDoc) return `<table width="100%" cellspacing="0" cellpadding="0"><tr><td class="sb" width="32%" valign="top" style="background:${acc};padding:18pt 14pt">${side}</td><td valign="top" style="padding:18pt 18pt">${main}</td></tr></table>`;
    return `<article class="cv t-modern" style="--cva:${acc}"><aside class="sb">${side}</aside><div class="mn">${main}</div></article>`;
  }
  if (tpl === "executive") {
    const band = `${ph}<div>${nameBlock}<p class="ct">${contact.map(esc).join(" · ")}</p></div>`;
    const body = `${sec(H.sum, `<p>${sumTxt}</p>`)}${sec("Core skills", chips(skills))}${sec(H.exp, expH)}<div class="two">${sec("Education", list(m.education))}${sec("Professional qualifications", list(m.certifications))}</div>${sec("Languages", langs)}${sec("Personal details", pers)}`;
    if (forDoc) return `<table width="100%" cellspacing="0" cellpadding="0"><tr><td class="band" style="background:${acc};padding:16pt 18pt">${band}</td></tr></table><div style="padding:0 6pt">${body}</div>`;
    return `<article class="cv t-exec" style="--cva:${acc}"><header class="band">${band}</header><div class="body">${body}</div></article>`;
  }
  const inner = `<header>${ph}${nameBlock}<p class="ct">${contact.map(esc).join(" · ")}</p></header>${sec(H.sum, `<p>${sumTxt}</p>`)}${sec(H.exp, expH)}${sec("Education", list(m.education))}${sec("Professional qualifications", list(m.certifications))}${sec("Skills", skills.length ? `<p>${skills.map(esc).join(" · ")}</p>` : "")}${sec("Languages", langs)}${sec("Personal details", pers)}`;
  return forDoc ? `<div class="classic">${inner}</div>` : `<article class="cv t-classic" style="--cva:${acc}">${inner}</article>`;
}
