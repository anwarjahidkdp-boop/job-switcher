import { describe, expect, it } from 'vitest';
import { ukApplicationAnswers, ukApplicationRoute } from './uk-application';
const input = { method: 'portal', target: null, url: 'https://careers.example.com/jobs/1', description: '' };
describe('UK application channel', () => {
  it('keeps a contact email out of the application route', () => {
    expect(ukApplicationRoute({ ...input, method: 'email', target: 'hr@example.com', description: 'Apply online. For accessibility enquiries contact hr@example.com.' })).toMatchObject({ kind: 'review', recipient: null });
  });
  it('accepts only the named application recipient', () => {
    const description = 'Please email your CV to jobs@example.com';
    expect(ukApplicationRoute({ ...input, method: 'email', target: 'jobs@example.com', description })).toMatchObject({ kind: 'email', recipient: 'jobs@example.com' });
    expect(ukApplicationRoute({ ...input, method: 'email', target: 'other@example.com', description }).kind).toBe('review');
  });
  it('rejects script URLs, credentials and deceptive job-board domains', () => {
    for (const url of ['javascript:alert(1)', 'https://user:pass@example.com/job']) expect(ukApplicationRoute({ ...input, url }).href).toBeNull();
    expect(ukApplicationRoute({ ...input, url: 'https://linkedin.com.evil.example/job' }).label).toBe('Continue to employer website');
  });
  it('uses a valid supplied application URL before the advert', () => {
    expect(ukApplicationRoute({ ...input, target: 'https://www.reed.co.uk/jobs/123' })).toMatchObject({ href: 'https://www.reed.co.uk/jobs/123', label: 'Continue on Reed' });
  });
});
describe('UK copyable answers', () => {
  it('does not turn residency assumptions into right-to-work declarations', () => {
    const rows = ukApplicationAnswers({ workAuthorization: 'yes', workAuthorizationSource: 'home_country_default', sponsorshipRequired: false, sponsorshipSource: 'home_country_default' }, null);
    expect(rows.slice(0, 2).map(r => r.value)).toEqual([null, null]);
  });
  it('uses explicit saved answers including zero notice and refuses foreign-country salary', () => {
    const rows = ukApplicationAnswers({ workAuthorization: 'yes', workAuthorizationSource: 'user', sponsorshipRequired: false, noticeDays: 0, expectedSalary: 70000, salaryCountry: 'BD' }, null);
    expect(rows.map(r => r.value)).toEqual(['Yes', 'No', null, 'Available immediately']);
  });
});
