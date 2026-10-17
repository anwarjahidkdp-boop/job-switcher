"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: [string, string][] = [["/inbox", "Opportunities"], ["/queue", "Apply Queue"], ["/applications", "Applications"], ["/insights", "Insights"], ["/profile", "Profile"]];

export function NavLinks() {
  const path = usePathname();
  const cur = path.startsWith("/jobs") ? "/inbox" : path;
  return (
    <nav className="nav" aria-label="Main">
      {NAV.map(([href, label]) => (
        <Link key={href} href={href} aria-current={cur.startsWith(href) ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
