// More public job sources: ATS job-board APIs that companies publish for job boards to read, and job-search APIs
// that invite third-party apps (free keys where needed). No login, no scraping of sites that forbid it, no Bdjobs.
import { normaliseJobText, stripHtml } from "../jobs";
import { cc, isCountry, type CountryCode } from "../countries";
import { WORLD_BY_CODE } from "../world";
import { countryFromLocation } from "./jsonld";
import type { IngestedJob } from "./ats";

type Ctx = { country: CountryCode; company: string; sourceLabel: string; today: string };
const day = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** ISO 3166 alpha-2 (any case) or a country name to a country code; anything unrecognised is "Other" (XX). */
export function isoToCountry(code: unknown, loc?: string | null, fallback: CountryCode = "XX"): CountryCode {
  const c = str(code).trim().toUpperCase();
  if (c === "UK") return "GB";
  if (c.length === 2 && c !== "XX" && isCountry(c)) return c;
  const byText = countryFromLocation([str(code), loc || ""].filter(Boolean).join(", ") || null, "XX");
  if (byText !== "XX") return byText;
  return c.length === 2 ? "XX" : fallback;
}

function job(ctx: Ctx, x: { id: string; title: string; company?: string; text: string; country: CountryCode; location?: string | null; type?: string | null; url?: string | null; published?: string | null; salaryMin?: number | null; salaryMax?: number | null }): IngestedJob {
  const j = normaliseJobText({ title: x.title, company: x.company || ctx.company, text: x.text, country: x.country, location: x.location ?? null, type: x.type ?? null, url: x.url ?? null, source: ctx.sourceLabel, publishedAt: x.published ?? null, salaryMin: x.salaryMin ?? null, salaryMax: x.salaryMax ?? null, today: ctx.today });
  return { ...j, externalId: x.id, description: x.text };
}

// --- Ashby: https://developers.ashbyhq.com/docs/public-job-posting-api -------------------------------------------
export const ashbyUrl = (org: string) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}?includeCompensation=true`;
interface AshbyJob { id: string; title: string; location?: string; employmentType?: string; isRemote?: boolean; publishedAt?: string; jobUrl?: string; applyUrl?: string; descriptionPlain?: string; descriptionHtml?: string; address?: { postalAddress?: { addressCountry?: string; addressLocality?: string } }; isListed?: boolean }
export function parseAshby(json: unknown, ctx: Ctx): IngestedJob[] {
  const jobs = ((json as { jobs?: AshbyJob[] })?.jobs || []).filter((j) => j && j.title && j.isListed !== false);
  return jobs.map((j) => {
    const pa = j.address?.postalAddress;
    const loc = [j.location, pa?.addressLocality, pa?.addressCountry].filter(Boolean).join(", ") || (j.isRemote ? "Remote" : null);
    return job(ctx, { id: "ashby:" + j.id, title: j.title, text: j.descriptionPlain || stripHtml(j.descriptionHtml || ""), country: isoToCountry(pa?.addressCountry, loc, ctx.country), location: loc, type: j.employmentType || null, url: j.jobUrl || j.applyUrl || null, published: day(j.publishedAt) });
  });
}

// --- SmartRecruiters: https://developers.smartrecruiters.com/docs/posting-api ----------------------------------------
export const smartRecruitersUrl = (company: string) => `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings?limit=100`;
interface SrPosting { id: string; name: string; releasedDate?: string; location?: { city?: string; country?: string; remote?: boolean; fullLocation?: string }; typeOfEmployment?: { label?: string }; company?: { name?: string; identifier?: string }; ref?: string; jobAd?: { sections?: Record<string, { text?: string }> } }
export function parseSmartRecruiters(list: unknown, details: Record<string, unknown>, ctx: Ctx): IngestedJob[] {
  const rows = ((list as { content?: SrPosting[] })?.content || []).filter((p) => p && p.name);
  return rows.map((p) => {
    const d = (details[p.id] || p) as SrPosting;
    const text = Object.values(d.jobAd?.sections || {}).map((s) => stripHtml(s?.text || "")).filter(Boolean).join("\n") || p.name;
    const loc = p.location?.fullLocation || [p.location?.city, p.location?.country?.toUpperCase()].filter(Boolean).join(", ") || (p.location?.remote ? "Remote" : null);
    const slug = p.company?.identifier || ctx.company;
    return job(ctx, { id: "sr:" + p.id, title: p.name, company: p.company?.name, text, country: isoToCountry(p.location?.country, loc, ctx.country), location: loc, type: p.typeOfEmployment?.label || null, url: `https://jobs.smartrecruiters.com/${encodeURIComponent(slug)}/${encodeURIComponent(p.id)}`, published: day(p.releasedDate) });
  });
}

