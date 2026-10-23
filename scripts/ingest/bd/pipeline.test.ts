import { describe, it, expect } from 'vitest';
import { sourceDate } from './dates';
import { BD_SOURCES } from './registry';
import { parseDetail, detailUrls } from './parse';
import { fetchBangladesh, PublicReader } from './fetch';
import { canonicalIdentity } from './identity';

const source = BD_SOURCES.find(s => s.key === 'dohaj')!;
const url = 'https://dohaj.com/job-details/finance-manager-123';
const post = (deadline = '2026-11-01') => `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: 'Finance Manager', hiringOrganization: { name: 'Synthetic Ltd' }, description: 'Manage accounting and finance operations with five years of verified experience.', jobLocation: { address: { addressLocality: 'Dhaka', addressCountry: 'BD' } }, validThrough: deadline, datePosted: '2026-10-20' })}</script>`;
describe('Bangladesh source ingestion', () => {
  it('reads Bengali and English source dates without accepting impossible dates', () => {
    expect(sourceDate('১ নভেম্বর ২০২৬')).toBe('2026-11-01');
    expect(sourceDate('01 Nov 2026')).toBe('2026-11-01');
    expect(sourceDate('31 February 2026')).toBeNull();
  });
  it('keeps structured open jobs and their provenance, rejecting expired circulars', () => {
    const x = parseDetail(post(), url, source, '2026-10-23');
    expect(x.jobs[0]).toMatchObject({ title: 'Finance Manager', company: 'Synthetic Ltd', deadline: '2026-11-01', discovery: { url, evidence: 'structured' } });
    expect(parseDetail(post('2026-10-22'), url, source, '2026-10-23').jobs).toEqual([]);
  });
  it('deduplicates a verified hiring round across portals, keeping unknown companies separate', () => {
    const j = parseDetail(post(), url, source, '2026-10-23').jobs[0];
    expect(canonicalIdentity(j, 'one')).toBe(canonicalIdentity({ ...j, externalId: 'different', company: 'Synthetic Limited' }, 'two'));
    expect(canonicalIdentity({ ...j, company: 'Confidential' }, 'one')).not.toBe(canonicalIdentity({ ...j, company: 'Confidential' }, 'two'));
  });
  it('keeps newspaper advice and ambiguous multi-role pages out of the vacancy feed', () => {
    const c = BD_SOURCES.find(s => s.key === 'dhakapost')!;
    const r = parseDetail('<article><h1>How to prepare for an interview</h1><p>Interview tips and advice for job seekers.</p></article>', c.url + '/123', c, '2026-10-23');
    expect(r.jobs).toEqual([]); expect(r.documents).toHaveLength(1);
    expect(parseDetail(post() + post('2026-12-01'), url, source, '2026-10-23').documents[0].reason).toContain('Conflicting');
  });
  it('follows only configured detail links on the source host', () => {
    expect(detailUrls(`<a href="${url}">Job</a><a href="https://evil.invalid/job-details/x">Other</a><a href="/advice">Advice</a>`, source.url, source)).toEqual([url]);
  });
  it('resumes pagination and records failed detail pages for retry', async () => {
    const listing = (next: number) => `<a href="/job-details/page-${next}">job</a><a href="/jobs/all?page=${next}">next</a>`;
    const fetcher = async (u: string) => new Response(u.endsWith('/robots.txt') ? '' : u === source.url ? listing(2) : u.includes('page=3') ? listing(4) : u.includes('/job-details/') ? post() : '', { headers: { 'content-type': 'text/html' } });
    const r = await fetchBangladesh('dohaj', '2026-10-23', { fetcher, delay: 0, cursor: source.url + '?page=3', pages: 2 });
    expect(r.pages).toBe(2); expect(r.nextUrl).toBe(source.url + '?page=4'); expect(r.jobs).toHaveLength(2);
    const failed = await fetchBangladesh('dohaj', '2026-10-23', { fetcher: async u => u.includes('/job-details/') ? new Response('', { status: 503 }) : fetcher(u), delay: 0, pages: 1 });
    expect(failed.failures).toBe(1); expect(failed.documents[0].state).toBe('fetch_failed');
  });
  it('blocks prohibited robots paths and external redirects before fetching them', async () => {
    const seen: string[] = [];
    const reader = new PublicReader(source.url, async u => { seen.push(u); return u.endsWith('robots.txt') ? new Response('User-agent: *\nDisallow: /job-details/') : new Response('', { status: 302, headers: { location: 'https://evil.invalid/private' } }); }, 0);
    await expect(reader.html(url)).rejects.toThrow('disallows');
    await expect(reader.html(source.url)).rejects.toThrow('off host');
    expect(seen.some(u => u.includes('evil.invalid'))).toBe(false);
    await expect(fetchBangladesh('bdjobs', '2026-10-23')).rejects.toThrow('permitted');
  });
});
