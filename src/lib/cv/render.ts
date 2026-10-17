// CV rendering: the three prototype templates (modern sidebar, executive band, classic ATS-safe)
// as one pure HTML-string renderer used for the on-screen preview, the print-to-PDF page and the .doc export.
// All user content is HTML-escaped here.
import { cc, cname, isAccent, isTemplate, rule, ACCENTS, HOME_COUNTRY, type CountryCode, type CvTemplate } from "../countries";
import { fmtYM } from "../dates";
import type { ApplicationPack, CvStyle, MasterCV, PersonalDetails } from "../types";

export const esc = (s: unknown) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function resolveStyle(style: CvStyle | null | undefined, country: CountryCode | string): { tpl: CvTemplate; accent: string } {
  const st = style || {};
  return { tpl: isTemplate(st.tpl) ? st.tpl : rule(country).tpl, accent: isAccent(st.accent) ? st.accent : ACCENTS[0][0] };
}

export function initials(n: string) {
  return String(n || "").replace(/^(md\.?|mohammad|muhammad)\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
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
  const { master: m, tailored: t, forDoc } = inp;
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
