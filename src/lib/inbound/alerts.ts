// Deterministic first pass over forwarded job-alert emails (Bdjobs, LinkedIn, Bayt, GulfTalent, Naukrigulf, JobStreet,
// SEEK, Indeed, Reed). Pulls each job's title, company, location, deadline and job link out of the email itself.
// Nothing here fetches a page: links are only recognised and normalised, never opened.
//
// Tuned on SYNTHETIC alert emails only (src/lib/inbound/__fixtures__). Real portal alert layouts, Bdjobs's in
// particular, still need checking against real samples (see BUILD_NOTES.md).

export interface AlertJob {
  title: string | null;
  company: string | null;
  location: string | null;
  deadline: string | null; // YYYY-MM-DD
  url: string; // canonical job detail URL ("" when the AI fallback found a job without a link from the email)
}
export interface AlertParse { portal: string; jobs: AlertJob[]; jobLinkCount: number }

interface Portal { name: string; domains: RegExp; canonical(u: URL): string | null }

const host = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, "");
const onDomain = (u: URL, re: RegExp) => re.test(host(u));

export const PORTALS: Portal[] = [
  {
    name: "Bdjobs",
    domains: /(^|\.)bdjobs\.com$/,
    canonical(u) {
      // Detail pages seen in the wild use several shapes; accept the ones that carry a numeric job id:
      //   jobs.bdjobs.com/jobdetails.asp?id=1234567, bdjobs.com/jobs/details/1234567, bdjobs.com/h/details/1234567
      // TODO(bdjobs-alerts): confirm the link shape used in real Bdjobs alert emails.
      const id = u.searchParams.get("id") || u.searchParams.get("jobid") || u.searchParams.get("JobId");
      if (/detail/i.test(u.pathname) && id && /^\d{5,}$/.test(id)) return `https://${u.hostname.toLowerCase()}${u.pathname}?id=${id}`;
      const m = u.pathname.match(/\/(?:[a-z]+\/)*details?\/(\d{5,})(?:\/|$)/i);
      return m ? `https://${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, "")}` : null;
    },
  },
  { name: "LinkedIn", domains: /(^|\.)linkedin\.com$/, canonical: (u) => { const m = u.pathname.match(/\/(?:comm\/)?jobs\/view\/(?:[^/]*?-)?(\d{6,})/); return m ? `https://www.linkedin.com/jobs/view/${m[1]}/` : null; } },
  { name: "Bayt", domains: /(^|\.)bayt\.com$/, canonical: (u) => (/\/jobs\/[^/]+-\d{5,}\/?$/.test(u.pathname) ? `https://www.bayt.com${u.pathname}` : null) },
  { name: "GulfTalent", domains: /(^|\.)gulftalent\.com$/, canonical: (u) => (/\/jobs\/[^/]*-\d{4,}\/?$/.test(u.pathname) ? `https://www.gulftalent.com${u.pathname}` : null) },
  { name: "Naukrigulf", domains: /(^|\.)naukrigulf\.com$/, canonical: (u) => (/-jid-\d{6,}/.test(u.pathname) ? `https://www.naukrigulf.com${u.pathname}` : null) },
  { name: "JobStreet", domains: /(^|\.)jobstreet\.(com|co\.id|com\.my|com\.sg|com\.ph)(\.[a-z]{2})?$/, canonical: (u) => { const m = u.pathname.match(/\/(?:[a-z]{2}\/)?job\/(\d{5,})/); return m ? `https://${u.hostname.toLowerCase()}/job/${m[1]}` : null; } },
  { name: "SEEK", domains: /(^|\.)seek\.(com\.au|co\.nz)$/, canonical: (u) => { const m = u.pathname.match(/\/job\/(\d{5,})/); return m ? `https://${host(u) === "seek.co.nz" ? "www.seek.co.nz" : "www.seek.com.au"}/job/${m[1]}` : null; } },
  {
    name: "Indeed",
    domains: /(^|\.)indeed\.(com|co\.uk|ca|com\.au|ae|com\.my|co\.in)$/,
    canonical: (u) => { const jk = u.searchParams.get("jk") || u.searchParams.get("vjk"); return jk && /^[a-f0-9]{10,20}$/i.test(jk) && /viewjob|\/rc\/clk|\/pagead\/clk|\/m\/|\/jobs/i.test(u.pathname) ? `https://${u.hostname.toLowerCase()}/viewjob?jk=${jk}` : null; },
  },
  { name: "Reed", domains: /(^|\.)reed\.co\.uk$/, canonical: (u) => (/^\/jobs\/[^/]+\/\d{5,}/.test(u.pathname) ? `https://www.reed.co.uk${u.pathname.match(/^\/jobs\/[^/]+\/\d{5,}/)![0]}` : null) },
];

