import Link from "next/link";
import { Logo } from "./ui";
import { NavLinks } from "./NavLinks";

export function SiteHeader(props: { inApp: boolean; signedIn?: boolean; countryName?: string; trialLabel?: string | null; notice?: string }) {
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
            </>
          ) : (
            <>
              <div style={{ flex: 1 }} />
              {props.signedIn ? <Link className="btn btn-ghost btn-sm" href="/inbox">Open my dashboard</Link> : <div className="top-cta"><Link className="btn btn-ghost btn-sm" href="/login?next=/inbox">Log in</Link><Link className="btn btn-primary btn-sm" href="/login?mode=signup&next=/onboarding">Sign up free</Link></div>}
            </>
          )}
        </div>
      </div>
      {props.notice ? <div className="proto"><div className="wrap">{props.notice}</div></div> : null}
    </>
  );
}
