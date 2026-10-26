import type { NextConfig } from "next";

// Restrict third-party scripts/frames to the configured CAPTCHA provider; the app itself cannot be framed.
const captcha=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?" https://challenges.cloudflare.com":"";
const csp = (extra: { script?: string; connect?: string; frame?: string } = {}) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${captcha}${extra.script ?? ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${captcha}${extra.connect ?? ""}`,
  "worker-src 'self' blob:",
  captcha||extra.frame?`frame-src${captcha}${extra.frame ?? ""}`:"frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");
const CSP = csp();
// Only the card payment page may load Paddle.js and its checkout frame.
const PAY_CSP = csp({ script: " https://cdn.paddle.com https://public.profitwell.com", connect: " https://*.paddle.com", frame: " https://buy.paddle.com https://sandbox-buy.paddle.com" });

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // PDF/DOCX parsers load in the browser only; the server build gets a stub (keeps the Worker bundle small).
      "cv-browser-libs": { browser: "./src/lib/cv/browser-libs.ts", default: "./src/lib/cv/browser-libs.server.ts" },
    },
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
      // Listed after the site-wide rule, so this CSP replaces it on /pay.
      { source: "/pay", headers: [{ key: "Content-Security-Policy", value: PAY_CSP }] },
    ];
  },
};

export default nextConfig;
