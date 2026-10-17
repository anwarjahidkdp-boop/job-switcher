import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Ring, BandPill } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import type { Band } from "@/lib/types";

export const dynamic = "force-dynamic";

const MOCK: [string, string, number, Band][] = [["Assistant Manager, Accounts", "Shuvra Knit Composite Ltd.", 96, "ex"], ["Finance Manager", "Nodi Agro Foods Ltd.", 84, "st"], ["VAT & Tax Specialist", "Meghdoot Ceramics Ltd.", 78, "st"]];
const FEATURES: [string, string, React.ReactNode][] = [
  ["Professional CV", "Turn your existing CV into an attractive, recruiter-ready CV in the format your target country expects.", <><s className="muted">Responsible for accounts and reporting.</s><br />Prepare monthly financial and management reports for senior management.</>],
  ["Jobs find you", "Job Switcher keeps looking for opportunities that match your career.", "Checked company pages, public job boards and the job alerts you forward, every day."],
  ["Know why it matches", "See exactly why a role fits your profile.", <>✓ 9 years experience (6+ asked)<br />⚠ Power BI requested but not listed</>],
  ["Application ready", "Tailored CV, cover letter and application email prepared for you.", "Tailored CV · Cover letter · Email · Checklist"],
  ["Never miss a deadline", "Apply later and Job Switcher reminds you.", "Reminder: Oct 7 · Deadline: Oct 10"],
  ["Grow your career", "See which skills are limiting your opportunities.", "Power BI appeared in 3 of 11 relevant jobs analysed."],
];

export default async function Landing() {
  let signedIn = false;
  if (supabaseConfigured()) {
    const { data } = await (await createClient()).auth.getUser();
    signedIn = !!data.user;
  }
  const start = signedIn ? "/onboarding" : "/login?next=/onboarding";
  return (
    <>
      <SiteHeader inApp={false} signedIn={signedIn} />
      <main><div className="wrap">
        <section className="hero">
          <div>
            <p className="eyebrow">Your personal AI career agent</p>
            <h1 style={{ marginTop: 12 }}>Stop searching for jobs. <span>Let the right jobs find you.</span></h1>
            <p className="lead">Upload your CV once. Job Switcher improves your professional profile, finds relevant opportunities in Bangladesh and abroad, prepares your applications and keeps you ahead of every deadline.</p>
            <div className="row">
              <Link className="btn btn-primary" href={start}>Upload My CV</Link>
              <Link className="btn btn-ghost" href={signedIn ? "/onboarding?demo=1" : "/login?next=%2Fonboarding%3Fdemo%3D1"}>Try with a sample CV</Link>
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>7 days of full Pro free. No card needed to start.</p>
            <p className="small muted" style={{ marginTop: 4 }}>Launching in Bangladesh. Also apply to the UAE, Saudi Arabia, Malaysia, the UK, Canada, Australia and the USA, with your CV in each country&apos;s format.</p>
          </div>
          <div className="card mock" aria-label="Example inbox">
            <div className="mock-head"><h3 style={{ fontSize: 17 }}>3 Strong Matches Today</h3><span className="small muted">from 38 new jobs</span></div>
            {MOCK.map(([t, c, s, b]) => (
              <div key={t} className="opp" style={{ cursor: "default" }}>
                <Ring score={s} band={b} />
                <div><h4>{t}</h4><div className="meta">{c} · Dhaka</div><div className="why">✓ Financial reporting · ✓ VAT &amp; Tax · ✓ {s > 90 ? "Textile industry" : "Advanced Excel"}</div></div>
                <span className="dlc"><BandPill band={b} /></span>
              </div>
            ))}
          </div>
        </section>
        <section className="block">
          <h2>What Job Switcher does for you</h2>
          <div className="feat">
            {FEATURES.map(([h, p, v]) => (
              <div key={h} className="card"><h3>{h}</h3><p className="muted">{p}</p><div className="vis">{v}</div></div>
            ))}
          </div>
          <div className="trust">
            <div><strong>No passwords needed</strong><span className="muted">We never ask for your Bdjobs or LinkedIn password.</span></div>
            <div><strong>Nothing sent without you</strong><span className="muted">Every application waits for your approval. You submit it yourself.</span></div>
            <div><strong>Your CV stays private</strong><span className="muted">Private storage, never public. Delete your data at any time.</span></div>
          </div>
          <div className="card price">
            <p className="eyebrow">Job Switcher Pro</p>
            <p className="amt num">৳199<span className="small muted" style={{ fontFamily: "var(--body)", fontWeight: 400 }}> / month</span></p>
            <p className="muted">Starts with a 7-day full trial. Daily matching, application preparation, reminders and career insights.</p>
            <div className="row" style={{ marginTop: 16 }}><Link className="btn btn-primary" href={start}>Start free trial</Link></div>
          </div>
        </section>
      </div></main>
      <footer className="footer"><div className="wrap">Job Switcher · Your data is yours: export or delete it from your profile at any time.</div></footer>
    </>
  );
}
