// schema.org JobPosting extraction from public career pages (JSON-LD in <script type="application/ld+json">).
import { normaliseJobText, stripHtml } from "../jobs";
import { cc, type CountryCode } from "../countries";
import type { Job } from "../types";

export interface JobPosting {
  "@type"?: string | string[];
  title?: string; name?: string; description?: string; datePosted?: string; validThrough?: string; employmentType?: string | string[];
  hiringOrganization?: { name?: string } | string; jobLocation?: unknown; applicantLocationRequirements?: unknown; jobLocationType?: string;
  baseSalary?: { currency?: string; value?: { minValue?: number | string; maxValue?: number | string; value?: number | string; unitText?: string } | number | string };
  url?: string; identifier?: { value?: string } | string; directApply?: boolean; [k: string]: unknown;
}

const isPosting = (o: unknown): o is JobPosting => {
  if (!o || typeof o !== "object") return false;
  const t = (o as JobPosting)["@type"];
  return t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"));
};

function walk(node: unknown, out: JobPosting[]) {
  if (Array.isArray(node)) { node.forEach((n) => walk(n, out)); return; }
  if (!node || typeof node !== "object") return;
  if (isPosting(node)) out.push(node);
  const o = node as Record<string, unknown>;
  if (o["@graph"]) walk(o["@graph"], out);
  if (o.itemListElement) walk(o.itemListElement, out);
  if (o.item) walk(o.item, out);
}

export function extractJobPostings(html: string): JobPosting[] {
  const out: JobPosting[] = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const body = m[1].trim().replace(/^<!--|-->$/g, "");
    try { walk(JSON.parse(body), out); } catch { /* skip invalid blocks */ }
  }
  return out;
}

const COUNTRY_HINTS: [CountryCode, RegExp][] = [
  ["BD", /\b(bangladesh|dhaka|chattogram|chittagong|gazipur|sylhet|khulna|rajshahi|narayanganj)\b|^bd$/i],
  ["AE", /\b(united arab emirates|uae|dubai|abu dhabi|sharjah)\b|^ae$/i],
  ["SA", /\b(saudi arabia|ksa|riyadh|jeddah|dammam)\b|^sa$/i],
  ["MY", /\b(malaysia|kuala lumpur|selangor|penang|johor)\b|^my$/i],
  ["GB", /\b(united kingdom|uk|england|scotland|wales|london|manchester|birmingham)\b|^gb$/i],
  ["CA", /\b(canada|toronto|vancouver|montreal|calgary|ottawa)\b|^ca$/i],
  ["AU", /\b(australia|sydney|melbourne|brisbane|perth)\b|^au$/i],
  ["US", /\b(united states|usa|new york|san francisco|chicago|houston|seattle|remote - us)\b|^us$/i],
];
export function countryFromLocation(loc: string | null | undefined, fallback: CountryCode): CountryCode {
  if (!loc) return fallback;
  return COUNTRY_HINTS.find(([, re]) => re.test(loc))?.[0] ?? fallback;
}

function locationText(jl: unknown): string | null {
  const one = (l: unknown): string => {
    if (!l || typeof l !== "object") return typeof l === "string" ? l : "";
    const a = ((l as { address?: unknown }).address || l) as Record<string, unknown>;
    if (typeof a === "string") return a;
    const country = typeof a.addressCountry === "object" && a.addressCountry ? (a.addressCountry as { name?: string }).name : a.addressCountry;
    return [a.addressLocality, a.addressRegion, country].filter((x) => typeof x === "string" && x).join(", ");
  };
  const s = (Array.isArray(jl) ? jl.map(one) : [one(jl)]).filter(Boolean).join(" / ");
  return s || null;
}

const dateOnly = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
const numOrNull = (v: unknown) => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));

export function postingToJob(p: JobPosting, ctx: { country: CountryCode; companyFallback?: string | null; sourceLabel: string; pageUrl: string; today: string }): (Omit<Job, "id"> & { externalId: string; description: string }) | null {
  const title = String(p.title || p.name || "").trim();
  if (!title) return null;
  const company = (typeof p.hiringOrganization === "string" ? p.hiringOrganization : p.hiringOrganization?.name) || ctx.companyFallback || "";
  const description = stripHtml(String(p.description || ""));
  const loc = locationText(p.jobLocation) || (p.jobLocationType === "TELECOMMUTE" ? "Remote" : null);
  const country = cc(countryFromLocation(loc, ctx.country));
  const bs = p.baseSalary;
  const val = bs && typeof bs === "object" ? bs.value : bs;
  const salaryMin = val && typeof val === "object" ? numOrNull(val.minValue ?? val.value) : numOrNull(val);
  const salaryMax = val && typeof val === "object" ? numOrNull(val.maxValue ?? val.value) : numOrNull(val);
  const url = typeof p.url === "string" && /^https?:\/\//.test(p.url) ? p.url : ctx.pageUrl;
  const externalId = (typeof p.identifier === "object" ? p.identifier?.value : p.identifier) || url + "#" + title;
  const job = normaliseJobText({
    title, company, text: description, country, location: loc, type: Array.isArray(p.employmentType) ? p.employmentType.join(", ") : p.employmentType || null,
    url, source: ctx.sourceLabel, deadline: dateOnly(p.validThrough), publishedAt: dateOnly(p.datePosted), salaryMin, salaryMax, today: ctx.today,
  });
  return { ...job, externalId: String(externalId), description };
}
