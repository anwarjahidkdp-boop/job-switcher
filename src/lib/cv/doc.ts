// Word export: an HTML document Word opens natively (.doc), as in the prototype saveDoc().
import { renderCvHtml, resolveStyle, esc, type RenderInput } from "./render";
import { CV_PRINT_CSS, CV_SCREEN_CSS, cvDocCss } from "./styles";

export function cvDocHtml(inp: Omit<RenderInput, "forDoc">): string {
  const { accent } = resolveStyle(inp.style, inp.country);
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(inp.master.name)}</title><style>${cvDocCss(accent)}</style></head><body>${renderCvHtml({ ...inp, forDoc: true })}</body></html>`;
}

/** Standalone printable page; the browser's "Save as PDF" produces the PDF (no server-side PDF engine needed on free tiers). */
export function cvPrintHtml(inp: Omit<RenderInput, "forDoc">, opts: { autoPrint?: boolean } = {}): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(inp.master.name)} – CV</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&family=Inter:wght@400;500;600&display=swap">
<style>:root{--display:"Manrope",system-ui,sans-serif;--body:"Inter",system-ui,sans-serif}${CV_SCREEN_CSS}${CV_PRINT_CSS}</style></head>
<body><div class="print-bar">Choose "Save as PDF" in the print dialog. <button type="button" onclick="window.print()">Print / Save as PDF</button></div>
<div class="sheet">${renderCvHtml({ ...inp, forDoc: false, photoUrl: inp.photoUrl })}</div>${opts.autoPrint ? `<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400))</script>` : ""}</body></html>`;
}

export function safeFileName(s: string): string {
  return (s || "CV").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "CV";
}
