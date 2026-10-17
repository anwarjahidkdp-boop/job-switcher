// Loaders for the PDF and Word parsers. Browser builds only: next.config.ts aliases the bare specifier
// "cv-browser-libs" to this file for the browser and to browser-libs.server.ts everywhere else, so neither
// library is bundled into the Cloudflare Worker (they are large and would also burn server CPU time).
export const loadPdfjs = () => import("unpdf");
export const loadMammoth = () => import("mammoth");
