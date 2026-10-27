import { describe, it, expect } from 'vitest';
import { boardFromUrl, boardOnPage, careerLinks, discoverCompany, discoverCareerPages, jobPageLinks } from './discover';
import { governmentTitle, privateFirst } from './sector';
import { fetchSource, type SourceRow } from '../fetch-source';

// Synthetic sites only: these exercise the detector, they do not stand for any real company's pages.
type Site = Record<string, { status?: number; body?: string; location?: string; type?: string }>;
const web = (site: Site) => async (u: string) => {
  const p = site[u] ?? (u.endsWith('/robots.txt') ? { status: 404 } : { status: 404 });
  return new Response(p.body ?? '', { status: p.status ?? 200, headers: { 'content-type': p.type ?? 'text/html', ...(p.location ? { location: p.location } : {}) } });
};
const posting = JSON.stringify({ '@type': 'JobPosting', title: 'Accounts Officer', hiringOrganization: { name: 'Example Foods Ltd' }, jobLocation: { address: { addressLocality: 'Dhaka', addressCountry: 'BD' } }, validThrough: '2026-11-30', description: 'Prepare monthly accounts and reconcile ledgers.' });

describe('career page detector', () => {
  it('names public job boards from their URLs and ignores their own pages', () => {
    expect(boardFromUrl('https://jobs.smartrecruiters.com/ShebaPlatformLimited/7439')).toEqual({ kind: 'smartrecruiters', token: 'ShebaPlatformLimited' });
    expect(boardFromUrl('https://apply.workable.com/acme-bd/j/ABC123/')).toEqual({ kind: 'workable', token: 'acme-bd' });
    expect(boardFromUrl('https://boards.greenhouse.io/embed/job_board?for=acmebd')).toEqual({ kind: 'greenhouse', token: 'acmebd' });
    expect(boardFromUrl('https://acmebd.recruitee.com/o/officer')).toEqual({ kind: 'recruitee', token: 'acmebd' });
    expect(boardFromUrl('https://jobs.smartrecruiters.com/sr-jobs/search')).toBeNull();
    expect(boardFromUrl('https://example.com/careers')).toBeNull();
    expect(boardOnPage('<iframe src="https://jobs.lever.co/acme?embed=1"></iframe>', 'https://acme.com/')).toEqual({ kind: 'lever', token: 'acme' });
  });
  it('finds careers links on the company site, including its subdomains, best first', () => {
    const html = '<a href="/about">About</a><a href="https://career.example.com.bd/">Career</a><a href="/news/jobs-fair-2025">Jobs fair news</a><a href="https://other.com/careers">Elsewhere</a><a href="/join-us">Join us</a>';
    const links = careerLinks(html, 'https://www.example.com.bd/', 'example.com.bd');
    expect(links[0]).toBe('https://career.example.com.bd/');
    expect(links).not.toContain('https://other.com/careers');
    expect(links).not.toContain('https://www.example.com.bd/about');
  });
  it('groups job pages under the listing path', () => {
    const r = jobPageLinks('<a href="/careers/accounts-officer">A</a><a href="/careers/sales-lead">B</a><a href="/news/x">N</a>', 'https://example.com/careers');
    expect(r).toEqual({ prefix: '/careers/', links: ['https://example.com/careers/accounts-officer', 'https://example.com/careers/sales-lead'] });
  });
  it('follows a careers link that redirects to a job board', async () => {
    const d = await discoverCompany({ name: 'Acme', site: 'acme.com.bd', sector: 'x' }, web({
      'https://acme.com.bd/': { body: '<a href="/careers">Careers</a>' },
      'https://acme.com.bd/careers': { status: 302, location: 'https://jobs.smartrecruiters.com/AcmeBD' },
    }));
    expect(d).toMatchObject({ status: 'board', kind: 'smartrecruiters', token: 'AcmeBD' });
  });
  it('switches on structured job pages only after one is confirmed', async () => {
    const site: Site = {
      'https://example.com/': { body: '<a href="/careers">Careers</a>' },
      'https://example.com/careers': { body: '<a href="/careers/accounts-officer">Accounts Officer</a>' },
      'https://example.com/careers/accounts-officer': { body: `<script type="application/ld+json">${posting}</script>` },
    };
    expect(await discoverCompany({ name: 'Example', site: 'example.com', sector: 'x' }, web(site))).toEqual({ status: 'jsonld', url: 'https://example.com/careers', detailPath: '/careers/' });
    site['https://example.com/careers/accounts-officer'] = { body: '<p>Send your CV</p>' };
    expect(await discoverCompany({ name: 'Example', site: 'example.com', sector: 'x' }, web(site))).toMatchObject({ status: 'no_public_feed' });
  });
  it('honours robots.txt and records blocked or Bdjobs-only employers', async () => {
    expect(await discoverCompany({ name: 'B', site: 'blocked.com', sector: 'x' }, web({ 'https://blocked.com/robots.txt': { body: 'User-agent: *\nDisallow: /' } }))).toMatchObject({ status: 'unreachable', note: expect.stringContaining('robots') });
    expect(await discoverCompany({ name: 'C', site: 'c.com', sector: 'x' }, web({ 'https://c.com/': { body: '<a href="/career">Career</a>' }, 'https://c.com/career': { body: 'Apply on <a href="https://jobs.bdjobs.com/x">Bdjobs</a>' } }))).toMatchObject({ status: 'lists_on_bdjobs' });
    expect(await discoverCompany({ name: 'D', site: 'd.com', sector: 'x' }, web({ 'https://d.com/': { body: '<a href="/careers">Careers</a>' }, 'https://d.com/careers': { status: 302, location: 'https://evil.invalid/x' } }))).toMatchObject({ status: 'no_public_feed', note: expect.stringContaining('leaves') });
  });
});

