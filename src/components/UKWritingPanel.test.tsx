import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
import { UKWritingPanel } from './UKWritingPanel';

it('offers the supporting statement and form answers before anything is written', () => {
  const html = renderToStaticMarkup(<UKWritingPanel jobId="j1" likely statement={null} answers={[]} aiReady />);
  expect(html).toContain('Usually required');
  expect(html).toContain('Write my supporting statement');
  expect(html).toContain('Write my answer');
  expect(html).not.toContain('Subscribe');
});

it('shows the saved statement with its criteria, word count and copy buttons, and saved answers', () => {
  const statement = { statement: 'I am applying for the Band 5 Staff Nurse role. [your example]', criteria: [{ criterion: 'NMC registration', evidence: '', status: 'gap' as const }, { criterion: 'Ward experience', evidence: 'Staff Nurse, Royal Infirmary', status: 'met' as const }], ai: true, at: '2026-11-11T08:00:00Z' };
  const answers = [{ question: 'Tell us about a time you helped a patient.', answer: 'At the Royal Infirmary I…', limit: 250, at: '2026-11-11T08:01:00Z' }];
  const html = renderToStaticMarkup(<UKWritingPanel jobId="j1" likely={false} statement={statement} answers={answers} aiReady />);
  expect(html).not.toContain('Usually required');
  expect(html).toContain('12 words');
  expect(html).toContain('Copy statement');
  expect(html).toContain('NMC registration');
  expect(html).toContain('data-status="gap"');
  expect(html).toContain('Staff Nurse, Royal Infirmary');
  expect(html).toContain('Tell us about a time you helped a patient.');
  expect(html).toContain('limit 250');
  expect(html).toContain('Write again');
});

it('explains that writing needs a subscription once the trial has ended', () => {
  const html = renderToStaticMarkup(<UKWritingPanel jobId="j1" likely statement={null} answers={[]} aiReady={false} />);
  expect(html).toContain('Subscribe to write supporting statements');
  expect(html).toMatch(/disabled=""[^>]*>Write my supporting statement/);
});
