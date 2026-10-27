import { describe, it, expect } from 'vitest';
import { BD_SOURCES } from './registry';
import { detailUrls, nextPage, parseDetail, pathPage } from './parse';
import { fetchBangladesh } from './fetch';

// Synthetic pages shaped like bdRecruit (WordPress job board): detail links at /job/<slug>/, pages at /bdjobs/page/N/.
const c = BD_SOURCES.find(s => s.key === 'bdrecruit')!;
const job = (slug: string) => `https://bdrecruit.net/job/${slug}/`;
const listing = (n: number, last = 3) => `<a href="${job(`officer-${n}a`)}">A</a><a href="${job(`officer-${n}b`)}">B</a><a href="/category/ngo/">NGO</a>${n < last ? `<a class="next" href="https://bdrecruit.net/bdjobs/page/${n + 1}/">Next</a>` : ''}`;
const detail = (deadline: string) => `<html><h1>Territory Officer</h1><script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: 'Territory Officer', hiringOrganization: { name: 'Banglalink Digital Communications Ltd.' }, description: 'Drive retail sales in the assigned territory and build distributor relationships across the region.', jobLocation: { address: { addressLocality: 'Dhaka', addressCountry: 'BD' } }, validThrough: deadline, datePosted: '2026-10-20' })}</script></html>`;

describe('bdRecruit listing', () => {
  it('finds /job/<slug>/ detail links and ignores category links', () => {
    expect(detailUrls(listing(1), c.url, c)).toEqual([job('officer-1a'), job('officer-1b')]);
  });
  it('follows /page/N/ pagination one page at a time', () => {
    expect(pathPage(c.url, c)).toBe(1);
    expect(pathPage('https://bdrecruit.net/bdjobs/page/7/', c)).toBe(7);
    expect(pathPage('https://bdrecruit.net/category/ngo/page/2/', c)).toBeNull();
    expect(nextPage(listing(1), c.url, c)).toBe('https://bdrecruit.net/bdjobs/page/2/');
    expect(nextPage(listing(3), 'https://bdrecruit.net/bdjobs/page/3/', c)).toBeNull();
  });
  it('collects open jobs across pages and resumes from a saved page', async () => {
    const fetcher = async (u: string) => {
      const p = u.endsWith('/robots.txt') ? '' : u.includes('/job/') ? detail('2026-10-31') : listing(pathPage(u, c) || 1);
      return new Response(p, { headers: { 'content-type': 'text/html' } });
    };
    const r = await fetchBangladesh('bdrecruit', '2026-10-27', { fetcher, delay: 0, pages: 2 });
    expect(r.pages).toBe(2); expect(r.jobs).toHaveLength(4); expect(r.nextUrl).toBe('https://bdrecruit.net/bdjobs/page/3/');
    expect(r.jobs[0]).toMatchObject({ title: 'Territory Officer', company: 'Banglalink Digital Communications Ltd.', deadline: '2026-10-31', country: 'BD' });
    const resumed = await fetchBangladesh('bdrecruit', '2026-10-27', { fetcher, delay: 0, pages: 2, cursor: r.nextUrl });
    expect(resumed.nextUrl).toBeNull();
  });
  it('keeps the jobs already read when a later listing page fails, and resumes there next time', async () => {
    const fetcher = async (u: string) => {
      if (u.includes('/page/2/')) return new Response('', { status: 503 });
      const p = u.endsWith('/robots.txt') ? '' : u.includes('/job/') ? detail('2026-10-31') : listing(1);
      return new Response(p, { headers: { 'content-type': 'text/html' } });
    };
    const r = await fetchBangladesh('bdrecruit', '2026-10-27', { fetcher, delay: 0, pages: 3, retryUrls: ['https://bdrecruit.net/bdjobs/page/2/'] });
    expect(r.jobs).toHaveLength(2); expect(r.failures).toBe(1); expect(r.nextUrl).toBe('https://bdrecruit.net/bdjobs/page/2/');
  });
  it('reads labelled pages without structured data, with WordPress "Expiration date"', () => {
    const html = '<h1>Process Lead</h1><div class="job-details"><p>Company Name: JTI Bangladesh</p><p>Expiration date: October 31, 2026</p><p>Experience: 3 years in manufacturing process improvement and quality systems.</p><p>Location: Dhaka</p></div>';
    const r = parseDetail(html, job('process-lead-jti'), c, '2026-10-27');
    expect(r.jobs[0]).toMatchObject({ title: 'Process Lead', company: 'JTI Bangladesh', deadline: '2026-10-31' });
  });
});
