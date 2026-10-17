import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Ring } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import type { Band } from "@/lib/types";
import { headers } from "next/headers";
import { countryFromHeader, formatPrice, proPrice } from "@/lib/billing/pricing";

export const dynamic = "force-dynamic";

// Line icons drawn on a 24px grid; stroke follows currentColor.
const ICONS: Record<string, React.ReactNode> = {
  cv: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h4" /></>,
  radar: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 12l5-5" /></>,
  match: <><path d="M4 12l5 5L20 6" /></>,
  send: <><path d="M4 12l16-8-6 16-2-7z" /></>,
  bell: <><path d="M6 16V11a6 6 0 0112 0v5l2 2H4z" /><path d="M10 21h4" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  hand: <><path d="M12 3v10M8 7l4-4 4 4" /><path d="M5 14v5h14v-5" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
};
function Icon({ name }: { name: string }) {
  return <svg className="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>;
}

const MOCK: [string, string, number, Band][] = [["Assistant Manager, Accounts", "Shuvra Knit Composite", 96, "ex"], ["Finance Manager", "Nodi Agro Foods", 84, "st"], ["VAT & Tax Specialist", "Meghdoot Ceramics", 78, "st"]];
const FEATURES: [string, string, string][] = [
  ["cv", "AI-rebuilt CV", "A clean, recruiter-ready CV in your target country's format."],
  ["radar", "Jobs come to you", "Matching jobs collected for you every day."],
  ["match", "Match score", "See why each job fits, and what's missing."],
  ["send", "Ready to apply", "Application email and checklist for each job."],
  ["bell", "Deadline alerts", "Reminders before every closing date."],
  ["chart", "Skill insights", "Learn which skills unlock better jobs."],
];
// Same person, two different jobs: what the tailored CV leads with and what the cover letter argues.
const TAILOR: [string, string, string[], string][] = [
  ["Assistant Manager, Accounts", "Textile · Dhaka", ["Monthly reporting for a 2,000-staff factory", "VAT & tax filing", "Textile industry experience"], "Opens with your factory reporting work."],
  ["Finance Manager", "FMCG · Dhaka", ["Budgeting and cost control", "Leading a team of 4", "Management reports"], "Opens with budgets and team leadership."],
];
const YOU = ["Upload your CV once", "Review and press apply"];
const US = ["Rebuilds your CV professionally", "Finds new matching jobs daily", "Writes a tailored CV and cover letter for each", "Prepares the application email", "Reminds you before deadlines", "Shows which skills to grow next"];
const STEPS: [string, string][] = [
  ["Upload your CV", "PDF, Word or a photo of each page."],
  ["Get matched", "Fresh jobs, scored against your profile."],
  ["Apply with confidence", "Everything prepared. You approve and send."],
];
const TRUST: [string, string, string][] = [
  ["lock", "No passwords", "We never ask for your Bdjobs or LinkedIn login."],
  ["hand", "You stay in control", "Nothing is sent without your approval."],
  ["shield", "Private by default", "Your CV is never public. Delete it any time."],
];
const PRO = ["Daily job matching", "A tailored CV for every job", "A matching cover letter for every job", "Deadline reminders", "Career insights"];

