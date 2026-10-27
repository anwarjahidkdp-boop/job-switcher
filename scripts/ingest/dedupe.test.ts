import { describe, expect, it } from 'vitest';
import { duplicateIds, vacancyKey, type DedupeRow } from './dedupe';

const row = (id: string, o: Partial<DedupeRow> = {}): DedupeRow => ({ id, country: 'GB', title: 'Finance Business Partner', company: 'Example Housing', source_id: 'reed', deadline: '2026-12-08', created_at: '2026-10-27T10:46:26Z', description: 'Partner with budget holders on forecasts.', ...o });

describe('duplicate listings', () => {
  it('keeps one of two postings of the same vacancy on one board', () => {
    expect(duplicateIds([row('b'), row('a')])).toEqual(['b']);
    // Spacing, case and punctuation in the text do not make it a different job.
    expect(duplicateIds([row('a'), row('b', { description: 'Partner with budget-holders on forecasts!' })])).toEqual(['b']);
  });
  it('keeps same-titled jobs with different texts on one site apart (an agency hiring for several clients)', () => {
    expect(duplicateIds([row('a'), row('b', { description: 'Support the Leeds office with month end.' })])).toEqual([]);
    expect(duplicateIds([row('a', { country: 'BD' }), row('b', { country: 'BD', description: 'Another branch.' })])).toEqual([]);
  });
  it('treats copies of one Bangladesh circular on different job sites as one job, keeping the one open longest', () => {
    const r = [row('a', { country: 'BD', company: 'Nevian Lifescience PLC', source_id: 'dohaj', deadline: '2026-11-01', description: 'Long text from one site.' }), row('b', { country: 'BD', company: 'NEVIAN LIFESCIENCE', source_id: 'bdjobstoday', deadline: '2026-11-05', description: 'Other words.' })];
    expect(vacancyKey(r[0])).toBe(vacancyKey(r[1]));
    expect(duplicateIds(r)).toEqual(['a']);
  });
  it('keeps the copy someone applied to and never hides an applied copy', () => {
    expect(duplicateIds([row('a'), row('b')], new Set(['b']))).toEqual(['a']);
    expect(duplicateIds([row('a'), row('b')], new Set(['a', 'b']))).toEqual([]);
  });
  it('compares only the same title at the same employer in the same country', () => {
    expect(duplicateIds([row('a'), row('b', { title: 'Finance Manager' })])).toEqual([]);
    expect(duplicateIds([row('a'), row('b', { country: 'IE' })])).toEqual([]);
    expect(duplicateIds([row('a', { description: '' }), row('b', { description: '' })])).toEqual([]);
  });
});
