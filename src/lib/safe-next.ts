// Where to send someone after signing in. Only a path on this site: "//x", "/\x" and other tricks that browsers read as
// another site are refused.
export function safeNext(p: string | null | undefined, fallback = "/onboarding"): string {
  if (!p || typeof p !== "string" || p.length > 500) return fallback;
  if (!/^\/(?![/\\])/.test(p) || /[\\\u0000-\u001f\u007f]/.test(p)) return fallback;
  try {
    const u = new URL(p, "https://jobpao.invalid");
    return u.origin === "https://jobpao.invalid" ? u.pathname + u.search + u.hash : fallback;
  } catch { return fallback; }
}
