// CV stylesheets: screen preview (ported from the prototype), print-to-PDF and Word (.doc).
export const CV_SCREEN_CSS = `
.cv{--cva:#0B7A6E;background:#fff;color:#1F2933;border:1px solid var(--line,#DCE1E6);border-radius:8px;font-size:13.5px;line-height:1.5;box-shadow:var(--shadow,none);overflow:hidden;font-family:var(--body,Inter,system-ui,sans-serif)}
.cv h2{font-family:var(--display,Manrope,system-ui,sans-serif);font-size:27px;color:#0F1B2D;line-height:1.15;font-weight:800;margin:0}
.cv p{margin:0}
.cv .hl{color:var(--cva);font-weight:600;margin-top:4px}
.cv .ct{color:#52606D;font-size:12.5px;margin-top:6px}
.cv h3{font-family:var(--display,Manrope,system-ui,sans-serif);font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--cva);margin:0 0 8px;font-weight:800}
.cv .cs{margin-top:18px}
.cv .role{margin-bottom:12px}
.cv .rt{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
.cv .co{color:#52606D;font-size:12.5px}
.cv .dt{color:#52606D;font-size:12px;white-space:nowrap;font-variant-numeric:tabular-nums}
.cv ul{margin:4px 0 0;padding-left:18px}
.cv li{margin:3px 0}
.cv li::marker{color:var(--cva)}
.cv mark{background:#FFF1C2;color:inherit;padding:0 2px;border-radius:2px}
.cv .cvchips{display:flex;flex-wrap:wrap;gap:5px}
.cv .cvchips span{border-radius:4px;padding:2px 8px;font-size:12px;background:color-mix(in srgb,var(--cva) 11%,#fff);color:#1F2933}
.cv .ph{width:104px;height:104px;border-radius:50%;object-fit:cover;display:block;flex:none}
.cv .ph-empty{display:grid;place-items:center;font-family:var(--display,Manrope,sans-serif);font-weight:800;font-size:32px;background:color-mix(in srgb,var(--cva) 14%,#fff);color:var(--cva);border:2px dashed color-mix(in srgb,var(--cva) 45%,#fff)}
.cv .pd{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 10px;margin:0;font-size:12.5px}
.cv .pd dt{opacity:.75}
.cv .pd dd{margin:0}
.t-modern{display:grid;grid-template-columns:minmax(0,225px) minmax(0,1fr)}
.t-modern .sb{background:var(--cva);color:#fff;padding:28px 22px;font-size:12.5px}
.t-modern .sb .ph{margin:0 auto 4px;border:3px solid rgba(255,255,255,.55)}
.t-modern .sb .ph-empty{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.5)}
.t-modern .sb h3{color:#fff;opacity:.92;border-bottom:1px solid rgba(255,255,255,.3);padding-bottom:5px}
.t-modern .sb p{margin:3px 0;overflow-wrap:anywhere}
.t-modern .sb .cvchips span{background:rgba(255,255,255,.16);color:#fff}
.t-modern .mn{padding:30px 32px}
.t-modern .mn header{padding-bottom:14px;border-bottom:3px solid var(--cva)}
.t-exec .band{background:var(--cva);color:#fff;padding:28px 32px;display:flex;gap:22px;align-items:center}
.t-exec .band h2{color:#fff}
.t-exec .band .hl{color:#fff;opacity:.92}
.t-exec .band .ct{color:#fff;opacity:.85}
.t-exec .band .ph{border:3px solid rgba(255,255,255,.6)}
.t-exec .band .ph-empty{background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.5)}
.t-exec .body{padding:4px 32px 30px}
.t-exec h3{border-left:4px solid var(--cva);padding-left:8px;color:#0F1B2D}
.t-exec .two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px}
.t-classic{padding:34px 40px}
.t-classic header{text-align:center;position:relative;padding-bottom:4px}
.t-classic header .ph{margin:0 auto 12px;width:88px;height:88px;font-size:26px}
.t-classic h2{font-family:Georgia,"Times New Roman",serif;font-weight:700;font-size:29px}
.t-classic h3{color:#0F1B2D;border-bottom:1.5px solid var(--cva);padding-bottom:4px}
.t-corp{--serif:"Source Serif 4","Source Serif Pro",Georgia,Cambria,"Times New Roman",serif;padding:44px 50px;font-family:Inter,"Segoe UI",Calibri,Carlito,system-ui,sans-serif;font-size:13px;line-height:1.55;color:#1E2733}
.t-corp header{padding-bottom:16px;border-bottom:2px solid var(--cva);position:relative}
.t-corp header::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:1px;background:color-mix(in srgb,var(--cva) 30%,#fff)}
.t-corp .hd{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}
.t-corp h2{font-family:var(--serif);font-weight:700;font-size:32px;letter-spacing:.005em;color:#0F1722;line-height:1.1}
.t-corp .hl{font-family:var(--serif);font-weight:400;font-style:italic;font-size:15.5px;color:var(--cva);margin-top:6px}
.t-corp .ct{display:flex;flex-wrap:wrap;gap:3px 0;margin-top:10px;font-size:12px;color:#46505C;letter-spacing:.01em}
.t-corp .ct span+span::before{content:"";display:inline-block;width:4px;height:4px;border-radius:50%;background:var(--cva);opacity:.55;margin:0 10px 2px;vertical-align:middle}
.t-corp .ph{width:92px;height:92px;border-radius:4px;font-size:26px;border:1px solid #E2E6EC}
.t-corp .cs{margin-top:22px}
.t-corp h3{display:flex;align-items:center;gap:12px;font-family:var(--serif);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--cva);font-weight:700;margin:0 0 10px}
.t-corp h3::after{content:"";flex:1;height:1px;background:color-mix(in srgb,var(--cva) 28%,#fff)}
.t-corp .cs.sum>p{font-size:13.5px;color:#26303C}
.t-corp ul{padding-left:17px}
.t-corp li{margin:3px 0;padding-left:2px}
.t-corp li::marker{color:var(--cva);font-size:.9em}
.t-corp .hi{list-style:none;padding:12px 16px;margin:0;background:color-mix(in srgb,var(--cva) 5%,#fff);border-left:3px solid var(--cva);border-radius:0 6px 6px 0}
.t-corp .hi li{position:relative;padding-left:18px;margin:4px 0}
.t-corp .hi li::before{content:"";position:absolute;left:0;top:.6em;width:6px;height:6px;background:var(--cva);transform:rotate(45deg)}
.t-corp .aoe{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 18px;list-style:none;padding:0;margin:0}
.t-corp .aoe li{padding-left:14px;position:relative;margin:0}
.t-corp .aoe li::before{content:"";position:absolute;left:0;top:.62em;width:5px;height:5px;background:var(--cva)}
.t-corp .role{margin-bottom:15px}
.t-corp .rt{display:flex;justify-content:space-between;align-items:baseline;gap:14px}
.t-corp .rtl{font-size:14px;font-weight:700;color:#0F1722}
.t-corp .co{font-variant:small-caps;letter-spacing:.05em;font-size:13px;color:var(--cva);font-weight:600;margin-top:1px}
.t-corp .co-h{font-size:14px}
.t-corp .grp .sub{margin:6px 0 0 0;padding-left:12px;border-left:2px solid color-mix(in srgb,var(--cva) 20%,#fff)}
.t-corp .grp .sub .rtl{font-size:13.5px;font-weight:600}
.t-corp .dt{font-size:11.5px;color:#5A6472;white-space:nowrap;font-variant-numeric:tabular-nums}
.t-corp .plain{list-style:none;padding:0;margin:0}
.t-corp .plain li{margin:2px 0;padding:0}
.t-corp .two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}
.t-corp .gdpr{margin-top:22px;font-size:10.5px;color:#5A6472}
@media (max-width:640px){.t-corp{padding:24px 18px}.t-corp .aoe{grid-template-columns:minmax(0,1fr)}.t-corp .two{grid-template-columns:minmax(0,1fr)}.t-corp .hd{flex-direction:column-reverse}.t-corp .rt{flex-direction:column;gap:0}}
@media (max-width:640px){.t-modern{grid-template-columns:minmax(0,1fr)}.t-modern .mn{padding:22px 18px}.t-exec .band{flex-direction:column;align-items:flex-start;padding:22px 18px}.t-exec .body{padding:2px 18px 22px}.t-exec .two{grid-template-columns:minmax(0,1fr)}.t-classic{padding:22px 18px}.cv .rt{flex-direction:column;gap:0}}
`;

