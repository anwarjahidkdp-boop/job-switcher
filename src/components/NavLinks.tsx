"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const I = (d: string) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />;
const NAV: [string, string, string, React.ReactNode][] = [
  ["/inbox", "My dashboard", "Home", I('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>')],
  ["/queue", "Ready to Apply", "Ready to Apply", I('<path d="M4 6h16M4 12h16M4 18h10"/>')],
  ["/applications", "Applications", "Applied", I('<path d="M20 6 9 17l-5-5"/>')],
  ["/insights", "Insights", "Insights", I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>')],
  ["/profile", "Profile", "Profile", I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')],
];

/** Top tabs on wide screens; on phones the same links become an app-style bar fixed at the bottom. */
export function NavLinks() {
  const path = usePathname();
  const cur = path.startsWith("/jobs") ? "/queue" : path;
  return (
    <nav className="nav" aria-label="Main">
      {NAV.map(([href, label, short, icon]) => (
        <Link prefetch={false} key={href} href={href} aria-current={cur.startsWith(href) ? "page" : undefined}>
          <span className="nav-ic">{icon}</span><span className="nav-l">{label}</span><span className="nav-s">{short}</span>
        </Link>
      ))}
    </nav>
  );
}
