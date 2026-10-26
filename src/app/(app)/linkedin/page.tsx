import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { CopyButton } from "@/components/CopyButton";
import { requireAppState } from "@/lib/server/page";
import { linkedinKit, LI_LIMITS } from "@/lib/linkedin";
import { LINKEDIN_DONE, LINKEDIN_URL } from "@/lib/setup";
import { LinkedinConnect, LinkedinDone } from "./client";

export const metadata = { title: "Update your LinkedIn profile" };

function Part({ id, title, text, limit, note }: { id: string; title: string; text: string; limit?: number; note?: string }) {
  return (
    <section className="card panel li-part" id={id} aria-labelledby={`${id}-h`}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 id={`${id}-h`}>{title}</h3>
        <span className="row" style={{ gap: 8 }}>{limit ? <span className="small muted">{text.length} / {limit}</span> : null}<CopyButton text={text} label="Copy" /></span>
      </div>
      {note ? <p className="small muted" style={{ marginTop: 4 }}>{note}</p> : null}
      <div className="copybox" style={{ marginTop: 8 }}>{text}</div>
    </section>
  );
}

export default async function LinkedinPage() {
  const { st } = await requireAppState("/linkedin");
  const prefs = st.profile.preferences;
  const split = (s: string | undefined) => String(s || "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  const kit = linkedinKit(st.master.content, { targetRoles: [...st.P.targetRoles, ...split(prefs?.roles)], country: st.country, locations: split(prefs?.locations), mode: prefs?.mode ?? null });
  const steps = st.profile.setup_steps || {};
  const url = typeof steps[LINKEDIN_URL] === "string" ? String(steps[LINKEDIN_URL]) : null;
  const done = typeof steps[LINKEDIN_DONE] === "string";
  const open = url || "https://www.linkedin.com/in/me/";

  return (
    <>
      <PageHead back={{ href: "/inbox", label: "Home" }} kicker="LinkedIn" title={<>Update your <span>LinkedIn profile</span></>}
        sub="Every section written from your CV, ready to copy into LinkedIn. Recruiters search LinkedIn every day: a complete profile helps them find you." />
      <div className="stack" style={{ marginTop: 18 }}>
        <section className="card panel li-connect" aria-labelledby="li-connect-h">
          <h3 id="li-connect-h">{url ? "LinkedIn connected" : "Connect your LinkedIn"}</h3>
          <p className="small muted" style={{ marginTop: 4 }}>
            Add your profile link so we can open it for you. We never ask for your LinkedIn password, and LinkedIn does not let apps change your profile, so you paste each part in yourself. It takes about 10 minutes.
          </p>
          <LinkedinConnect url={url} />
          <ol className="li-steps small">
            <li><a href={open} target="_blank" rel="noopener noreferrer">Open your LinkedIn profile ↗</a> and sign in.</li>
            <li>Press the pencil icon on each section below, then paste the text from here.</li>
            <li>Come back and press “I’ve updated my LinkedIn”.</li>
          </ol>
        </section>

        <Part id="li-headline" title="Headline" text={kit.headline} limit={LI_LIMITS.headline} note="Shown under your name everywhere on LinkedIn. Edit intro → Headline." />
        <Part id="li-about" title="About" text={kit.about} limit={LI_LIMITS.about} note="Add profile section → About." />

        <section className="card panel" id="li-experience" aria-labelledby="li-exp-h">
          <h3 id="li-exp-h">Experience</h3>
          <p className="small muted" style={{ marginTop: 4 }}>For each job: Add position, then copy the title, company, dates and description. Keep them the same as your CV.</p>
          <div className="stack" style={{ marginTop: 10 }}>
            {kit.experience.map((e, i) => (
              <div key={i} className="li-role">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div><b>{e.title}</b><div className="small muted">{e.company}{e.location ? ` · ${e.location}` : ""}{e.dates ? ` · ${e.dates}` : ""}</div></div>
                  <CopyButton text={e.description} label="Copy description" />
                </div>
                <div className="copybox" style={{ marginTop: 8 }}>{e.description}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card panel" id="li-skills" aria-labelledby="li-skills-h">
          <div className="row" style={{ justifyContent: "space-between" }}><h3 id="li-skills-h">Skills</h3><CopyButton text={kit.skills.join(", ")} label="Copy all skills" /></div>
          <p className="small muted" style={{ marginTop: 4 }}>Add each skill under Skills. Pin these first: <b>{kit.topSkills.join(", ")}</b>.</p>
          <div className="skchips" style={{ marginTop: 8 }}>{kit.skills.map((s) => <span className="sk" key={s}>{s}</span>)}</div>
        </section>

        {kit.openTo.titles.length ? (
          <section className="card panel" id="li-open" aria-labelledby="li-open-h">
            <h3 id="li-open-h">Open to work</h3>
            <p className="small muted" style={{ marginTop: 4 }}>Open to → Finding a new job. Use these so recruiters see you for the right roles.</p>
            <ul className="why-list" style={{ marginTop: 8 }}>
              <li><span className="mk ok">✓</span><span><b>Job titles:</b> {kit.openTo.titles.join(", ")}</span></li>
              <li><span className="mk ok">✓</span><span><b>Location:</b> {kit.openTo.location}</span></li>
              {kit.openTo.mode ? <li><span className="mk ok">✓</span><span><b>Workplace:</b> {kit.openTo.mode}</span></li> : null}
            </ul>
          </section>
        ) : null}

        {kit.education.length || kit.certifications.length || kit.languages.length ? (
          <section className="card panel" id="li-more" aria-labelledby="li-more-h">
            <h3 id="li-more-h">Education, certifications and languages</h3>
            <ul className="why-list" style={{ marginTop: 8 }}>
              {kit.education.map((x) => <li key={x}><span className="mk ok">✓</span><span><b>Education:</b> {x}</span></li>)}
              {kit.certifications.map((x) => <li key={x}><span className="mk ok">✓</span><span><b>Licence or certification:</b> {x}</span></li>)}
              {kit.languages.length ? <li><span className="mk ok">✓</span><span><b>Languages:</b> {kit.languages.join(", ")}</span></li> : null}
            </ul>
          </section>
        ) : null}

        <section className="card panel" aria-labelledby="li-tips-h">
          <h3 id="li-tips-h">Tips</h3>
          <ul className="why-list" style={{ marginTop: 8 }}>{kit.tips.map((t) => <li key={t}><span className="mk ok">★</span><span>{t}</span></li>)}</ul>
          <p className="small muted" style={{ marginTop: 10 }}>Changed your CV? This page updates with it. <Link prefetch={false} href="/profile">Edit your CV</Link></p>
        </section>

        <LinkedinDone done={done} />
      </div>
    </>
  );
}
