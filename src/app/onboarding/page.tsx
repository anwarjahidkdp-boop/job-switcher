import { setupRequirements } from "@/lib/eligibility";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { countryFromHeader } from "@/lib/billing/pricing";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { CvPreview } from "@/components/CvPreview";
import { CvToolbar } from "@/components/CvToolbar";
import { requireUser, photoUrl, trialLabel, profileOf } from "@/lib/server/page";
import { buildMatchProfile } from "@/lib/facts";
import { DEFAULT_META, loadState } from "@/lib/server/state";
import { cname, portals, rule, perLabel } from "@/lib/countries";
import { resolveStyle } from "@/lib/cv/render";
import { convention, personalFields } from "@/lib/cv/conventions";
import { inboxList } from "@/lib/matching";
import { aiConfigured } from "@/lib/ai";
import { saveAnswersAction, finishOnboardingAction, backToStepAction } from "../actions";
import { CountryStep, UploadStep, PrefsStep } from "./steps";
import { ManualCvEditor } from "@/components/ManualCvEditor";
import { manualDraft } from "@/lib/manual-cv";
import { CvSuggestions } from "@/components/CvSuggestions";
import { BdjobsConnectCard } from "@/components/BdjobsConnectCard";

export const metadata = { title: "Get started" };
export const maxDuration = 120;

const STEPS: [string, string][] = [["country", "Target country"], ["upload", "Your CV"], ["questions", "A few questions"], ["prefs", "Preferences"], ["reveal", "Your new CV"]];
function Steps({ cur }: { cur: string }) {
  const i = STEPS.findIndex((s) => s[0] === cur);
  return <ol className="ob-steps" aria-label="Setup steps">{STEPS.map(([k, l], j) => <li key={k} className={j === i ? "on" : j < i ? "done" : ""} aria-current={j === i ? "step" : undefined}><i>{j < i ? "✓" : j + 1}</i><span>{l}</span></li>)}</ol>;
}

