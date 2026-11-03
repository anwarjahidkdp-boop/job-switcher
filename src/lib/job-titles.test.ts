import { describe, expect, it } from 'vitest';
import { JOB_TITLES, suggestJobTitles } from './job-titles';

describe('job title suggestions', () => {
  it('has a large list across sectors with no duplicates', () => {
    expect(JOB_TITLES.length).toBeGreaterThan(600);
    expect(new Set(JOB_TITLES.map(t => t.toLowerCase())).size).toBe(JOB_TITLES.length);
    for (const t of ['Cash In-charge', 'Software Engineer', 'Nurse', 'Merchandiser', 'Teacher', 'Programme Officer', 'Chef', 'Store Keeper', 'Relationship Manager']) expect(JOB_TITLES).toContain(t);
  });
  it('"cash" shows cash titles', () => {
    const s = suggestJobTitles('cash');
    expect(s.slice(0, 3)).toEqual(['Cash In-charge', 'Cash Officer', 'Cashier']);
    expect(s).toContain('Cash & Bank Officer');
  });
  it('one letter leads with the main group of that letter', () => {
    expect(suggestJobTitles('a')[0]).toBe('Accountant');
    expect(suggestJobTitles('a').slice(0, 4).every(t => t.startsWith('Account'))).toBe(true);
    expect(suggestJobTitles('b').slice(0, 2)).toEqual(['Bank Officer', 'Banking Officer']);
    expect(suggestJobTitles('c')[0]).toBe('Cash In-charge');
  });
  it('matches word starts, spelling without hyphens, any case, and is limited', () => {
    expect(suggestJobTitles('acc man')).toContain('Accounts Manager');
    expect(suggestJobTitles('incharge')).toContain('Cash In-charge');
    expect(suggestJobTitles('cash in charge')[0]).toBe('Cash In-charge');
    expect(suggestJobTitles('NURSE')).toContain('Staff Nurse');
    expect(suggestJobTitles('officer', [], 5)).toHaveLength(5);
    expect(suggestJobTitles('  ')).toEqual([]);
    expect(suggestJobTitles('zzzzqq')).toEqual([]);
  });
  it('leaves out titles already chosen', () => {
    expect(suggestJobTitles('cash', ['cash in-charge'])).not.toContain('Cash In-charge');
  });
});