/** Print-to-PDF: A4, accent colours preserved, no UI chrome, sensible page breaks. */
export const CV_PRINT_CSS = `
@page{size:A4;margin:0}
html,body{margin:0;padding:0;background:#fff}
.print-bar{position:sticky;top:0;display:flex;gap:10px;align-items:center;justify-content:center;padding:10px;background:#0F1B2D;color:#fff;font:14px Inter,system-ui,sans-serif}
.print-bar button{font:inherit;font-weight:600;border:0;border-radius:8px;padding:8px 14px;background:#3DB5A3;color:#06211D;cursor:pointer}
.sheet{max-width:210mm;margin:0 auto}
.sheet .cv{border:0;border-radius:0;box-shadow:none;min-height:297mm}
@media print{
  .print-bar{display:none}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{max-width:none}
  .cv{font-size:10.5pt}
  .cv .role,.cv .cs h3{break-inside:avoid}
  .cv h3{break-after:avoid}
  .t-modern{grid-template-columns:62mm minmax(0,1fr)}
  .t-modern .mn{padding:12mm 12mm}
  .t-modern .sb{padding:12mm 8mm}
  .t-exec .band{padding:10mm 12mm}
  .t-exec .body{padding:2mm 12mm 10mm}
  .t-classic{padding:12mm 15mm}
  .t-corp{padding:0;font-size:9.8pt;min-height:0}
  .t-corp h2{font-size:22pt}
  .t-corp .hl{font-size:11.5pt}
  .t-corp .ct,.t-corp .dt{font-size:8.8pt}
  .t-corp .rtl{font-size:10.4pt}
  .t-corp .co{font-size:9.8pt}
  .t-corp h3{font-size:8.8pt}
  .t-corp .cs{margin-top:5mm}
  .t-corp .aoe{grid-template-columns:repeat(3,minmax(0,1fr))}
  .t-corp .two{grid-template-columns:1fr 1fr}
  .t-corp li,.t-corp .rt,.t-corp .sub{break-inside:avoid}
  .t-corp .hi{break-inside:avoid}
  .t-corp .role:not(.grp),.t-corp .grp>.rt{break-inside:avoid}
  .t-corp .grp>.rt{break-after:avoid}
}`;

