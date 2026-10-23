import Link from "next/link";
import { Logo } from "./ui";

/** Navy footer on every page, matching the home hero. */
export function SiteFooter({ signedIn }: { signedIn?: boolean }) {
  return (
    <footer className="sf">
      <div className="wrap sf-in">
        <div className="sf-brand">
          <Link className="brand" href="/"><Logo /><span>Job<span className="brand-pao">Pao</span></span></Link>
          <p>Your personal job assistant. We find your best-matched jobs, prepare every application and get you ready for the interview.</p>
        </div>
        <nav className="sf-col" aria-label="JobPao">
          <b>JobPao</b>
          <Link href={signedIn ? "/inbox" : "/login?mode=signup&next=/onboarding"}>{signedIn ? "My jobs" : "Start free"}</Link>
          <Link href={signedIn ? "/upgrade" : "/#pricing"}>Pricing</Link>
          <Link href="/setup">Setup guide</Link>
          <Link href="/install">Install / reinstall app</Link>
        </nav>
        <nav className="sf-col" aria-label="Help">
          <b>Help</b>
          <a href="mailto:hello@jobpao.app">hello@jobpao.app</a>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refund">Refunds</Link>
          {signedIn ? <form action="/auth/signout" method="post"><button className="sf-link">Sign out</button></form> : <Link href="/login?next=/inbox">Log in</Link>}
        </nav>
      </div>
      <div className="wrap sf-bot">
        <span>© {new Date().getFullYear()} JobPao · A product of <a className="sf-parent" href="https://yourtechai.com/" target="_blank" rel="noopener">YourTech AI</a></span>
        <span>We never ask for your job-site passwords, and nothing is sent without your OK. Your data is yours: export or delete it any time.</span>
      </div>
    </footer>
  );
}