export default async function Landing() {
  let signedIn = false;
  if (supabaseConfigured()) {
    const { data } = await (await createClient()).auth.getUser();
    signedIn = !!data.user;
  }
  const start = signedIn ? "/onboarding" : "/login?next=/onboarding";
  const demo = signedIn ? "/onboarding?demo=1" : "/login?next=%2Fonboarding%3Fdemo%3D1";
  const local = proPrice(countryFromHeader((await headers()).get("cf-ipcountry")));
  return (
    <>
      <SiteHeader inApp={false} signedIn={signedIn} />
      <main className="lp">
        <section className="lp-hero">
          <div className="wrap lp-hero-in">
            <div>
              <p className="lp-tag"><span className="lp-dot" />AI career agent</p>
              <h1>Let the right jobs <span>find you.</span></h1>
              <p className="lp-lead">Upload your CV once. From then on, Job Switcher works for you every day until you&apos;re hired. You just review and apply.</p>
              <div className="lp-cta">
                <Link className="btn btn-primary lp-btn" href={start}>Upload my CV</Link>
                <Link className="btn lp-btn lp-btn-ghost" href={demo}>Try a sample</Link>
              </div>
              <p className="lp-fine">7 days free · No card needed</p>
            </div>
            <div className="lp-mock" aria-label="Example of today's matches">
              <div className="lp-mock-head"><span>Today&apos;s matches</span><span className="lp-live">Example</span></div>
              {MOCK.map(([t, c, s, b]) => (
                <div key={t} className="lp-job">
                  <Ring score={s} band={b} />
                  <div className="lp-jt"><b>{t}</b><span>{c} · Dhaka</span></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="wrap">
          <div className="lp-stats">
            <div><b>1 min</b><span>to upload</span></div>
            <div><b>9-point</b><span>match score</span></div>
            <div><b>8+</b><span>countries</span></div>
          </div>

          <section className="lp-sec lp-auto">
            <p className="lp-kicker">Your career on autopilot</p>
            <h2>You upload once. We take it from there.</h2>
            <div className="lp-split">
              <div className="lp-you">
                <p className="lp-who">Your part</p>
                <ul>{YOU.map((x) => <li key={x}><Icon name="hand" />{x}</li>)}</ul>
              </div>
              <div className="lp-us">
                <p className="lp-who">Job Switcher, every day until you&apos;re hired</p>
                <ul>{US.map((x) => <li key={x}><Icon name="match" />{x}</li>)}</ul>
              </div>
            </div>
          </section>

          <section className="lp-sec lp-tailor">
            <p className="lp-kicker">Our biggest advantage</p>
            <h2>A different CV and cover letter for every job</h2>
            <p className="lp-sub">One CV for every job gets ignored. Job Switcher reads each job&apos;s requirements and rewrites your CV and cover letter to match them, using only your real experience.</p>
            <div className="lp-tgrid">
              {TAILOR.map(([job, meta, pts, letter]) => (
                <div key={job} className="lp-tcard">
                  <div className="lp-tjob"><span className="lp-tfor">For</span><b>{job}</b><span className="lp-tmeta">{meta}</span></div>
                  <div className="lp-tdocs">
                    <div><p className="lp-tlabel"><Icon name="cv" />Tailored CV highlights</p><ul>{pts.map((x) => <li key={x}>{x}</li>)}</ul></div>
                    <div><p className="lp-tlabel"><Icon name="send" />Cover letter</p><p className="lp-tletter">{letter}</p></div>
                  </div>
                </div>
              ))}
            </div>
            <p className="lp-tnote"><Icon name="shield" />Never invents skills or experience. Everything comes from your own CV.</p>
          </section>

          <section className="lp-sec">
            <p className="lp-kicker">What you get</p>
            <h2>Everything to land your next job</h2>
            <div className="lp-feat">
              {FEATURES.map(([ic, h, p]) => (
                <div key={h} className="lp-fcard"><span className="lp-icwrap"><Icon name={ic} /></span><h3>{h}</h3><p>{p}</p></div>
              ))}
            </div>
          </section>

          <section className="lp-sec">
            <p className="lp-kicker">How it works</p>
            <h2>Three simple steps</h2>
            <ol className="lp-steps">
              {STEPS.map(([h, p], i) => (
                <li key={h}><span className="lp-n">{i + 1}</span><div><h3>{h}</h3><p>{p}</p></div></li>
              ))}
            </ol>
          </section>

          <section className="lp-sec">
            <div className="lp-trust">
              {TRUST.map(([ic, h, p]) => (
                <div key={h}><Icon name={ic} /><div><b>{h}</b><span>{p}</span></div></div>
              ))}
            </div>
          </section>

          <section className="lp-sec lp-price-wrap">
            <div className="lp-price">
              <p className="lp-kicker">Job Switcher Pro</p>
              <p className="lp-amt num">{formatPrice(local.minor, local.currency)}<span> / month</span></p>
              <ul>{PRO.map((x) => <li key={x}><Icon name="match" />{x}</li>)}</ul>
              <Link className="btn btn-primary lp-btn lp-full" href={start}>Start 7-day free trial</Link>
            </div>
            <p className="lp-global"><Icon name="globe" />Bangladesh, UAE, Saudi Arabia, Malaysia, UK, Canada, Australia and USA.</p>
          </section>
        </div>
      </main>
      <footer className="footer"><div className="wrap">© Job Switcher · Your data is yours. Export or delete it any time.</div></footer>
    </>
  );
}