// --- Workable: public widget API (the one embedded in companies' own careers pages) ---------------------------------
export const workableUrl = (account: string) => `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(account)}?details=true`;
interface WorkableJob { title: string; shortcode: string; employment_type?: string; country?: string; country_code?: string; city?: string; state?: string; telecommuting?: boolean; url?: string; shortlink?: string; application_url?: string; published_on?: string; created_at?: string; description?: string; requirements?: string; benefits?: string; locations?: { country?: string; countryCode?: string; city?: string }[] }
export function parseWorkable(json: unknown, ctx: Ctx): IngestedJob[] {
  const o = json as { name?: string; jobs?: WorkableJob[] };
  return (o?.jobs || []).filter((j) => j && j.title).map((j) => {
    const l0 = j.locations?.[0];
    const loc = [j.city || l0?.city, j.state, j.country || l0?.country].filter(Boolean).join(", ") || (j.telecommuting ? "Remote" : null);
    const text = [j.description, j.requirements, j.benefits].map((x) => stripHtml(x || "")).filter(Boolean).join("\n") || j.title;
    return job(ctx, { id: "workable:" + j.shortcode, title: j.title, company: o.name, text, country: isoToCountry(j.country_code || l0?.countryCode || j.country, loc, ctx.country), location: loc, type: j.employment_type || null, url: j.url || j.shortlink || j.application_url || null, published: day(j.published_on || j.created_at) });
  });
}

// --- Recruitee: public careers-site API -----------------------------------------------------------------------------
export const recruiteeUrl = (company: string) => `https://${encodeURIComponent(company)}.recruitee.com/api/offers/`;
interface RecruiteeOffer { id: number; title: string; description?: string; requirements?: string; location?: string; city?: string; country?: string; country_code?: string; remote?: boolean; careers_url?: string; published_at?: string; employment_type_code?: string; company_name?: string; min_hours?: number }
export function parseRecruitee(json: unknown, ctx: Ctx): IngestedJob[] {
  return ((json as { offers?: RecruiteeOffer[] })?.offers || []).filter((j) => j && j.title).map((j) => {
    const loc = j.location || [j.city, j.country].filter(Boolean).join(", ") || (j.remote ? "Remote" : null);
    const text = [j.description, j.requirements].map((x) => stripHtml(x || "")).filter(Boolean).join("\n") || j.title;
    return job(ctx, { id: "recruitee:" + j.id, title: j.title, company: j.company_name, text, country: isoToCountry(j.country_code || j.country, loc, ctx.country), location: loc, type: j.employment_type_code || null, url: j.careers_url || null, published: day(j.published_at) });
  });
}

// --- Remotive: https://remotive.com/api-documentation (remote jobs; link back to Remotive) ----------------------------
export const remotiveUrl = (category: string) => `https://remotive.com/api/remote-jobs${category ? `?category=${encodeURIComponent(category)}` : ""}`;
interface RemotiveJob { id: number; url: string; title: string; company_name: string; category?: string; job_type?: string; publication_date?: string; candidate_required_location?: string; salary?: string; description?: string }
export function parseRemotive(json: unknown, ctx: Ctx): IngestedJob[] {
  return ((json as { jobs?: RemotiveJob[] })?.jobs || []).filter((j) => j && j.title).map((j) => {
    const where = j.candidate_required_location || "Worldwide";
    return job(ctx, { id: "remotive:" + j.id, title: j.title, company: j.company_name, text: stripHtml(j.description || "") || j.title, country: countryFromLocation(where, "XX"), location: `Remote (${where})`, type: j.job_type || null, url: j.url, published: day(j.publication_date) });
  });
}

// --- Arbeitnow: https://www.arbeitnow.com/api/job-board-api (free; mostly Europe) ---------------------------------------
export const arbeitnowUrl = (page: number) => `https://www.arbeitnow.com/api/job-board-api?page=${page}`;
interface ArbeitnowJob { slug: string; company_name: string; title: string; description?: string; remote?: boolean; url: string; location?: string; job_types?: string[]; created_at?: number }
export function parseArbeitnow(json: unknown, ctx: Ctx): IngestedJob[] {
  return ((json as { data?: ArbeitnowJob[] })?.data || []).filter((j) => j && j.title).map((j) => job(ctx, {
    id: "arbeitnow:" + j.slug, title: j.title, company: j.company_name, text: stripHtml(j.description || "") || j.title, country: countryFromLocation(j.location, "XX"),
    location: j.remote ? `${j.location || ""} (remote)`.trim() : j.location || null, type: j.job_types?.[0] || null, url: j.url, published: j.created_at ? new Date(j.created_at * 1000).toISOString().slice(0, 10) : null,
  }));
}

