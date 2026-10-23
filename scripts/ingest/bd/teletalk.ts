import { normaliseJobText } from '../../../src/lib/jobs';
import { sourceDate } from './dates';
import type { DiscoveredJob } from './parse';
import type { BangladeshBatch, PublicReader } from './fetch';

const ORIGIN = 'https://alljobs.teletalk.com.bd';
const LIST = ORIGIN + '/api/v1/govt-jobs/org-list';
interface GovernmentJob {
  id: number; job_title: string; job_title_bn?: string; organization_id: number;
  deadline_date?: string; published_date?: string; advertisement_published_date?: string;
  application_site?: string; advertisement_file?: string; vacancy?: string; min_age?: number; max_age?: number;
  is_result?: boolean; is_notice?: boolean; status?: number;
  job_utilities_govtorganization?: { name?: string; name_bn?: string };
}
export function teletalkJob(d: GovernmentJob, today: string): DiscoveredJob | null {
  const deadline = sourceDate(d.deadline_date), company = d.job_utilities_govtorganization?.name || d.job_utilities_govtorganization?.name_bn;
  if (!Number.isSafeInteger(d.id) || !Number.isSafeInteger(d.organization_id) || !d.job_title || !company || !deadline || deadline < today || d.is_result || d.is_notice || d.status !== 5) return null;
  const url = `${ORIGIN}/jobs/government/${d.organization_id}?jobId=${d.id}`;
  let apply: string | null = null;
  try { const u = new URL(d.application_site || ''); if (/^https?:$/.test(u.protocol) && !u.username && !u.password) apply = u.href; } catch { /* missing application link */ }
  const description = [d.job_title, d.job_title_bn, company, d.vacancy ? `Vacancies: ${d.vacancy}` : '',
    d.min_age != null || d.max_age != null ? `Age limits: ${d.min_age ?? 'not stated'}–${d.max_age ?? 'not stated'}` : '',
    sourceDate(d.published_date) ? `Applications start: ${sourceDate(d.published_date)}` : '', `Application deadline: ${deadline}`,
    'Full education, experience and other eligibility requirements are in the official circular. Review the original advertisement before applying. These requirements have not been inferred from the employer profile.'
  ].filter(Boolean).join('\n');
  const job = normaliseJobText({ title: d.job_title, company, country: 'BD', text: description, url, source: 'Alljobs Teletalk', deadline, publishedAt: sourceDate(d.advertisement_published_date), today });
  // The API does not expose full requirements or work location; never derive them from the employer's history or age limits.
  job.minYears = null; job.maxYears = null; job.education = null; job.location = null;
  job.apply = { method: 'portal', target: apply || url };
  return { ...job, description, externalId: `govt-${d.id}`, discovery: { url, originalUrl: url, source: 'Alljobs Teletalk', evidence: 'structured' } };
}

/** The anonymous JSON endpoints used by Teletalk's public site. Never sends an account token. */
export async function fetchTeletalk(reader: PublicReader, today: string, opts: { cursor?: string | null; pages?: number; retryUrls?: string[] }): Promise<BangladeshBatch> {
  const result: BangladeshBatch = { jobs: [], documents: [], checkedUrls: [], nextUrl: null, pages: 0, failures: 0 };
  let resume = 2;
  if (opts.cursor) {
    const u = new URL(opts.cursor);
    if (u.origin !== ORIGIN || u.pathname !== '/api/v1/govt-jobs/org-list' || !/^\d+$/.test(u.searchParams.get('page') || '')) throw new Error('Invalid Teletalk cursor');
    resume = Math.max(2, Number(u.searchParams.get('page')));
  }
  const max = Math.min(10, Math.max(1, opts.pages || 4));
  const seen = new Set<number>();
  let page = 1;
  while (result.pages < max) {
    const data = JSON.parse(await reader.html(`${LIST}?page=${page}&limit=20`));
    if (data.status !== 'success' || !Array.isArray(data.govtOrgJobs) || !Number.isFinite(data.count)) throw new Error('Invalid Teletalk public organization listing');
    result.pages++;
    const postings: { id: number; org: number }[] = data.govtOrgJobs.flatMap((o: { id: number; govt_jobs?: { id: number }[] }) => (o.govt_jobs || []).map(j => ({ id: j.id, org: o.id })));
    if (page === 1) for (const raw of (opts.retryUrls || []).slice(0, 20)) {
      try { const u = new URL(raw); const org = u.pathname.match(/^\/jobs\/government\/(\d+)$/); const id = u.searchParams.get('jobId');
        if (u.origin === ORIGIN && org && id && /^\d+$/.test(id)) postings.push({ id: Number(id), org: Number(org[1]) });
      } catch { /* invalid persisted retry URL */ }
    }
    if (postings.length > 700 || postings.some(p => !Number.isSafeInteger(p.id) || !Number.isSafeInteger(p.org))) throw new Error('Invalid Teletalk public posting identity');
    const unique = postings.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
    for (let at = 0; at < unique.length; at += 2) await Promise.all(unique.slice(at, at + 2).map(async p => {
      const url = `${ORIGIN}/jobs/government/${p.org}?jobId=${p.id}`;
      try {
        const payload = JSON.parse(await reader.html(`${ORIGIN}/api/v1/govt-jobs/public-details?id=${p.id}`));
        if (payload.status !== 'success' || payload.details?.id !== p.id) throw new Error('Invalid Teletalk public detail');
        const job = teletalkJob(payload.details, today);
        if (job) result.jobs.push(job);
        result.checkedUrls.push(url);
      } catch (e) {
        result.failures++;
        result.documents.push({ url, title: 'Teletalk public circular', kind: 'article', reason: String(e).slice(0, 300), publishedAt: null, state: 'fetch_failed' });
      }
    }));
    const next = page === 1 ? resume : page + 1;
    result.nextUrl = next <= Math.ceil(data.count / 20) ? `${LIST}?page=${next}&limit=20` : null;
    if (!result.nextUrl) break;
    page = next;
  }
  result.jobs = [...new Map(result.jobs.map(j => [j.externalId, j])).values()];
  return result;
}
