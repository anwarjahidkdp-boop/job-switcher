import { it, expect, vi } from 'vitest';
import { BD_SOURCES, approvedSource } from './registry';
import { fetchBangladesh } from './fetch';
import { persistBangladeshJobs } from './persist';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sourceReviewReason } from './quality';
import { parseDetail } from './parse';

it('fails closed for unreviewed aggregators even if their database row was manually enabled', async () => {
  const network = vi.fn(); const rpc = vi.fn();
  for (const s of BD_SOURCES.filter(s => !approvedSource(s))) {
    expect(s.enabled).toBe(false);
    await expect(fetchBangladesh(s.key, '2026-10-23', { fetcher: network })).rejects.toThrow('quality review');
    await expect(persistBangladeshJobs({ rpc } as unknown as SupabaseClient, { id: 'source', kind: 'bdweb', board_token: s.key, country: 'BD', company: null, url: s.url, name: s.name }, [])).rejects.toThrow('quality review');
  }
  expect(network).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
});
it('requires a documented source identity before admitting a provider to the approved registry', () => {
  expect(BD_SOURCES.filter(s => s.enabled).every(approvedSource)).toBe(true);
  expect(approvedSource({ ...BD_SOURCES[0], trust: 'official', verificationUrl: undefined })).toBe(false);
});
it('records owner approval separately and requires complete, current, traceable advertisements', async () => {
  const source = BD_SOURCES.find(s => s.key === 'dohaj')!;
  expect(source.trust).toBe('owner_reviewed'); expect(approvedSource(source)).toBe(true);
  expect(approvedSource({ ...source, reviewNote: undefined })).toBe(false);
  const url = 'https://dohaj.com/job-details/synthetic-123';
  const html = `<script type="application/ld+json">${JSON.stringify({ '@type':'JobPosting', title:'Accountant', hiringOrganization:{name:'Synthetic Employer'}, validThrough:'2099-11-01', description:'Prepare financial reports for the employer.' })}</script>`;
  const job = parseDetail(html,url,source,'2026-10-23').jobs[0];
  expect(sourceReviewReason(job,source,'2026-10-23')).toBeNull();
  for (const patch of [{ deadline:null }, { deadline:'2000-01-01' }, { company:'Confidential' }, { url:'https://unapproved.invalid/job' }, { apply:{method:'portal' as const,target:'javascript:alert(1)'} }]) expect(sourceReviewReason({...job,...patch},source,'2026-10-23')).toBeTruthy();
  const rpc=vi.fn();
  await expect(persistBangladeshJobs({rpc} as unknown as SupabaseClient,{id:'source',kind:'bdweb',board_token:source.key,country:'BD',name:source.name,url:source.url,company:null},[{...job,deadline:null}],'2026-10-23')).rejects.toThrow('Listing review required');
  expect(rpc).not.toHaveBeenCalled();
});
