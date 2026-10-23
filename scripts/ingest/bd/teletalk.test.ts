import { it, expect } from 'vitest';
import { teletalkJob } from './teletalk';
import { fetchBangladesh } from './fetch';
import { normaliseJobText } from '../../../src/lib/jobs';

const detail = { id: 10, organization_id: 20, job_title: 'Office Support Staff', job_title_bn: 'অফিস সহায়ক', status: 5,
  deadline_date: '2026-11-26T11:00:00.000Z', published_date: '2026-10-26T04:00:00.000Z', advertisement_published_date: '2026-10-13',
  min_age: 18, max_age: 32, application_site: 'http://agency.teletalk.com.bd/', job_utilities_govtorganization: { name: 'Synthetic Government Agency' } };
it('uses only public government job fields, keeping age and employer history out of experience and location', () => {
  const j = teletalkJob(detail, '2026-10-23')!;
  expect(j).toMatchObject({ company: 'Synthetic Government Agency', deadline: '2026-11-26', publishedAt: '2026-10-13', minYears: null, maxYears: null, education: null, location: null, apply: { method: 'portal', target: 'http://agency.teletalk.com.bd/' } });
  expect(j.description).toContain('Full education, experience');
  expect(teletalkJob({ ...detail, deadline_date: '2026-10-22' }, '2026-10-23')).toBeNull();
  expect(teletalkJob({ ...detail, is_result: true }, '2026-10-23')).toBeNull();
  expect(teletalkJob({ ...detail, organization_id: undefined, job_utilities_govtorganization: { id: 20, name: 'Synthetic Government Agency' } }, '2026-10-23')?.url).toContain('/government/20?jobId=10');
});
it.each(['Age: 22 to 30 years\nExperience:\n3 to 5 years', 'Age\n23 to 40 years\nMinimum 1 year(s)', 'Aged between 18 and 32 years\nExperience: 3-5 years'])('separates age from tenure in imported descriptions (%s)', text => {
  const j = normaliseJobText({ title: 'Officer', company: 'Synthetic', text, country: 'BD', source: 'test', today: '2026-10-23' });
  expect(j.minYears).toBe(text.includes('Minimum') ? 1 : 3); expect(j.maxYears).toBe(text.includes('Minimum') ? null : 5);
});
it('uses anonymous Teletalk endpoints, retries a transient response and resumes older organization pages', async () => {
  const seen: { url: string; init?: RequestInit }[] = []; let attempts = 0;
  const r = await fetchBangladesh('alljobs', '2026-10-23', { delay: 0, pages: 2, cursor: 'https://alljobs.teletalk.com.bd/api/v1/govt-jobs/org-list?page=3&limit=20',
    fetcher: async (url, init) => { seen.push({ url, init });
      if (url.endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /');
      if (url.includes('org-list')) return Response.json({ status: 'success', count: 70, govtOrgJobs: [{ id: 20, govt_jobs: [{ id: 10 }] }] });
      if (++attempts === 1) return new Response('', { status: 503 });
      return Response.json({ status: 'success', details: detail });
    } });
  expect(r.jobs).toHaveLength(1); expect(attempts).toBe(2); expect(r.nextUrl).toContain('page=4');
  expect(seen.some(s => s.url.includes('page=3'))).toBe(true);
  expect(seen.every(s => !new Headers(s.init?.headers).has('authorization'))).toBe(true);
});
