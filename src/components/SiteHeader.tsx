import Link from "next/link";
import { Logo } from "./ui";
import { NavLinks } from "./NavLinks";
import { BackButton } from "./BackButton";

export function SiteHeader(props: { inApp: boolean; signedIn?: boolean; countryName?: string; trialLabel?: string | null; notice?: string; unread?: number }) {
  return (
    <>
      <div className="top">
        <div className="wrap">
          {props.signedIn || props.inApp ? <BackButton /> : null}
          <Link prefetch={false} className="brand" href="/">
            <Logo />
            <span>Job<span className="brand-pao">Pao</span></span>
          </Link>
          {props.inApp ? (
            <>
              <NavLinks />
              <Link prefetch={false} className="chip-trial chip-country" href="/profile" title="Change target country"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/></svg><span>Applying in <b>{props.countryName}</b></span></Link>
              {props.trialLabel ? <Link prefetch={false} className="chip-trial chip-plan" href="/upgrade" title="Plan and payment"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>{props.trialLabel}</span></Link> : null}
              <Link prefetch={false} className="bell" href="/notifications" aria-label={props.unread ? `Notifications, ${props.unread} new` : "Notifications"}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                {props.unread ? <span className="bell-n num">{props.unread > 9 ? "9+" : props.unread}</span> : null}
              </Link>
            </>
          ) : (
            <>
              <div style={{ flex: 1 }} />
              {props.signedIn ? <Link prefetch={false} className="btn btn-sm top-dash" href="/inbox"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>My dashboard</Link> : <div className="top-cta"><Link prefetch={false} className="btn btn-ghost btn-sm" href="/login?next=/inbox">Log in</Link><Link prefetch={false} className="btn btn-primary btn-sm" href="/login?mode=signup&next=/onboarding">Sign up free</Link></div>}
            </>
          )}
        </div>
      </div>
      {props.notice ? <div className="proto"><div className="wrap">{props.notice}</div></div> : null}
    </>
  );
}
