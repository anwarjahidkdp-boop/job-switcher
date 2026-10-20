import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { CvPreview } from "@/components/CvPreview";
import { CvToolbar } from "@/components/CvToolbar";
import { requireUser, photoUrl, trialLabel } from "@/lib/server/page";
import { loadState } from "@/lib/server/state";
import { COUNTRIES, COUNTRY_CODES, type CountryRule, cname, PORTALS, rule, perLabel } from "@/lib/countries";
import { resolveStyle } from "@/lib/cv/render";
import { inboxList } from "@/lib/matching";
import { aiConfigured } from "@/lib/ai";
import { saveAnswersAction, finishOnboardingAction, backToStepAction } from "../actions";
import { CountryStep, UploadStep, PrefsStep } from "./steps";

export const metadata = { title: "Get started" };
export const maxDuration = 120;

const STEPS: [string, string][] = [["country", "Target country"], ["upload", "Your CV"], ["questions", "A few questions"], ["prefs", "Preferences"], ["reveal", "Your new CV"]];
function Steps({ cur }: { cur: string }) {
  const i = STEPS.findIndex((s) => s[0] === cur);
  return <ol className="ob-steps" aria-label="Setup steps">{STEPS.map(([k, l], j) => <li key={k} className={j === i ? "on" : j < i ? "done" : ""} aria-current={j === i ? "step" : undefined}><i>{j < i ? "✓" : j + 1}</i><span>{l}</span></li>)}</ol>;
}

