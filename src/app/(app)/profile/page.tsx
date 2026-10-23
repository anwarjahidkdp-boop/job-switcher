import { PageHead } from "@/components/PageHead";
import Link from "next/link";
import { requireAppState, photoUrl } from "@/lib/server/page";
import { cname, money, perLabel, portals, rule } from "@/lib/countries";
import { convention } from "@/lib/cv/conventions";
import { CvSuggestions, PolishCvButton } from "@/components/CvSuggestions";
import { resolveStyle } from "@/lib/cv/render";
import { LEVEL, LEVEL_NAME, skillLabel } from "@/lib/taxonomy";
import { CvPreview } from "@/components/CvPreview";
import { CvToolbar } from "@/components/CvToolbar";
import { backToStepAction, setReminderPrefAction, saveCareerSafetyAction } from "@/app/actions";
import { CountryPanel, SkillAdder, FactReview, DangerZone, GmailPanel } from "./client";
import { gmailAccount, gmailConfigured } from "@/lib/server/gmail";
import { createAdminClient } from "@/lib/supabase/admin";
import { sitesDone } from "@/lib/setup";
import { CvEditBox } from "@/components/CvEditBox";
import { speechLangs } from "@/lib/speech-langs";
import { aiConfigured } from "@/lib/ai";

export const metadata = { title: "Profile" };

function describeFact(kind: string, d: Record<string, unknown>): string {
  if (kind === "experience") return `${d.title}${d.company ? " at " + d.company : " (employer not named on your CV)"}`;
  if (kind === "education") return `${d.degree}${d.field ? " in " + d.field : ""}${d.institution ? ", " + d.institution : ""}`;
  if (kind === "certification") return `${d.name} (${d.status})`;
  if (kind === "skill") return skillLabel(String(d.name));
  return String(d.name ?? "");
}

