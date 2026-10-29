import { beforeEach, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/api', () => ({ apiCtx: vi.fn(), unauthorized: () => new Response('Unauthorized', { status: 401 }) }));
vi.mock('@/lib/server/state', () => ({ loadState: vi.fn() }));
vi.mock('@/lib/server/page', () => ({ isPro: vi.fn() }));
vi.mock('@/lib/pack-limits', () => ({ trialApplyRoom: () => 1, unlockedReady: () => new Set() }));
import { apiCtx } from '@/lib/server/api';
import { loadState } from '@/lib/server/state';
import { isPro } from '@/lib/server/page';
import { GET } from './route';
beforeEach(() => {
  vi.mocked(apiCtx).mockResolvedValue({ db: {}, userId: 'synthetic' } as never);
  vi.mocked(isPro).mockResolvedValue(true);
  vi.mocked(loadState).mockResolvedValue({ country:'BD', profile:{onboarding_step:'done'}, master:{content:{name:'Synthetic'}}, apps:{ own:{job_id:'own',status:'ready',pack:{cover_letter:'Private cover letter'}} } } as never);
});
it('requires authentication and a cover letter from the current user’s application', async () => {
  const missing = await GET(new Request('https://example.invalid/api/cv/download?document=cover&format=print&jobId=someone-else'));
  expect(missing.status).toBe(404); expect(await missing.text()).not.toContain('Private cover letter');
  vi.mocked(apiCtx).mockResolvedValue(null);
  expect((await GET(new Request('https://example.invalid/api/cv/download?document=cover&jobId=own'))).status).toBe(401);
});
it('returns private printable cover letters and Word attachments', async () => {
  const print = await GET(new Request('https://example.invalid/api/cv/download?document=cover&format=print&jobId=own'));
  expect(print.status).toBe(200); expect(print.headers.get('cache-control')).toBe('private, no-store'); expect(await print.text()).toContain('Private cover letter');
  const word = await GET(new Request('https://example.invalid/api/cv/download?document=cover&format=doc&jobId=own'));
  expect(word.headers.get('content-disposition')).toContain('Synthetic-Cover-Letter.doc');
  expect(loadState).toHaveBeenCalledWith(expect.anything(), 'synthetic', undefined, {skipMatching:true});
});
it('keeps previously prepared cover letters downloadable after the trial ends', async () => {
  vi.mocked(isPro).mockResolvedValue(false);
  const response = await GET(new Request('https://example.invalid/api/cv/download?document=cover&format=print&jobId=own'));
  expect(response.status).toBe(200); expect(await response.text()).toContain('Private cover letter');
});