const decodeEntities = (s: string) =>
  s.replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

function tryUrl(s: string): URL | null {
  try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:" ? u : null; } catch { return null; }
}

/**
 * Tracking and redirect links (click trackers, Outlook safelinks, Google redirects, Mailchimp, SendGrid...):
 * when the original URL is carried in a query parameter, use it. Opaque trackers are left as they are.
 */
export function unwrapUrl(raw: string): string {
  let cur = decodeEntities(raw.trim());
  for (let depth = 0; depth < 4; depth++) {
    const u = tryUrl(cur);
    if (!u) return cur;
    if (PORTALS.some((p) => onDomain(u, p.domains) && p.canonical(u))) return cur;
    let next: string | null = null;
    for (const key of ["url", "u", "q", "target", "redirect", "redirect_url", "redir", "dest", "destination", "link", "goto", "to", "r", "l", "href"]) {
      const v = u.searchParams.get(key);
      if (v && /^https?:\/\//i.test(v)) { next = v; break; }
    }
    if (!next) for (const [, v] of u.searchParams) if (/^https?:\/\//i.test(v)) { next = v; break; }
    if (!next) for (const [, v] of u.searchParams) { // base64-wrapped targets
      if (v.length > 16 && /^[A-Za-z0-9+/_-]+=*$/.test(v)) {
        try { const d = atob(v.replace(/-/g, "+").replace(/_/g, "/")); if (/^https?:\/\/[^\s]+$/.test(d)) { next = d; break; } } catch { /* not base64 */ }
      }
    }
    if (!next) return cur;
    cur = next;
  }
  return cur;
}

/** The canonical job detail URL for a link, or null when it is not a job page on a known portal. */
export function jobUrl(raw: string): { url: string; portal: string } | null {
  const u = tryUrl(unwrapUrl(raw));
  if (!u) return null;
  for (const p of PORTALS) if (onDomain(u, p.domains)) { const c = p.canonical(u); return c ? { url: c, portal: p.name } : null; }
  return null;
}

export function portalFromSender(from: string): string | null {
  const m = from.toLowerCase().match(/@([a-z0-9.-]+)/);
  const d = m ? m[1] : "";
  const p = PORTALS.find((x) => x.domains.test(d.replace(/^(mail|email|e|alerts?|jobs?|notify|noreply|info|news|em|mailer)\./, "")) || x.domains.test(d));
  return p?.name ?? null;
}

// ---------------------------------------------------------------------------
// HTML -> lines, anchors
// ---------------------------------------------------------------------------
export function htmlToLines(html: string): string[] {
  return decodeEntities(
    html
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>|<\/(p|li|div|h\d|tr|td|th|table|section|article)>|<(p|li|div|h\d|tr|table)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  ).split("\n").map((l) => l.replace(/[ \t ​‌‍﻿]+/g, " ").trim()).filter(Boolean);
}

interface Anchor { href: string; text: string; start: number; end: number }
function anchors(html: string): Anchor[] {
  const out: Anchor[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const h = m[1].match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!h) continue;
    out.push({ href: h[1] ?? h[2] ?? h[3] ?? "", text: htmlToLines(m[2]).join(" ").trim(), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Field rules
// ---------------------------------------------------------------------------
const GENERIC = /^(view( the)?( job| details| more| all)?|apply( now| here| today)?|see (job|details|more)|details|more|read more|job details|click here|open|easy apply|quick apply|save|share|unsubscribe|manage alerts?|view similar jobs|see all jobs|show all)$/i;
const LABEL = /^(location|salary|deadline|apply by|apply before|last date|closing date|expires?|posted|published|experience|exp\.?|job type|employment type|education|vacancies?|vacancy|age|category|industry|salary range|application deadline|new|be an early applicant|actively recruiting|promoted|recommended|\d+ applicants?)\b/i;
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

/** Parse common alert date formats to YYYY-MM-DD (day-first for numeric dates, as in BD/UK/Gulf alerts). */
export function parseDate(s: string, today: string): string | null {
  const t = s.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1").replace(/,/g, " ").replace(/\s+/g, " ");
  const ty = Number(today.slice(0, 4));
  const ok = (y: number, mo: number, d: number) => (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2000 && y < 2100 ? `${y}-${pad(mo)}-${pad(d)}` : null);
  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = t.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  if (m) return ok(+m[3], +m[2], +m[1]);
  m = t.match(/\b(\d{1,2}) ([a-z]{3,9})\.? (\d{4})\b/);
  if (m && MONTHS[m[2].slice(0, m[2] === "sept" ? 4 : 3)]) return ok(+m[3], MONTHS[m[2].slice(0, 3)], +m[1]);
  m = t.match(/\b([a-z]{3,9})\.? (\d{1,2}) (\d{4})\b/);
  if (m && MONTHS[m[1].slice(0, 3)]) return ok(+m[3], MONTHS[m[1].slice(0, 3)], +m[2]);
  m = t.match(/\b(\d{1,2}) ([a-z]{3,9})\b/) || null;
  const m2 = t.match(/\b([a-z]{3,9}) (\d{1,2})\b/);
  const dm = m && MONTHS[m[2].slice(0, 3)] ? { d: +m[1], mo: MONTHS[m[2].slice(0, 3)] } : m2 && MONTHS[m2[1].slice(0, 3)] ? { d: +m2[2], mo: MONTHS[m2[1].slice(0, 3)] } : null;
  if (dm) { // no year: the next such date on or after today
    let y = ty;
    if (`${y}-${pad(dm.mo)}-${pad(dm.d)}` < today) y++;
    return ok(y, dm.mo, dm.d);
  }
  return null;
}

const DEADLINE_RE = /\b(?:application deadline|deadline|apply (?:by|before)|last date(?: of application| to apply)?|closing(?: date)?|closes(?: on)?|expires?(?: on)?|expiry(?: date)?|apply within)\b\s*[:\-–]?\s*(.{4,40})/i;
export function findDeadline(lines: string[], today: string): string | null {
  for (const l of lines) {
    const m = l.match(DEADLINE_RE);
    if (m) { const d = parseDate(m[1], today); if (d) return d; }
  }
  return null;
}

const labelled = (lines: string[], re: RegExp) => {
  for (const l of lines) { const m = l.match(re); if (m && m[1].trim()) return m[1].trim().replace(/\s+[|·•]\s*$/, ""); }
  return null;
};
const COMPANY_LABEL = /^(?:company(?: name)?|employer|organi[sz]ation|hiring company|recruiter)\s*[:\-–]\s*(.{2,100})$/i;
const LOCATION_LABEL = /^(?:location|job location|city|place)\s*[:\-–]\s*(.{2,80})$/i;
const clean = (s: string | null | undefined) => (s ? s.replace(/\s+/g, " ").replace(/^[\s\-–|·•:]+|[\s\-–|·•:]+$/g, "").trim() || null : null);
const looksLikeDate = (s: string) => /\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/.test(s) || /\b\d{1,2} (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s);
const isNoise = (s: string) => GENERIC.test(s) || LABEL.test(s) || /^https?:\/\//i.test(s) || looksLikeDate(s) || /^[\d\s,.+-]+$/.test(s) || /^(৳|tk\.?|bdt|aed|sar|myr|rm|£|\$|a\$|c\$)\s?\d/i.test(s) || s.length > 110;

/** Company and location from the lines that follow a job's title in the alert. */
export function companyAndLocation(lines: string[], title: string | null, knownCompany: string | null = null): { company: string | null; location: string | null } {
  let company = knownCompany || clean(labelled(lines, COMPANY_LABEL));
  let location = clean(labelled(lines, LOCATION_LABEL));
  const t = (title || "").toLowerCase();
  for (const raw of lines.slice(0, 6)) {
    const l = raw.trim();
    if (!l || l.toLowerCase() === t || isNoise(l) || COMPANY_LABEL.test(l) || LOCATION_LABEL.test(l)) continue;
    // "Company · Location" / "Company | Location" / "Company - Location" (LinkedIn, Bayt, SEEK style lines)
    const parts = l.split(/\s+[·•|]\s+|\s+[-–]\s+(?=[A-Z])/).map((x) => x.trim()).filter(Boolean);
    if (!company) { company = clean(parts[0]); if (!location && parts[1] && !isNoise(parts[1])) location = clean(parts[1]); continue; }
    if (!location && parts.length === 1 && l.length <= 60 && /^[A-Z][\w .,'()/-]+$/.test(l)) location = clean(l);
    if (company && location) break;
  }
  return { company: company ? company.slice(0, 200) : null, location: location ? location.slice(0, 120) : null };
}

const titleOk = (s: string | null | undefined) => !!s && s.length >= 3 && s.length <= 140 && !GENERIC.test(s.trim()) && !/^https?:\/\//i.test(s);

/** "Accountant at Acme Ltd" / "Accountant - Acme Ltd" titles some alerts use. */
function splitTitle(title: string): { title: string; company: string | null } {
  const m = title.match(/^(.{3,100}?)\s+(?:at|@)\s+(.{2,80})$/);
  return m ? { title: m[1].trim(), company: m[2].trim() } : { title, company: null };
}

const norm = (s: string | null) => (s || "").toLowerCase().replace(/&/g, "and").replace(/\b(ltd|limited|plc|llc|inc|co|company|pvt|private|group)\b\.?/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export const titleCompanyKey = (j: { title: string | null; company: string | null }) => (j.title && j.company ? `${norm(j.title)}|${norm(j.company)}` : null);

/** Remove duplicates by URL, then by (title, company). Keeps the first, filling its gaps from later copies. */
export function dedupeJobs(jobs: AlertJob[]): AlertJob[] {
  const byUrl = new Map<string, AlertJob>();
  jobs.forEach((j, i) => {
    const prev = byUrl.get(j.url || `#${i}`); // jobs without a link are only deduped by (title, company)
    if (!prev) byUrl.set(j.url || `#${i}`, { ...j });
    else for (const k of ["title", "company", "location", "deadline"] as const) prev[k] = prev[k] ?? j[k];
  });
  const seen = new Set<string>();
  const out: AlertJob[] = [];
  for (const j of byUrl.values()) {
    const key = titleCompanyKey(j);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(j);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------
export function parseAlert(input: { from: string; subject: string; html?: string | null; text?: string | null; today: string }): AlertParse {
  const jobs: AlertJob[] = [];
  const portalCounts = new Map<string, number>();
  const count = (p: string) => portalCounts.set(p, (portalCounts.get(p) || 0) + 1);
  const html = input.html || "";
  let jobLinkCount = 0;

  if (html) {
    const as = anchors(html).map((a) => ({ ...a, job: jobUrl(a.href) }));
    const jobAs = as.filter((a) => a.job);
    jobLinkCount = jobAs.length;
    // Group consecutive anchors that point at the same job (image link, title link, "View job" button).
    const groups: { url: string; portal: string; anchors: typeof jobAs }[] = [];
    for (const a of jobAs) {
      const g = groups.find((x) => x.url === a.job!.url);
      if (g) g.anchors.push(a);
      else groups.push({ url: a.job!.url, portal: a.job!.portal, anchors: [a] });
    }
    groups.forEach((g, i) => {
      count(g.portal);
      const titleAnchor = g.anchors.find((a) => titleOk(a.text));
      const from = (titleAnchor || g.anchors[0]).end;
      // Context: from the title link to the start of the next job's first link.
      const next = groups[i + 1]?.anchors[0]?.start ?? Math.min(html.length, from + 4000);
      const ctxLines = htmlToLines(html.slice(from, Math.max(from, next)));
      let title = titleAnchor ? titleAnchor.text : null;
      let company: string | null = null;
      if (title) ({ title, company } = splitTitle(title));
      if (!title) {
        // Image-only links: the title is usually the first strong line after the link.
        const first = ctxLines.find((l) => titleOk(l) && !isNoise(l));
        title = first || null;
      }
      const cl = companyAndLocation(ctxLines.filter((l) => l !== title), title, company);
      jobs.push({ title: title ? title.slice(0, 200) : null, company: cl.company, location: cl.location, deadline: findDeadline(ctxLines, input.today), url: g.url });
    });
  } else if (input.text) {
    // Plain-text alerts: "Title\nCompany\nLocation\nhttps://..." blocks.
    const lines = input.text.split(/\r?\n/).map((l) => l.trim());
    const idx = lines.map((l, i) => ({ l, i, urls: l.match(/https?:\/\/[^\s<>")\]]+/g) || [] })).filter((x) => x.urls.some((u) => jobUrl(u)));
    jobLinkCount = idx.length;
    const linkLines = new Set(idx.map((x) => x.i));
    idx.forEach((x) => {
      const j = jobUrl(x.urls.find((u) => jobUrl(u))!)!;
      count(j.portal);
      // The block for a link is the paragraph that ends at it (blank line or previous job link above),
      // or, when the link stands first, the paragraph that follows it.
      const before: string[] = [];
      for (let i = x.i - 1; i >= 0 && lines[i] && !linkLines.has(i); i--) before.unshift(lines[i]);
      const after: string[] = [];
      for (let i = x.i + 1; i < lines.length && lines[i] && !linkLines.has(i); i++) after.push(lines[i]);
      const inline = x.l.replace(/https?:\/\/\S+/g, "").replace(/[:\-–|]+\s*$/, "").trim();
      const block = [...(inline ? [inline] : []), ...(before.length ? before : after)];
      const titleLine = block.find((l) => titleOk(l) && !isNoise(l)) || null;
      const st = titleLine ? splitTitle(titleLine) : { title: null, company: null };
      const rest = block.slice(titleLine ? block.indexOf(titleLine) + 1 : 0);
      const cl = companyAndLocation(rest, st.title, st.company);
      jobs.push({ title: st.title, company: cl.company, location: cl.location, deadline: findDeadline(block, input.today), url: j.url });
    });
  }

  const sender = portalFromSender(input.from);
  const top = [...portalCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { portal: sender || top || "Job alert", jobs: dedupeJobs(jobs).slice(0, 50), jobLinkCount };
}

/** True when an email looks like a job alert even though no job links were recognised (AI fallback worth trying). */
export function looksLikeAlert(subject: string, from: string, text: string): boolean {
  return !!portalFromSender(from) || /\b(job alert|new jobs?|jobs? for you|recommended jobs?|jobs? matching|vacanc|hiring)\b/i.test(subject + " " + text.slice(0, 2000));
}
