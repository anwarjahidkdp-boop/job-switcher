import { describe, expect, it, vi } from 'vitest';
import { BROKEN_AFTER_MS, failingSince, failureNote, isTransient, newlyBroken, plainError, withRetry } from './health';

const H = 3_600_000;
const now = Date.parse('2026-11-06T14:30:00Z');
const iso = (t: number) => new Date(t).toISOString();

describe('source health', () => {
  it('starts the failing clock now for a source that was working, and keeps it for one already failing', () => {
    expect(failingSince({ last_status: 'ok' }, now)).toBe(now);
    const since = now - 5 * H;
    expect(failingSince({ last_status: 'error', last_error: failureNote(since, 'fetch failed') }, now)).toBe(since);
    // Rows from before this rule carry no start time.
    expect(failingSince({ last_status: 'error', last_error: 'Source HTTP 403' }, now)).toBe(now);
  });
  it('stores one marker and the plain message', () => {
    const note = failureNote(now - H, failureNote(now - 9 * H, 'Source HTTP 403'));
    expect(note).toBe(`[since ${iso(now - H)}] Source HTTP 403`);
    expect(plainError(note)).toBe('Source HTTP 403');
  });
  it('does not alert for a one-off failure (the 6 Nov Toptal timeout)', () => {
    expect(newlyBroken({ last_status: 'ok', jobs_found: 120, last_run_at: iso(now - H) }, now)).toBe(false);
    expect(newlyBroken({ last_status: 'error', last_error: failureNote(now - 7 * H, 'timeout'), jobs_found: 120, last_run_at: iso(now - H) }, now)).toBe(false);
  });
  it('alerts once when a source that delivered jobs passes a day of failing', () => {
    const since = now - BROKEN_AFTER_MS - H;
    const row = { last_status: 'error', last_error: failureNote(since, 'Source HTTP 500'), jobs_found: 40 };
    expect(newlyBroken({ ...row, last_run_at: iso(now - 5 * H) }, now)).toBe(true); // previous scan was inside the day
    expect(newlyBroken({ ...row, last_run_at: iso(now - 30 * 60_000) }, now)).toBe(false); // already alerted
  });
  it('never alerts for a source that never delivered a job (a site that blocks us from the start)', () => {
    const row = { last_status: 'error', last_error: failureNote(now - 3 * BROKEN_AFTER_MS, 'Source HTTP 403'), last_run_at: iso(now - 10 * H) };
    expect(newlyBroken({ ...row, jobs_found: 0 }, now)).toBe(false);
    expect(newlyBroken({ ...row, jobs_found: null }, now)).toBe(false);
  });
  it('treats timeouts and network errors as worth one more try, not blocks', () => {
    expect(isTransient(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))).toBe(true);
    expect(isTransient(new TypeError('fetch failed'))).toBe(true);
    expect(isTransient(new Error('Source HTTP 503'))).toBe(true);
    expect(isTransient(new Error('Source HTTP 403'))).toBe(false);
    expect(isTransient(new Error('Board not found (404)'))).toBe(false);
  });
  it('retries a hiccup once and passes other errors straight through', async () => {
    const flaky = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValue(7);
    await expect(withRetry(flaky, 1)).resolves.toBe(7);
    expect(flaky).toHaveBeenCalledTimes(2);
    const blocked = vi.fn().mockRejectedValue(new Error('Source HTTP 403'));
    await expect(withRetry(blocked, 1)).rejects.toThrow('403');
    expect(blocked).toHaveBeenCalledTimes(1);
  });
});
