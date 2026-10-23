import { esc } from './render';
import { convention } from './conventions';

const paragraphs = (letter: string) => letter.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
const css = 'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;color:#17212b}p{margin:0 0 12pt;orphans:3;widows:3}';
export function coverLetterDocHtml(name: string, letter: string): string {
  return `<html><head><meta charset="utf-8"><title>${esc(name)} – Cover letter</title><style>${css}</style></head><body>${paragraphs(letter)}</body></html>`;
}
export function coverLetterPrintHtml(name: string, letter: string, country: string, autoPrint = false): string {
  const paper = convention(country).paper;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)} – Cover letter</title><style>${css}@page{size:${paper};margin:20mm}body{max-width:170mm;margin:24px auto;padding:0 16px}.print-bar{padding:14px;background:#f1f5f9;margin-bottom:24px;font-family:Arial,sans-serif;font-size:14px}.print-bar button{margin-left:10px;padding:8px;cursor:pointer}@media print{body{max-width:none;margin:0;padding:0}.print-bar{display:none}}</style></head><body><div class="print-bar">Choose “Save as PDF” in the print dialog.<button type="button" onclick="window.print()">Print / Save as PDF</button></div><main>${paragraphs(letter)}</main>${autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400))</script>' : ''}</body></html>`;
}
