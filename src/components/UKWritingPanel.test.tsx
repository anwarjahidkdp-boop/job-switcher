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

it('asks for the person specification when only a short advert summary is held', () => {
  const html = renderToStaticMarkup(<UKWritingPanel jobId="j1" likely statement={null} answers={[]} aiReady thin />);
  expect(html).toContain('We only have a short summary of this advert');
  expect(html).toContain('Person specification or full advert');
  expect(html).toContain('recommended');
});

it('keeps the pasted specification with a saved statement and offers to change it', () => {
  const statement = { statement: 'I am applying.', criteria: [], ai: true, at: '2026-11-13T08:00:00Z' };
  const html = renderToStaticMarkup(<UKWritingPanel jobId="j1" likely statement={statement} answers={[]} aiReady spec="Essential: NMC registration" />);
  expect(html).toContain('written against the person specification you pasted');
  expect(html).toContain('Change the person specification');
  expect(html).toContain('Essential: NMC registration');
  expect(html).not.toContain('We only have a short summary');
});
