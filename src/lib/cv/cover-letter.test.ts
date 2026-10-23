import { it, expect } from 'vitest';
import { coverLetterDocHtml, coverLetterPrintHtml } from './cover-letter';

it('escapes letter content, retains paragraphs and produces Word and printable versions', () => {
  const letter = 'Dear Hiring Manager,\r\n\r\nI led 12 people.\r\n<script>unsafe()</script>\r\n\r\nSincerely,\r\nSynthetic';
  for (const html of [coverLetterDocHtml('Synthetic <name>', letter), coverLetterPrintHtml('Synthetic <name>', letter, 'BD')]) {
    expect(html).toContain('I led 12 people.<br>&lt;script&gt;unsafe()&lt;/script&gt;');
    expect(html).not.toContain('<script>unsafe()'); expect(html).toContain('<p>Sincerely,<br>Synthetic</p>');
  }
});
it('uses destination paper and an explicit Save as PDF action', () => {
  expect(coverLetterPrintHtml('Synthetic','Letter','BD')).toContain('size:A4');
  expect(coverLetterPrintHtml('Synthetic','Letter','US')).toContain('size:Letter');
  expect(coverLetterPrintHtml('Synthetic','Letter','GB',true)).toContain('window.print()');
});
