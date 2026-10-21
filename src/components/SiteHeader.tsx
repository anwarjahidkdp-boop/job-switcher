import Link from "next/link";
import { Logo } from "./ui";
import { NavLinks } from "./NavLinks";

export function SiteHeader(props: { inApp: boolean; signedIn?: boolean; countryName?: string; trialLabel?: string | null; notice?: string; unread?: number }) {
  return (
    <>
      <div className="top">
        <div className="wrap">
          <Link className="brand" href="/">
            <Logo />
            <span>Job<span className="brand-pao">Pao</span></span>
          </Link>
          {props.inApp ? (
            <>
              <NavLinks />
              <Link className="chip-trial" href="/profile" title="Change target country">Applying in {props.countryName}</Link>
              {props.trialLabel ? <Link className="chip-trial" href="/upgrade" title="Plan and payment">{props.trialLabel}</Link> : null}
              <Link className="bell" href="/notifications" aria-label={props.unread ? `Notifications, ${props.unread} new` : "Notifications"}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                {props.unread ? <span className="bell-n num">{props.unread > 9 ? "9+" : props.unread}</span> : null}
              </Link>
            </>
          ) : (
            <>
              <div style={{ flex: 1 }} />
              {props.signedIn ? <Link className="btn btn-sm top-dash" href="/inbox"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>My dashboard</Link> : <div className="top-cta"><Link className="btn btn-ghost btn-sm" href="/login?next=/inbox">Log in</Link><Link className="btn btn-primary btn-sm" href="/login?mode=signup&next=/onboarding">Sign up free</Link></div>}
            </>
          )}
        </div>
      </div>
      {props.notice ? <div className="proto"><div className="wrap">{props.notice}</div></div> : null}
    </>
  );
}