/** Navy band at the top of every setup step, in the same look as the home page hero. */
function Head({ cur, kicker, title, sub }: { cur: string; kicker: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return <section className="ob-hero"><div className="wrap"><div className="ob-in">
    <Steps cur={cur} />
    <p className="ob-kicker">{kicker}</p>
    <h1>{title}</h1>
    {sub ? <p className="ob-sub">{sub}</p> : null}
  </div></div></section>;
}

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ demo?: string; step?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser("/onboarding");
  const st = await loadState(supabase, user.id);
  if (!st) redirect("/login");
  const editing = st.profile.onboarding_step === "done" && sp.step === "prefs";
  if (st.profile.onboarding_step === "done" && !editing) redirect("/inbox");
  const step = editing ? "prefs" : st.profile.onboarding_step;
  const country = st.country, r = rule(country), cn = cname(country);
  const demo = sp.demo === "1";
  const trial = await trialLabel(supabase, user.id);

  let head: React.ReactNode = null;
  let body: React.ReactNode = null;
  if (step === "country") {
    head = <Head cur="country" kicker="Your 7-day Pro trial has started" title={<>Where do you want <span>to work?</span></>} sub="Your CV format, document checklist, salary currency and job matches follow this country. You can change it later in your profile." />;
    body = <div className="ob">
      <CountryStep current={country} needsVisa={st.profile.needs_visa} demo={demo} countries={COUNTRY_CODES.map((k) => { const c: CountryRule = COUNTRIES[k]; return { code: k, name: c.name, doc: c.doc, pages: c.pages, photo: c.photo, rules: c.rules }; })} />
    </div>;
  } else if (step === "upload") {
    head = <Head cur="upload" kicker="Step 2 of 5" title={<>Upload your <span>current CV</span></>} sub={`Even if it is outdated or plain. We read it, ask what is missing, and build a professional ${cn}-format version.`} />;
    body = <div className="ob">
      <UploadStep aiReady={aiConfigured()} autoDemo={demo} />
      <form action={backToStepAction.bind(null, "country")}><button className="btn-text small" style={{ marginTop: 8 }}>← Change target country</button></form>
    </div>;
  } else if (step === "questions" && st.cvDoc) {
    const qs = st.cvDoc.questions || [];
    const nExp = st.facts.filter((f) => f.kind === "experience").length, nEdu = st.facts.filter((f) => f.kind === "education").length, nSk = st.facts.filter((f) => f.kind === "skill").length;
    const unverified = st.facts.filter((f) => !f.verified && f.kind !== "answer").length;
    const last = (st.profile.full_name || "").split(" ").slice(-1)[0];
    head = <Head cur="questions" kicker="Step 3 of 5" title={<>We read your CV{last ? <>, <span>{last}</span></> : ""}.</>} sub={`Found ${nExp} roles, ${nEdu} degrees and ${nSk} skills. A few short answers will make your CV stronger. Skip anything you are unsure about; we never guess.`} />;
    body = <div className="ob">
      {unverified ? <p className="note" style={{ marginTop: 10 }}>{unverified} item{unverified === 1 ? "" : "s"} we could not find word-for-word in your CV {unverified === 1 ? "is" : "are"} kept aside until you confirm {unverified === 1 ? "it" : "them"} in your profile. Only confirmed facts go on your CV.</p> : null}
      <form action={saveAnswersAction}>
        <div className="stack" style={{ marginTop: 22 }}>
          {qs.map((q) => <div key={q.id} className="card panel"><label className="f" htmlFor={`a_${q.id}`}>{q.question}<input type="text" id={`a_${q.id}`} name={`a_${q.id}`} defaultValue={st.cvDoc!.answers?.[q.id] || ""} placeholder={q.placeholder || ""} maxLength={1000} /></label></div>)}
        </div>
        <div className="row" style={{ marginTop: 20 }}><button className="btn btn-primary">Continue</button></div>
      </form>
    </div>;
  } else if (step === "prefs" || (step === "questions" && !st.cvDoc)) {
    const meta = st.profile.career_meta || {};
    const p = st.profile.preferences || { roles: (meta.target_roles || []).join(", "), locations: country === "BD" ? meta.location || "Dhaka" : "", salaryMin: null, salaryMax: null, notice: null, mode: "On-site" as const };
    head = <Head cur="prefs" kicker={editing ? "Your preferences" : "Step 4 of 5"} title={<>What would a better job <span>look like?</span></>} sub="We use this to choose which opportunities to bring you. Any category works; we suggested roles from your CV." />;
    body = <div className="ob">
      <PrefsStep editing={editing} initial={p} personal={st.profile.personal || {}} countryLabel={cn} currency={(r.sym.trim() || "local currency") + perLabel(country)} showPersonal={r.personal} visaField={!!r.visaField} isBD={country === "BD"} />
    </div>;
  } else if (step === "reveal" && st.master && st.P) {
    const m = st.master.content;
    const nm = inboxList(st.scored, new Set());
    const strong = nm.filter((x) => x.m.score >= 70).length;
    const { tpl, accent } = resolveStyle(st.profile.cv_style, country);
    const photo = await photoUrl(supabase, st.profile.photo_path);
    head = <Head cur="reveal" kicker="Step 5 of 5" title={<>Your new CV is <span>ready.</span></>} />;
    body = <>
      <div className="banner"><div><h2 style={{ fontSize: 22 }}>Your new professional CV is ready.</h2><p className="muted">{(m.improvements || []).length} weak lines rewritten. Nothing was added that you did not tell us.</p></div>
        <div className="row"><a className="btn btn-ghost btn-sm" href="/api/cv/download?format=doc">Download (Word)</a><a className="btn btn-ghost btn-sm" href="/api/cv/download?format=print" target="_blank" rel="noopener">PDF</a><form action={finishOnboardingAction}><button className="btn btn-primary">See my {nm.length} opportunities</button></form></div></div>
      {st.master.flags.length ? <p className="note" style={{ marginTop: 12, borderColor: "var(--warn)" }}>Our fact check {st.master.flags.join("; ")}.</p> : null}
      <div className="cmp" style={{ marginTop: 22 }}>
        <div><p className="eyebrow" style={{ marginBottom: 8 }}>Before: your CV</p><div className="raw">{(st.cvDoc?.text_content || "").slice(0, 2600)}</div>
          <div className="card panel" style={{ marginTop: 16 }}><h3>What we improved</h3><ul className="why-list">{(m.improvements || []).map((i, k) => <li key={k}><span className="mk ok">✓</span><div><s className="muted small">{i.before}</s><br />{i.after}</div></li>)}</ul></div></div>
        <div><p className="eyebrow" style={{ marginBottom: 8 }}>After: your Master CV, {cn} format</p>
          <CvToolbar tpl={tpl} accent={accent} photoAllowed={r.photo} hasPhoto={!!st.profile.photo_path} countryLabel={cn} rules={r.rules} />
          <CvPreview master={m} country={country} homeCountry={st.homeCountry} style={st.profile.cv_style} personal={st.profile.personal} photoUrl={photo} /></div>
      </div>
      <div className="banner" style={{ marginTop: 22 }}><p><b>We found {nm.length} current opportunities in {cn} relevant to your career.</b> {strong} {strong === 1 ? "is a strong match" : "are strong matches"}.</p><form action={finishOnboardingAction}><button className="btn btn-primary">Open Opportunity Inbox</button></form></div>
      <div className="banner warn" style={{ marginTop: 14 }}><p><b>Last step: get new jobs automatically.</b> A 3-minute setup forwards job-alert emails from {PORTALS[country].slice(0, 2).join(" and ")} to JobPao. No passwords.</p><form action={finishOnboardingAction.bind(null, "/setup")}><button className="btn btn-ghost">Start setup guide</button></form></div>
    </>;
  } else {
    body = <div className="ob"><p className="muted">Let&apos;s pick up where you left off.</p><form action={backToStepAction.bind(null, "upload")}><button className="btn btn-primary" style={{ marginTop: 12 }}>Upload my CV</button></form></div>;
  }
  return (
    <>
      <SiteHeader inApp={false} signedIn trialLabel={trial} />
      <main className="ob-page">{head}<div className="wrap ob-body">{body}</div></main>
    </>
  );
}
