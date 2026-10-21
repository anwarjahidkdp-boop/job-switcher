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
.t-corp{padding:40px 46px;font-family:Calibri,Carlito,"Segoe UI",Inter,system-ui,sans-serif;font-size:13.5px;color:#222B36}
.t-corp header{padding-bottom:14px;border-bottom:2px solid var(--cva);box-shadow:0 3px 0 -2px #fff,0 4px 0 -2px color-mix(in srgb,var(--cva) 35%,#fff)}
.t-corp .hd{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}
.t-corp h2{font-family:Georgia,Cambria,"Times New Roman",serif;font-weight:700;font-size:31px;letter-spacing:.01em;color:#111A26}
.t-corp .hl{font-family:Georgia,Cambria,serif;font-weight:400;font-style:italic;font-size:15px;color:var(--cva);margin-top:5px}
.t-corp .ct{display:flex;flex-wrap:wrap;gap:2px 0;margin-top:9px;font-size:12.5px;color:#46505C}
.t-corp .ct span+span::before{content:"|";margin:0 9px;color:color-mix(in srgb,var(--cva) 45%,#fff)}
.t-corp .ph{width:88px;height:88px;border-radius:6px;font-size:26px}
.t-corp .cs{margin-top:20px}
.t-corp h3{display:flex;align-items:center;gap:10px;font-family:Georgia,Cambria,serif;font-size:12.5px;letter-spacing:.16em;color:var(--cva);font-weight:700;margin-bottom:9px}
.t-corp h3::after{content:"";flex:1;height:1px;background:color-mix(in srgb,var(--cva) 30%,#fff)}
.t-corp .cs>p{text-align:justify;hyphens:auto}
.t-corp .hi{list-style:none;padding:10px 14px;margin:0;background:color-mix(in srgb,var(--cva) 5%,#fff);border-left:3px solid var(--cva)}
.t-corp .hi li{position:relative;padding-left:16px}
.t-corp .hi li::before{content:"";position:absolute;left:0;top:.62em;width:6px;height:6px;background:var(--cva);transform:rotate(45deg)}
.t-corp .aoe{columns:3;column-gap:18px;list-style:none;padding:0;margin:0}
.t-corp .aoe li{break-inside:avoid;padding-left:13px;position:relative;margin:2px 0}
.t-corp .aoe li::before{content:"";position:absolute;left:0;top:.6em;width:5px;height:5px;background:var(--cva)}
.t-corp .role{margin-bottom:14px}
.t-corp .rtl{font-size:14.5px;color:#111A26}
.t-corp .co{font-variant:small-caps;letter-spacing:.04em;font-size:13px;color:var(--cva);font-weight:600;margin-top:1px}
.t-corp .dt{font-size:12px;color:#46505C}
.t-corp .two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px}
@media (max-width:640px){.t-corp{padding:24px 18px}.t-corp .aoe{columns:1}.t-corp .two{grid-template-columns:minmax(0,1fr)}.t-corp .hd{flex-direction:column-reverse}}
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
  .t-corp{padding:13mm 16mm;font-size:10.5pt}
  .t-corp .aoe{columns:3}
  .t-corp .two{grid-template-columns:1fr 1fr}
}`;

export function cvDocCss(accent: string): string {
  return `body{font-family:Calibri,Arial,sans-serif;font-size:10.5pt;color:#1F2933}h2{font-size:22pt;margin:0;color:#0F1B2D}.hl{color:${accent};font-weight:bold;margin:2pt 0}.ct{color:#52606D;font-size:9.5pt}h3{font-size:9.5pt;text-transform:uppercase;letter-spacing:1px;color:${accent};border-bottom:1px solid #DCE1E6;margin:12pt 0 4pt;padding-bottom:2pt}.co,.dt{color:#52606D;font-size:9.5pt}ul{margin:2pt 0 2pt 14pt;padding:0}li{margin:1pt 0}p{margin:2pt 0}.role{margin-bottom:6pt}.sb,.sb p,.sb dt,.sb dd,.sb h3{color:#FFFFFF}.sb h3{border-color:#FFFFFF}.band h2,.band p{color:#FFFFFF}.classic header{text-align:center}dl{margin:0}dt{font-weight:bold}dd{margin:0 0 3pt 0}mark{background:none}img.ph{width:90pt;height:90pt}.corp h2{font-family:Georgia,serif;font-size:24pt;color:#111A26}.corp .hl{font-family:Georgia,serif;font-style:italic;color:${accent};font-weight:normal}.corp h3{font-family:Georgia,serif;letter-spacing:2px;border-bottom:1px solid ${accent}}.corp hr{border:0;border-top:2pt solid ${accent};margin:6pt 0}.corp .co{color:${accent};font-weight:bold;font-variant:small-caps}.corp .rtl{font-size:11.5pt}`;
}
