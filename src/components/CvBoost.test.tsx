import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
import { CvBoost } from './CvBoost';

it('invites the person to strengthen the CV and says what it costs them', () => {
  const html = renderToStaticMarkup(<CvBoost asked={[]} answered={0} results={0} aiReady />);
  expect(html).toContain('Add the numbers UK recruiters look for');
  expect(html).toContain('your CV shows no results with numbers');
  expect(html).toContain('About 3 minutes');
  expect(html).toContain('Nothing added that you did not tell us');
  expect(html).toContain('Strengthen my CV →');
});

it('continues waiting questions and becomes a slim line once done', () => {
  const waiting = renderToStaticMarkup(<CvBoost asked={[{ id: 'ach_a_1_r0', question: 'How many residents?', placeholder: '' }]} answered={0} results={2} aiReady />);
  expect(waiting).toContain('1 question waiting');
  expect(waiting).toContain('Continue →');
  const done = renderToStaticMarkup(<CvBoost asked={[]} answered={3} results={5} aiReady />);
  expect(done).toContain('Your CV now shows 5 results with numbers');
  expect(done).toContain('Add more results');
  expect(done).not.toContain('Strengthen my CV →');
});

it('keeps a normal, clickable button once the trial or plan has ended (the Pro note opens on press)', () => {
  const html = renderToStaticMarkup(<CvBoost asked={[]} answered={0} results={1} aiReady={false} locked />);
  expect(html).toContain('Strengthen my CV →');
  expect(html).not.toContain('disabled');
  expect(html).not.toContain('Not available right now');
  const slim = renderToStaticMarkup(<CvBoost asked={[]} answered={2} results={3} aiReady={false} locked />);
  expect(slim).toContain('Add more results');
  expect(slim).not.toContain('disabled');
});

it('says when the AI is briefly unavailable for an active account', () => {
  const html = renderToStaticMarkup(<CvBoost asked={[]} answered={0} results={1} aiReady={false} />);
  expect(html).toContain('Not available right now');
  expect(html).toContain('disabled');
});
