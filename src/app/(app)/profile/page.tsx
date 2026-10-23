import { ApplicationSafetyForm } from "@/components/ApplicationSafetyForm";
import { ApplicationProfileNotice } from "@/components/ApplicationProfileNotice";
import { PageHead } from "@/components/PageHead";
import Link from "next/link";
import { requireAppState, photoUrl } from "@/lib/server/page";
import { cname, money, perLabel, portals, rule } from "@/lib/countries";
import { convention } from "@/lib/cv/conventions";
import { CvSuggestions } from "@/components/CvSuggestions";
import { resolveStyle } from "@/lib/cv/render";
import { LEVEL, LEVEL_NAME, skillLabel } from "@/lib/taxonomy";
import { CvPreview } from "@/components/CvPreview";
import { CvToolbar } from "@/components/CvToolbar";
import { backToStepAction, setReminderPrefAction } from "@/app/actions";
import { CountryPanel, SkillAdder, FactReview, DangerZone, GmailPanel } from "./client";
import { gmailAccount, gmailConfigured } from "@/lib/server/gmail";
import { createAdminClient } from "@/lib/supabase/admin";
import { sitesDone } from "@/lib/setup";
import { ManualCvEditor } from "@/components/ManualCvEditor";
import { manualDraft } from "@/lib/manual-cv";

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
      <ApplicationProfileNotice answers={st.profile.answer_library || {}} rules={st.profile.deal_breakers || {}} onProfile />
      <div className="dash" style={{ marginTop: 18 }}>
        <div>
          <ManualCvEditor initial={manualDraft(st.master.content, st.facts)} baseId={st.master.id} country={country} revision={st.profile.search_country_version} />
          <CvToolbar tpl={tpl} accent={accent} photoAllowed={r.photo} hasPhoto={!!st.profile.photo_path} countryLabel={cname(country)} rules={r.rules} downloads={{ pdf: "/api/cv/download?format=print", doc: "/api/cv/download?format=doc", label: "Your Master CV" }} />
          <CvPreview master={st.master.content} country={country} homeCountry={st.homeCountry} style={st.profile.cv_style} personal={st.profile.personal} noticeDays={st.profile.preferences?.notice ?? null} photoUrl={photo} />
          <div className="row" style={{ marginTop: 12 }}>
            <a className="btn btn-ghost btn-sm" href="/api/cv/download?format=doc">Download Master CV (Word)</a>
            <a className="btn btn-ghost btn-sm" href="/api/cv/download?format=print" target="_blank" rel="noopener">Save as PDF</a>
            <form action={backToStepAction.bind(null, "upload")}><button className="btn btn-ghost btn-sm">Upload a new CV</button></form>
          </div>
          <CvSuggestions items={st.master.content.suggestions || []} />
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
              <div>Expected salary: <b>{st.profile.answer_library?.salaryNegotiable === true ? "Negotiable" : P.salaryMin ? money(P.salaryMin, country) + (P.salaryMax ? "–" + money(P.salaryMax, country) : "+") + perLabel(country) : "Not set"}</b></div>
              <div>Experience: <b>{Math.floor(P.years)} years</b> · {LEVEL_NAME[LEVEL[P.seniority]]}</div>
              <div>Notice period: <b>{P.notice != null ? (P.notice === 0 ? "Available immediately" : P.notice + " days") : "Not set"}</b></div>
            </div>
            <Link className="btn btn-text" style={{ marginTop: 6 }} href="/onboarding?step=prefs">Edit preferences</Link>
          </div>
          <ApplicationSafetyForm answers={st.profile.answer_library || {}} rules={st.profile.deal_breakers || {}} />
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