describe('career page records', () => {
  const fakeDb = (rows: Record<string, unknown>[]) => {
    const writes: { op: string; data: unknown }[] = [];
    const db = { from: () => ({
      select: () => ({ eq: async () => ({ data: rows, error: null }) }),
      insert: async (data: unknown) => { writes.push({ op: 'insert', data }); return { error: null }; },
      update: (data: unknown) => ({ eq: async () => { writes.push({ op: 'update', data }); return { error: null }; } }),
    }) };
    return { db: db as never, writes };
  };
  it('registers confirmed boards once, adds a found board, and rechecks only after a week', async () => {
    const companies = [{ name: 'Acme', site: 'acme.com.bd', sector: 'x' }, { name: 'Global', site: 'global.com', sector: 'x', mnc: true }];
    const fetcher = web({ 'https://acme.com.bd/': { body: '<a href="https://apply.workable.com/acme/">Careers</a>' }, 'https://global.com/': { body: '<a href="https://jobs.smartrecruiters.com/Global">Jobs</a>' } });
    const { db, writes } = fakeDb([]);
    const r = await discoverCareerPages(db, { companies, fetcher });
    expect(r.tally).toEqual({ board: 2 });
    const inserted = writes.filter((w) => w.op === 'insert').flatMap((w) => [w.data].flat()) as { kind: string; board_token: string; active: boolean }[];
    expect(inserted).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'workable', board_token: 'acme', active: true }), expect.objectContaining({ kind: 'smartrecruiters', board_token: 'Global@bd' }), expect.objectContaining({ kind: 'jsonld', board_token: 'dir:acme.com.bd', active: false, last_status: 'uses_board' })]));
    const now = Date.parse('2026-10-27T00:00:00Z');
    const checked = [{ id: '1', kind: 'jsonld', board_token: 'dir:acme.com.bd', active: false, last_run_at: '2026-10-25T00:00:00Z' }, { id: '2', kind: 'jsonld', board_token: 'dir:global.com@bd', active: false, last_run_at: '2026-10-01T00:00:00Z' }];
    const again = await discoverCareerPages(fakeDb(checked).db, { companies, fetcher, now });
    expect(again.checked).toBe(1);
  });
});

describe('one-country boards', () => {
  const src = (token: string, kind: SourceRow['kind'] = 'lever'): SourceRow => ({ id: 's', kind, name: 'Field Nation Bangladesh', url: null, board_token: token, country: 'BD', company: 'Field Nation' });
  const lever = [{ id: '1', text: 'Accounting Manager', categories: { location: 'Dhaka, Bangladesh' }, descriptionPlain: 'Lead the accounting team.' }, { id: '2', text: 'Field Engineer', categories: { location: 'Minneapolis, MN' }, descriptionPlain: 'Install equipment.' }, { id: '3', text: 'Support Agent', categories: { location: 'Remote' }, descriptionPlain: 'Help customers.' }];
  it('keeps only jobs placed in Bangladesh by their own location', async () => {
    const seen: string[] = [];
    const jobs = await fetchSource(src('fieldnation@bd'), '2026-10-27', async (u) => { seen.push(String(u)); return new Response(JSON.stringify(lever)); });
    expect(jobs.map((j) => j.title)).toEqual(['Accounting Manager']);
    expect(seen[0]).toContain('/postings/fieldnation');
  });
  it('asks SmartRecruiters for that country only', async () => {
    const seen: string[] = [];
    await fetchSource(src('DeliveryHero@bd', 'smartrecruiters'), '2026-10-27', async (u) => { seen.push(String(u)); return new Response(JSON.stringify({ content: [] })); });
    expect(seen[0]).toMatch(/companies\/DeliveryHero\/postings\?limit=100&country=bd$/);
  });
  it('rejects an unknown country filter instead of reading everything', async () => {
    await expect(fetchSource(src('fieldnation@zz'), '2026-10-27', async () => new Response('[]'))).rejects.toThrow('country filter');
  });
});

describe('private circulars first', () => {
  it('spots government bodies in Bangla and English titles', () => {
    expect(governmentTitle('স্বাস্থ্য অধিদপ্তরে নিয়োগ বিজ্ঞপ্তি')).toBe(true);
    expect(governmentTitle('Bangladesh Bank Assistant Director Recruitment')).toBe(true);
    expect(governmentTitle('Executive, Sales - Akij Food & Beverage Ltd')).toBe(false);
    expect(governmentTitle('প্রাণ-আরএফএল গ্রুপে চাকরি')).toBe(false);
  });
  it('reads private circulars before government ones, dropping none', () => {
    const docs = [{ title: 'Ministry of Health circular' }, { title: 'Sales Officer at ACI' }, { title: 'সেনাবাহিনী নিয়োগ' }, { title: null }];
    expect(privateFirst(docs).map((d) => d.title)).toEqual(['Sales Officer at ACI', null, 'Ministry of Health circular', 'সেনাবাহিনী নিয়োগ']);
  });
});
