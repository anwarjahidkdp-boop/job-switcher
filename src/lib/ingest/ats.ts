// Public ATS job-board JSON endpoints (no login, published for job boards to consume).
import { normaliseJobText, stripHtml } from "../jobs";
import { cc, type CountryCode } from "../countries";
import { countryFromLocation } from "./jsonld";
import type { Job } from "../types";

export type IngestedJob = Omit<Job, "id"> & { externalId: string; description: string };

export const greenhouseUrl = (token: string) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
export const leverUrl = (slug: string) => `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;

interface GreenhouseJob { id: number | string; title: string; absolute_url?: string; updated_at?: string; first_published?: string; location?: { name?: string }; content?: string; company_name?: string }

export function parseGreenhouse(json: unknown, ctx: { country: CountryCode; company: string; sourceLabel: string; today: string }): IngestedJob[] {
  const jobs = ((json as { jobs?: GreenhouseJob[] })?.jobs || []) as GreenhouseJob[];
  return jobs.filter((j) => j && j.title).map((j) => {
    // Greenhouse returns HTML-escaped HTML in `content`.
    const description = stripHtml(stripHtml(String(j.content || "")).replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
    const loc = j.location?.name || null;
    const job = normaliseJobText({ title: j.title, company: j.company_name || ctx.company, text: description, country: cc(countryFromLocation(loc, ctx.country)), location: loc, url: j.absolute_url || null, source: ctx.sourceLabel, publishedAt: (j.first_published || j.updated_at || "").slice(0, 10) || null, today: ctx.today });
    return { ...job, externalId: "gh:" + j.id, description };
  });
}

interface LeverJob { id: string; text: string; hostedUrl?: string; applyUrl?: string; createdAt?: number; categories?: { location?: string; commitment?: string; team?: string; allLocations?: string[] }; descriptionPlain?: string; description?: string; lists?: { text: string; content: string }[]; additionalPlain?: string; workplaceType?: string; salaryRange?: { min?: number; max?: number; currency?: string } }

export function parseLever(json: unknown, ctx: { country: CountryCode; company: string; sourceLabel: string; today: string }): IngestedJob[] {
  const jobs = (Array.isArray(json) ? json : []) as LeverJob[];
  return jobs.filter((j) => j && j.text).map((j) => {
    const lists = (j.lists || []).map((l) => `${l.text}\n${stripHtml(l.content || "")}`).join("\n");
    const description = [j.descriptionPlain || stripHtml(j.description || ""), lists, j.additionalPlain || ""].filter(Boolean).join("\n");
    const loc = j.categories?.location || j.categories?.allLocations?.join(" / ") || (j.workplaceType === "remote" ? "Remote" : null);
    const job = normaliseJobText({ title: j.text, company: ctx.company, text: description, country: cc(countryFromLocation(loc, ctx.country)), location: loc, type: j.categories?.commitment || null, url: j.hostedUrl || j.applyUrl || null, source: ctx.sourceLabel, publishedAt: j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : null, salaryMin: j.salaryRange?.min ?? null, salaryMax: j.salaryRange?.max ?? null, today: ctx.today });
    return { ...job, externalId: "lever:" + j.id, description };
  });
}