export function cvDocCss(accent: string): string {
  return `body{font-family:Calibri,Arial,sans-serif;font-size:10.5pt;color:#1F2933}h2{font-size:22pt;margin:0;color:#0F1B2D}.hl{color:${accent};font-weight:bold;margin:2pt 0}.ct{color:#52606D;font-size:9.5pt}h3{font-size:9.5pt;text-transform:uppercase;letter-spacing:1px;color:${accent};border-bottom:1px solid #DCE1E6;margin:12pt 0 4pt;padding-bottom:2pt}.co,.dt{color:#52606D;font-size:9.5pt}ul{margin:2pt 0 2pt 14pt;padding:0}li{margin:1pt 0}p{margin:2pt 0}.role{margin-bottom:6pt}.sb,.sb p,.sb dt,.sb dd,.sb h3{color:#FFFFFF}.sb h3{border-color:#FFFFFF}.band h2,.band p{color:#FFFFFF}.classic header{text-align:center}dl{margin:0}dt{font-weight:bold}dd{margin:0 0 3pt 0}mark{background:none}img.ph{width:90pt;height:90pt}.corp h2{font-family:Georgia,serif;font-size:24pt;color:#111A26}.corp .hl{font-family:Georgia,serif;font-style:italic;color:${accent};font-weight:normal}.corp h3{font-family:Georgia,serif;letter-spacing:2px;border-bottom:1px solid ${accent}}.corp hr{border:0;border-top:2pt solid ${accent};margin:6pt 0}.corp .co{color:${accent};font-weight:bold;font-variant:small-caps}.corp .rtl{font-size:11.5pt}`;
}
