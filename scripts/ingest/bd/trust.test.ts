import { it, expect, vi } from 'vitest';
import { BD_SOURCES, approvedSource } from './registry';
import { fetchBangladesh } from './fetch';
import { persistBangladeshJobs } from './persist';
import type { SupabaseClient } from '@supabase/supabase-js';

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