/** Navy band at the top of every setup step, in the same look as the home page hero. */
function Head({ cur, kicker, title, sub, back, action }: { cur: string; kicker: string; title: React.ReactNode; sub?: React.ReactNode; back?: "country" | "upload" | "prefs"; action?: React.ReactNode }) {
  return <section className="ob-hero"><div className="wrap"><div className="ob-in">
    <Steps cur={cur} />
    {back ? <form action={backToStepAction.bind(null, back)}><button className="ob-back">← Back</button></form> : null}
    <p className="ob-kicker">{kicker}</p>
    {action ? <div className="ob-headrow"><div><h1>{title}</h1>{sub ? <p className="ob-sub">{sub}</p> : null}</div><div className="ob-action">{action}</div></div> : <>
      <h1>{title}</h1>
      {sub ? <p className="ob-sub">{sub}</p> : null}
    </>}
  </div></div></section>;
}

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ demo?: string; step?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser("/onboarding");
  const st = await loadState(supabase, user.id, profileOf(supabase, user.id));
  if (!st) redirect("/login");
  const requiredSetup=setupRequirements(st.profile).length>0;
  const editing = st.profile.onboarding_step === "done" && (sp.step === "prefs" || requiredSetup);
  // "done" without a CV (an old account, or a failed save) would bounce between here and the dashboard: ask for the CV again.
  const noCv = st.profile.onboarding_step === "done" && !st.master;
  if (st.profile.onboarding_step === "done" && !editing && !noCv) redirect("/inbox");
  const step = noCv ? "upload" : editing ? "prefs" : requiredSetup && st.profile.onboarding_step==="reveal" ? "prefs" : st.profile.onboarding_step;
  const country = st.country, r = rule(country), cn = cname(country);
  // First visit: guess where they live from Cloudflare's country header; they can change it.
  const ip = (await headers()).get("cf-ipcountry");
  const home = st.profile.billing_country_locked || st.homeCountry !== "BD" || !ip ? st.homeCountry : countryFromHeader(ip);
  const demo = sp.demo === "1";
  const trial = await trialLabel(supabase, user.id);

  let head: React.ReactNode = null;
  let body: React.ReactNode = null;
  if (step === "country") {
    head = <Head cur="country" kicker="Your 5-day Pro trial has started" title={<>Where do you want <span>to work?</span></>} sub="Your CV format, document checklist, salary currency and job matches follow this country. You can change it later in your profile." />;
    body = <div className="ob">
      <CountryStep current={country === "BD" && home !== "BD" && home !== "XX" && st.profile.onboarding_step === "country" ? home : country} home={home} needsVisa={st.profile.needs_visa} demo={demo} billingLocked={st.profile.billing_country_locked} />
    </div>;
  } else if (step === "upload") {
    head = <Head cur="upload" back="country" kicker="Step 2 of 5" title={<>Upload your <span>current CV</span></>} sub={`Even if it is outdated or plain. We read it, ask what is missing, and build a professional ${cn}-format version.`} />;
    body = <div className={`ob${country === "BD" ? " ob-upload-with-bdjobs" : ""}`}>
      <div><UploadStep aiReady={aiConfigured()} autoDemo={demo} /></div>
      {country === "BD" ? <BdjobsConnectCard steps={st.profile.setup_steps || {}} /> : null}
    </div>;
  } else if (step === "questions" && st.cvDoc) {
    const qs = st.cvDoc.questions || [];
    const nExp = st.facts.filter((f) => f.kind === "experience").length, nEdu = st.facts.filter((f) => f.kind === "education").length, nSk = st.facts.filter((f) => f.kind === "skill").length;
    const unverified = st.facts.filter((f) => !f.verified && f.kind !== "answer").length;
    const last = (st.profile.full_name || "").split(" ").slice(-1)[0];
    head = <Head cur="questions" back="upload" kicker="Step 3 of 5" title={<>We read your CV{last ? <>, <span>{last}</span></> : ""}.</>} sub={`Found ${nExp} roles, ${nEdu} degrees and ${nSk} skills. A few short answers will make your CV stronger. Skip anything you are unsure about; we never guess.`} />;
    body = <div className="ob">
      {unverified ? <p className="note" style={{ marginTop: 10 }}>{unverified} item{unverified === 1 ? "" : "s"} we could not find word-for-word in your CV {unverified === 1 ? "is" : "are"} kept aside until you confirm {unverified === 1 ? "it" : "them"} in your profile. Only confirmed facts go on your CV.</p> : null}
      <form action={saveAnswersAction}>
        <div className="stack" style={{ marginTop: 22 }}>
          {qs.map((q) => <div key={q.id} className={`card panel${q.id.startsWith("fresh_") ? " q-fresh" : ""}`}>{q.id.startsWith("fresh_") ? <span className="q-fresh-k">Please check: your CV may be out of date</span> : null}<label className="f" htmlFor={`a_${q.id}`}>{q.question}<input type="text" id={`a_${q.id}`} name={`a_${q.id}`} defaultValue={st.cvDoc!.answers?.[q.id] || ""} placeholder={q.placeholder || ""} maxLength={1000} /></label></div>)}
        </div>
        <div className="row" style={{ marginTop: 20 }}><button className="btn btn-primary">Continue</button></div>
      </form>
    </div>;
  } else if (step === "prefs" || (step === "questions" && !st.cvDoc)) {
    const meta = st.profile.career_meta || {};
    const p = st.profile.preferences || { roles: (meta.target_roles || []).join(", "), locations: country === "BD" ? meta.location || "Dhaka" : "", salaryMin: null, salaryMax: null, notice: null, mode: "On-site" as const };
    p.roles=buildMatchProfile({name:st.profile.full_name||"",facts:st.facts,meta:{...DEFAULT_META,...meta},prefs:null,country}).targetRoles.join(", ");
    const savedSalary=st.profile.answer_library?.salaryCountry===country?st.profile.answer_library.expectedSalary:null;
    if(Number(savedSalary)>0)p.salaryMin=Number(savedSalary);
    head = <Head cur="prefs" back={editing ? undefined : "upload"} kicker={editing ? "Your preferences" : "Step 4 of 5"} title={<>What would a better job <span>look like?</span></>} sub={<>Set your preferences for {cn}. Your existing improved CV will use this destination’s structure, reference conventions and style. Your saved career information will be reused.</>} />;
    body = <div className="ob">
      <PrefsStep answers={st.profile.answer_library||{}} editing={editing} initial={p} personal={st.profile.personal || {}} countryLabel={cn} currency={(r.sym.trim() || "local currency") + perLabel(country)} fields={personalFields(country)} personalCountry={r.personal} refs={{ mode: convention(country).refs, count: convention(country).refCount }} isBD={country === "BD"} country={country} revision={st.profile.search_country_version} needsVisa={st.profile.needs_visa} abroad={country !== home} />
    </div>;
  } else if (step === "reveal" && st.master && st.P) {
    const m = st.master.content;
    const nm = inboxList(st.scored, new Set());
    const strong = nm.filter((x) => x.m.score >= 70).length;
    const { tpl, accent } = resolveStyle(st.profile.cv_style, country);
    const photo = await photoUrl(supabase, st.profile.photo_path);
    head = <Head cur="reveal" back="prefs" kicker="Step 5 of 5" title={<>Your new CV is <span>ready.</span></>}
      sub={<>Next step: check your CV below, then open your dashboard. Your {nm.length} matched jobs are waiting there, best matches first.</>}
      action={<form action={finishOnboardingAction}><button className="btn btn-gold">Go to my dashboard →</button></form>} />;
    body = <>
      <div className="banner"><div><h2 style={{ fontSize: 22 }}>Your new professional CV is ready.</h2><p className="muted">{(m.improvements || []).length} weak lines rewritten. Nothing was added that you did not tell us.</p></div>
        <div className="row"><a className="btn btn-ghost btn-sm" href="/api/cv/download?format=doc">Download (Word)</a><a className="btn btn-ghost btn-sm" href="/api/cv/download?format=print" target="_blank" rel="noopener">PDF</a><form action={finishOnboardingAction}><button className="btn btn-primary">See my {nm.length} opportunities</button></form></div></div>
      {st.master.flags.length ? <p className="note" style={{ marginTop: 12, borderColor: "var(--warn)" }}>Our fact check {st.master.flags.join("; ")}.</p> : null}
      {(m.improvements || []).length ? (
        <div className="card panel imp-card" style={{ marginTop: 22 }}>
          <h3>What we improved <span className="imp-n">{(m.improvements || []).length}</span></h3>
          <ol className="imp-list">{(m.improvements || []).map((i, k) => <li key={k}><span className="imp-after">{i.after}</span><span className="imp-before">Before: {i.before}</span></li>)}</ol>
        </div>
      ) : null}
      <CvSuggestions items={m.suggestions || []} />
      <div style={{ marginTop: 22 }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Your new Master CV, {cn} format</p>
        <CvToolbar tpl={tpl} accent={accent} photoAllowed={r.photo} hasPhoto={!!st.profile.photo_path} countryLabel={cn} rules={r.rules} downloads={{ pdf: "/api/cv/download?format=print", doc: "/api/cv/download?format=doc" }} />
        <ManualCvEditor initial={manualDraft(st.master.content, st.facts)} baseId={st.master.id} country={country} revision={st.profile.search_country_version} />
        <CvPreview master={m} country={country} homeCountry={st.homeCountry} style={st.profile.cv_style} personal={st.profile.personal} noticeDays={st.profile.preferences?.notice ?? null} photoUrl={photo} />
      </div>
      <div className="banner" style={{ marginTop: 22 }}><p><b>We found {nm.length} current opportunities in {cn} relevant to your career.</b> {strong} {strong === 1 ? "is Good Fit or better" : "are Good Fit or better"}.</p><form action={finishOnboardingAction}><button className="btn btn-primary">Open Opportunity Inbox</button></form></div>
      {country === "BD" ? <div style={{marginTop:14}}><BdjobsConnectCard ready steps={st.profile.setup_steps || {}} /></div> : <div className="banner warn" style={{ marginTop: 14 }}><p><b>Last step: get new jobs automatically.</b> A 3-minute setup forwards job-alert emails from {portals(country).slice(0, 2).join(" and ")} to JobPao. No passwords.</p><form action={finishOnboardingAction.bind(null, "/setup")}><button className="btn btn-ghost">Start setup guide</button></form></div>}
      {st.cvDoc?.text_content ? <details className="orig-cv" style={{ marginTop: 22 }}><summary>See the CV you uploaded</summary><div className="raw">{st.cvDoc.text_content.slice(0, 6000)}</div></details> : null}
    </>;
  } else {
    body = <div className="ob"><p className="muted">Let&apos;s pick up where you left off.</p><form action={backToStepAction.bind(null, "upload")}><button className="btn btn-primary" style={{ marginTop: 12 }}>Upload my CV</button></form></div>;
  }
  return (
    <>
      <SiteHeader inApp={false} signedIn trialLabel={trial} />
      <main className="ob-page">{head}<div className="wrap ob-body">{body}</div></main>
      <SiteFooter signedIn />
    </>
  );
}
