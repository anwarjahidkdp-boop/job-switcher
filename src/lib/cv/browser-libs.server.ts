// Server stand-in for ./browser-libs.ts (see next.config.ts). CV parsing never runs on the server.
const unavailable = (): never => { throw new Error("CV file parsing runs in the browser only"); };
export const loadPdfjs: typeof import("./browser-libs").loadPdfjs = async () => unavailable();
export const loadMammoth: typeof import("./browser-libs").loadMammoth = async () => unavailable();