// --- Adzuna: https://developer.adzuna.com (free app id + key; US, UK, Canada, Australia and more; not BD or the Gulf) --
export const ADZUNA_COUNTRIES: Partial<Record<CountryCode, string>> = Object.fromEntries(["US", "GB", "CA", "AU", "AT", "BE", "BR", "CH", "DE", "ES", "FR", "IN", "IT", "MX", "NL", "NZ", "PL", "SG", "ZA"].map((c) => [c, c.toLowerCase()]));
export const adzunaUrl = (country: string, appId: string, appKey: string, page: number, what: string) =>
  `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}&results_per_page=50&max_days_old=3&content-type=application/json${what ? `&what=${encodeURIComponent(what)}` : ""}`;
interface AdzunaJob { id: string; title: string; description?: string; redirect_url?: string; created?: string; company?: { display_name?: string }; location?: { display_name?: string }; salary_min?: number; salary_max?: number; contract_time?: string }
export function parseAdzuna(json: unknown, ctx: Ctx): IngestedJob[] {
  return ((json as { results?: AdzunaJob[] })?.results || []).filter((j) => j && j.title).map((j) => job(ctx, {
    id: "adzuna:" + j.id, title: stripHtml(j.title), company: j.company?.display_name || "Company not named", text: stripHtml(j.description || "") || j.title, country: ctx.country,
    location: j.location?.display_name || null, type: j.contract_time || null, url: j.redirect_url || null, published: day(j.created), salaryMin: j.salary_min ?? null, salaryMax: j.salary_max ?? null,
  }));
}

// --- Reed: https://www.reed.co.uk/developers/jobseeker (free key, basic auth; UK jobs only) --------------------------
export const reedUrl = (keywords: string, skip: number) => `https://www.reed.co.uk/api/1.0/search?resultsToTake=100&resultsToSkip=${skip}${keywords ? `&keywords=${encodeURIComponent(keywords)}` : ""}`;
interface ReedJob { jobId: number | string; jobTitle: string; employerName?: string; locationName?: string; minimumSalary?: number | null; maximumSalary?: number | null; date?: string; expirationDate?: string; jobDescription?: string; jobUrl?: string }
/** Reed dates are dd/mm/yyyy. */
const ukDay = (s: unknown) => { const m = typeof s === "string" ? s.match(/^(\d{2})\/(\d{2})\/(\d{4})/) : null; return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
export function parseReed(json: unknown, ctx: Ctx): IngestedJob[] {
  return ((json as { results?: ReedJob[] })?.results || []).filter((j) => j && j.jobTitle).map((j) => {
    const out = job(ctx, {
      id: "reed:" + j.jobId, title: stripHtml(j.jobTitle), company: j.employerName || "Company not named", text: stripHtml(j.jobDescription || "") || j.jobTitle, country: "GB",
      location: j.locationName || null, url: j.jobUrl || `https://www.reed.co.uk/jobs/${j.jobId}`, published: ukDay(j.date), salaryMin: j.minimumSalary ?? null, salaryMax: j.maximumSalary ?? null,
    });
    return { ...out, deadline: ukDay(j.expirationDate) ?? out.deadline };
  });
}

// --- Jooble: https://jooble.org/api/about (free key; covers Bangladesh, the Gulf, Malaysia and more) -------------------
export const joobleLocation = (c: CountryCode) => WORLD_BY_CODE[c]?.name || "";
interface JoobleJob { id: string | number; title: string; location?: string; snippet?: string; salary?: string; source?: string; type?: string; link?: string; company?: string; updated?: string }
export function parseJooble(json: unknown, ctx: Ctx): IngestedJob[] {
  return ((json as { jobs?: JoobleJob[] })?.jobs || []).filter((j) => j && j.title).map((j) => job(ctx, {
    id: "jooble:" + j.id, title: stripHtml(j.title), company: j.company || "Company not named", text: stripHtml(j.snippet || "") || j.title, country: cc(countryFromLocation(j.location, ctx.country)),
    location: j.location || null, type: j.type || null, url: j.link || null, published: day(j.updated),
  }));
}
