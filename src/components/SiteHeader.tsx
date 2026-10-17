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
            <span>Job Switcher</span>
          </Link>
          {props.inApp ? (
            <>
              <NavLinks />
              <Link className="chip-trial" href="/profile" title="Change target country">Applying in {props.countryName}</Link>
              {props.trialLabel ? <span className="chip-trial">{props.trialLabel}</span> : null}
            </>
          ) : (
            <>
              <div style={{ flex: 1 }} />
              {props.signedIn ? <Link className="btn btn-ghost btn-sm" href="/inbox">Open my dashboard</Link> : <Link className="btn btn-primary btn-sm" href="/login?next=/onboarding">Upload My CV</Link>}
            </>
          )}
        </div>
      </div>
      {props.notice ? <div className="proto"><div className="wrap">{props.notice}</div></div> : null}
    </>
  );
}
