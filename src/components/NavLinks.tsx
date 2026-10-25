"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const I = (d: string) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />;
// Icons follow the progress-card set: briefcase, search, paper plane, AI chip and CV document.
const NAV: [string, string, string, React.ReactNode][] = [
  ["/inbox", "My dashboard", "Home", I('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>')],
  ["/opportunities", "Opportunities", "Jobs", I('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>')],
  ["/applications", "Applications", "Applied", I('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>')],
  ["/insights", "Insights", "Insights", I('<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/><path d="M9.5 14.5 11 9.5l1.5 5M10 13h2M14.5 9.5v5"/>')],
  ["/profile", "Profile", "Profile", I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>')],
];

/** Top tabs on wide screens; on phones the same links become an app-style bar fixed at the bottom. */
export function NavLinks() {
  const path = usePathname();
  // A job page and the ready-to-apply queue both belong to the Jobs tab.
  const cur = path.startsWith("/jobs") || path.startsWith("/queue") ? "/opportunities" : path;
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