export default async function Profile({ searchParams }: { searchParams: Promise<{ gmail?: string }> }) {
  const { st, db } = await requireAppState("/profile");
  const gmailStatus = (await searchParams).gmail ?? null;
  const gmail = gmailConfigured() ? await gmailAccount(createAdminClient(), st.userId) : null;
  const P = st.P, country = st.country, r = rule(country);
  const { tpl, accent } = resolveStyle(st.profile.cv_style, country);
  const photo = await photoUrl(db, st.profile.photo_path);
  const setupSites = portals(st.country);
  const setupDone = sitesDone(st.profile.setup_steps || {}, setupSites);
  const pending = st.facts.filter((f) => !f.verified && f.kind !== "answer" && f.id).map((f) => ({ id: f.id!, kind: f.kind, text: describeFact(f.kind, f.data) }));
  const srcTitle = (s: string) => (s === "cv" ? "From your CV" : s === "answer" ? "From your answers" : "Added by you");
  return (
    <>
      <PageHead kicker="Your profile" title={<>Master career <span>profile</span></>} sub="Every application is built from this verified information." />
      <div className="dash" style={{ marginTop: 18 }}>
        <div>
          <CvToolbar tpl={tpl} accent={accent} photoAllowed={r.photo} hasPhoto={!!st.profile.photo_path} countryLabel={cname(country)} rules={r.rules} downloads={{ pdf: "/api/cv/download?format=print", doc: "/api/cv/download?format=doc", label: "Your Master CV" }} />
          <CvPreview master={st.master.content} country={country} homeCountry={st.homeCountry} style={st.profile.cv_style} personal={st.profile.personal} noticeDays={st.profile.preferences?.notice ?? null} photoUrl={photo} />
          <div className="row" style={{ marginTop: 12 }}>
            <a className="btn btn-ghost btn-sm" href="/api/cv/download?format=doc">Download Master CV (Word)</a>
            <a className="btn btn-ghost btn-sm" href="/api/cv/download?format=print" target="_blank" rel="noopener">Save as PDF</a>
            <form action={backToStepAction.bind(null, "upload")}><button className="btn btn-ghost btn-sm">Upload a new CV</button></form>
            {aiConfigured() ? <PolishCvButton /> : null}
          </div>
          <CvSuggestions items={st.master.content.suggestions || []} />
          <CvEditBox aiReady={aiConfigured()} langs={speechLangs(st.homeCountry)} style={{ marginTop: 12 }} after={<><Link className="btn btn-primary btn-sm" href="/inbox">Go to my dashboard</Link><a className="btn btn-ghost btn-sm" href="/api/cv/download?format=print" target="_blank" rel="noopener">Save as PDF</a></>} />
          {convention(country).refs === "list" && !(st.profile.personal?.references || []).length ? <p className="note" style={{ marginTop: 12 }}>{cname(country)} CVs list {convention(country).refCount} references who are not relatives. Your CV says &quot;Available on request&quot; until you add them. <Link href="/onboarding?step=prefs">Add references</Link></p> : null}
          {st.master.flags.length ? <p className="note" style={{ marginTop: 12 }}>Fact check on this CV: {st.master.flags.join("; ")}.</p> : null}
        </div>
        <aside className="side">
          <CountryPanel current={country} needsVisa={st.profile.needs_visa} homeCountry={st.homeCountry} />
          <div className="card panel"><h3>Verified skills</h3>
            <div className="skchips">{P.skills.map((s) => <span key={s.name} className={`sk ${s.src === "user" ? "u" : ""}`} title={srcTitle(s.src)}>{skillLabel(s.name)}</span>)}</div>
            <SkillAdder />
            <p className="small muted" style={{ marginTop: 6 }}>Teal skills were added by you. Hover a skill to see where it came from.</p>
          </div>
          {pending.length ? <div className="card panel"><h3>Waiting for your confirmation</h3><p className="small muted" style={{ marginBottom: 8 }}>We could not find these word-for-word in your CV, so they are not used until you confirm them.</p><FactReview facts={pending} /></div> : null}
          <div className="card panel"><h3>Preferences</h3>
            <div className="stack small" style={{ gap: 4 }}>
              <div>Target roles: <b>{P.targetRoles.join(", ")}</b></div>
              <div>Locations: <b>{P.locations.join(", ") || "Anywhere in " + cname(country)}</b></div>
              <div>Expected salary: <b>{P.salaryMin ? money(P.salaryMin, country) + (P.salaryMax ? "–" + money(P.salaryMax, country) : "+") + perLabel(country) : "Not set"}</b></div>
              <div>Experience: <b>{Math.floor(P.years)} years</b> · {LEVEL_NAME[LEVEL[P.seniority]]}</div>
              <div>Notice period: <b>{P.notice ? P.notice + " days" : "Not set"}</b></div>
            </div>
            <Link className="btn btn-text" style={{ marginTop: 6 }} href="/onboarding?step=prefs">Edit preferences</Link>
          </div>
          <div className="card panel"><h3>Application safety</h3>
            <p className="small muted">Hard rules stop JobPao from preparing an application that conflicts with what you want. Confirmed answers are reused; unknown answers are never guessed.</p>
            <form action={saveCareerSafetyAction} className="stack" style={{ marginTop: 10 }}>
              <label className="f">Minimum salary<input name="minSalary" type="number" defaultValue={String(st.profile.deal_breakers?.minSalary ?? "")} /></label>
              <label><input name="remoteOnly" type="checkbox" defaultChecked={st.profile.deal_breakers?.remoteOnly === true} /> Remote only</label>
              <label><input name="noRelocation" type="checkbox" defaultChecked={st.profile.deal_breakers?.noRelocation === true} /> No relocation</label>
              <label><input name="noContract" type="checkbox" defaultChecked={st.profile.deal_breakers?.noContract === true} /> No contract / temporary work</label>
              <label><input name="sponsorshipRequired" type="checkbox" defaultChecked={st.profile.deal_breakers?.sponsorshipRequired === true} /> Visa sponsorship required</label>
              <label><input name="workAuthorizationRequired" type="checkbox" defaultChecked={st.profile.deal_breakers?.workAuthorizationRequired === true} /> Require confirmed work authorization before preparing</label>
              <label className="f">Excluded industries<input name="excludedIndustries" defaultValue={Array.isArray(st.profile.deal_breakers?.excludedIndustries) ? st.profile.deal_breakers.excludedIndustries.join(", ") : ""} placeholder="gambling, tobacco" /></label>
              <label className="f">Excluded companies<input name="excludedCompanies" defaultValue={Array.isArray(st.profile.deal_breakers?.excludedCompanies) ? st.profile.deal_breakers.excludedCompanies.join(", ") : ""} /></label>
              <label className="f">Excluded role types<input name="excludedRoleTypes" defaultValue={Array.isArray(st.profile.deal_breakers?.excludedRoleTypes) ? st.profile.deal_breakers.excludedRoleTypes.join(", ") : ""} placeholder="contract, temporary" /></label>
              <h3 style={{ marginTop: 8 }}>Answer Library</h3>
              <label className="f">Work authorization<select name="workAuthorization" defaultValue={String(st.profile.answer_library?.workAuthorization || "unknown")}><option value="unknown">Not confirmed</option><option value="yes">Yes</option><option value="no">No</option></select></label>
              <label className="f">Expected salary<input name="expectedSalary" type="number" defaultValue={String(st.profile.answer_library?.expectedSalary ?? "")} /></label>
              <label className="f">Current salary (optional)<input name="currentSalary" type="number" defaultValue={String(st.profile.answer_library?.currentSalary ?? "")} /></label>
              <label className="f">Notice period (days)<input name="noticeDays" type="number" defaultValue={String(st.profile.answer_library?.noticeDays ?? "")} /></label>
              <label className="f">Need sponsorship?<select name="answerSponsorship" defaultValue={st.profile.answer_library?.sponsorshipRequired === true ? "yes" : st.profile.answer_library?.sponsorshipRequired === false ? "no" : ""}><option value="">Not confirmed</option><option value="yes">Yes</option><option value="no">No</option></select></label>
              <label className="f">Willing to relocate?<select name="willingToRelocate" defaultValue={st.profile.answer_library?.willingToRelocate === true ? "yes" : st.profile.answer_library?.willingToRelocate === false ? "no" : ""}><option value="">Not confirmed</option><option value="yes">Yes</option><option value="no">No</option></select></label>
              <label className="f">People-management experience (years)<input name="managementYears" type="number" defaultValue={String(st.profile.answer_library?.managementYears ?? "")} /></label>
              <label className="f">Largest team size managed<input name="teamSize" type="number" defaultValue={String(st.profile.answer_library?.teamSize ?? "")} /></label>
              <label className="f">Willing to travel?<select name="willingToTravel" defaultValue={st.profile.answer_library?.willingToTravel === true ? "yes" : st.profile.answer_library?.willingToTravel === false ? "no" : ""}><option value="">Not confirmed</option><option value="yes">Yes</option><option value="no">No</option></select></label>
              <button className="btn btn-primary btn-sm">Save application safety</button>
            </form>
          </div>
          <div className="card panel"><h3>Job sites</h3>
            {setupSites.map((site) => <div key={site} className="qitem"><div><b className="small">{site}</b><div className="small muted">Paste a {site} link or job text and we match it. To apply, open the job on {site} yourself, where you sign in.</div></div><span className="pill p-neutral">No password</span></div>)}
            <p className="small muted" style={{ marginTop: 8 }}>A direct account connection will be added only through an official integration from the job site.</p>
            <Link className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} href="/setup">Open automatic-jobs setup ({setupDone}/{setupSites.length} sites)</Link>
          </div>
          <GmailPanel email={gmail} status={gmailStatus} ready={gmailConfigured()} />
          <div className="card panel"><h3>Reminder emails</h3>
            <p className="small muted">{st.profile.email_reminders ? "We email you on the reminder dates you set." : "Reminder emails are off; reminders still show in your inbox."}</p>
            <form action={setReminderPrefAction.bind(null, !st.profile.email_reminders)}><button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>{st.profile.email_reminders ? "Turn off reminder emails" : "Turn on reminder emails"}</button></form>
          </div>
          <div className="card panel"><h3>Your data</h3>
            <p className="small muted">Your CV and photo are stored privately; links to them expire after a minute.</p>
            <div className="row" style={{ marginTop: 10 }}>
              {st.cvDoc?.storage_path ? <a className="btn btn-ghost btn-sm" href="/api/cv/original">Download my original CV</a> : null}
              <Link className="btn btn-ghost btn-sm" href="/account/password">Set or change password</Link>
              <a className="btn btn-ghost btn-sm" href="/api/account/export">Export my data</a>
              <form action={backToStepAction.bind(null, "upload")}><button className="btn btn-ghost btn-sm">Upload a new CV</button></form>
            </div>
            <DangerZone />
          </div>
        </aside>
      </div>
    </>
  );
}
