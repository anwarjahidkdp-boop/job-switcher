// Word export: an HTML document Word opens natively (.doc), as in the prototype saveDoc().
import { renderCvHtml, resolveStyle, esc, type RenderInput } from "./render";
import { CV_PRINT_CSS, CV_SCREEN_CSS, cvDocCss } from "./styles";
import { convention } from "./conventions";

export function cvDocHtml(inp: Omit<RenderInput, "forDoc">): string {
  const { accent } = resolveStyle(inp.style, inp.country);
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(inp.master.name)}</title><style>${cvDocCss(accent)}</style></head><body>${renderCvHtml({ ...inp, forDoc: true })}</body></html>`;
}

/** Standalone printable page; the browser's "Save as PDF" produces the PDF (no server-side PDF engine needed on free tiers). */
export function cvPrintHtml(inp: Omit<RenderInput, "forDoc">, opts: { autoPrint?: boolean } = {}): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(inp.master.name)} – CV</title>
<style>@font-face{font-family:Inter;src:url("/fonts/inter-latin.woff2") format("woff2");font-weight:400 600;font-display:swap}@font-face{font-family:Manrope;src:url("/fonts/manrope-latin.woff2") format("woff2");font-weight:600 800;font-display:swap}:root{--display:"Manrope",system-ui,sans-serif;--body:"Inter",system-ui,sans-serif}${CV_SCREEN_CSS}${CV_PRINT_CSS}${pageCss(inp)}</style></head>
<body><div class="print-bar">Choose "Save as PDF" in the print dialog. <button type="button" onclick="window.print()">Print / Save as PDF</button></div>
<div class="sheet">${renderCvHtml({ ...inp, forDoc: false, highlightChanges: false, photoUrl: inp.photoUrl })}</div>${opts.autoPrint ? `<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400))</script>` : ""}</body></html>`;
}

/**
 * Paper and margins follow the target country (conventions.ts): Letter in North America and the Philippines, A4 elsewhere. Layouts with a full-bleed colour band or sidebar print
 * edge to edge; the others get real page margins, so the second page does not start at the paper's edge.
 */
export function pageCss(inp: Omit<RenderInput, "forDoc">): string {
  const cv = convention(inp.country);
  const { tpl } = resolveStyle(inp.style, inp.country);
  const bleed = tpl === "modern" || tpl === "executive";
  return `@page{size:${cv.paper};margin:${bleed ? "0" : cv.margin}}@media print{.sheet .cv{min-height:0}${bleed ? "" : ".sheet .t-classic{padding:0}"}}`;
}

export function safeFileName(s: string): string {
  return (s || "CV").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "CV";
}
