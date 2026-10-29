import { describe, expect, it } from 'vitest';
import { applicationProgressCounts, currentApplicationNotifications } from './dashboard-progress';
import type { ApplicationRow } from './server/state';
import type { NotificationRow } from './server/notify';
const app = (status: ApplicationRow['status'], pack: boolean, applied_at: string | null = null) => ({ status, pack: pack ? {} : null, applied_at, updated_at: '2026-10-24' }) as ApplicationRow;
const note = { id: 'n', kind: 'match', title: 'New 79% match: Internal Auditor', body: 'Want us to prepare your application?', link: '/jobs/j', read_at: null } as NotificationRow;
describe('dashboard application progress', () => {
  it('includes submitted packs in prepared total without counting unprepared selections', () => {
    expect(applicationProgressCounts({ a: app('ready', true), b: app('applied', true, '2026-10-24'), c: app('waiting', false) })).toEqual({ prepared: 2, applied: 1 });
    expect(applicationProgressCounts({})).toEqual({ prepared: 0, applied: 0 });
  });
  it('replaces stale match prompts with applied status while retaining job and score', () => {
    const [result] = currentApplicationNotifications([note], { j: app('applied', true, '2026-10-24') });
    expect(result.title).toBe('Applied · 79% match: Internal Auditor');
    expect(result.body).not.toContain('prepare');
    expect(result.link).toBe('/applications');
    expect(note.title).toContain('New');
  });
  it('preserves unsent notifications and follows later interview status', () => {
    const prepared=currentApplicationNotifications([note], { j: app('ready', true) })[0];
    expect(prepared.title).toContain('Prepared ·');
    expect(prepared.body).toContain('saved');
    expect(prepared.link).toBe('/jobs/j#application');
    expect(currentApplicationNotifications([note], { j: app('interview', true) })[0].title).toContain('Interview scheduled ·');
  });
});
