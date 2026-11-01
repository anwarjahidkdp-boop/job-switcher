"use client";

/** In the installed app a normal link opens inside JobPao's window, so going back loses the place. There it opens the
 * phone's own browser instead (Chrome on Android, Safari on iPhone); in a browser tab it is an ordinary new-tab link. */
export function browserUrl(url: string, ua: string): string | null {
  const u = new URL(url);
  if (/android/i.test(ua)) return `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  if (/iphone|ipad|ipod/i.test(ua)) return `x-safari-${url}`;
  return null;
}
const installed = () => typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export function ExternalLink({ href, className, style, children }: { href: string; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return <a href={href} className={className} style={style} target="_blank" rel="noopener noreferrer" onClick={(e) => {
    if (!installed()) return;
    const to = browserUrl(href, navigator.userAgent);
    if (!to) return;
    e.preventDefault();
    window.location.href = to;
  }}>{children}</a>;
}
