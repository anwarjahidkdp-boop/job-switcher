import { PageHead } from "@/components/PageHead";
import Link from "next/link";
import { requireAppState } from "@/lib/server/page";
import { cname, portals } from "@/lib/countries";
import { publicEnv } from "@/lib/env";
import { completeSetupStepAction, resetSiteSetupAction, toggleSetupStepAction } from "@/app/actions";
import { CopyButton } from "@/components/CopyButton";
import { CodeWatcher } from "./CodeWatcher";
import { PORTAL_HELP } from "@/lib/portalHelp";
import { accountKind, CENTRAL_SITES, FILTER_HASNOT, userSetupSites, forwardKey, siteDone, siteKey, sitesDone } from "@/lib/setup";
import { EmailGuideButton } from "./EmailGuideButton";
import { ExternalLink } from "@/components/ExternalLink";

export const metadata = { title: "Automatic jobs setup" };

/** One wizard step: only the current step is open; finished ones fold to a single line, later ones wait. */
function Step({ k, n, title, isDone, active, children }: { k: string; n: number; title: string; isDone: boolean; active: boolean; children: React.ReactNode }) {
  return (
    <div className={`card panel sg-step${active ? " sg-active" : ""}`} style={!active && !isDone ? { opacity: 0.55 } : undefined}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap" }}>
        <div className="row" style={{ gap: 10, flexWrap: "nowrap", alignItems: "flex-start", minWidth: 0 }}>
          <span className={`mk ${isDone ? "ok" : ""}`} style={{ width: 26, height: 26, fontSize: 13, flex: "none", ...(isDone ? {} : { background: "var(--accent-soft)", color: "var(--accent)" }) }}>{isDone ? "✓" : n}</span>
          <div style={{ minWidth: 0 }}><h3 style={{ fontSize: 16, margin: "2px 0 6px" }}>{title}</h3>{active ? children : null}</div>
        </div>
        {isDone ? <form action={toggleSetupStepAction.bind(null, k)}><button className="btn btn-text btn-sm" style={{ flex: "none" }}>Undo</button></form> : null}
      </div>
      {active ? <form action={completeSetupStepAction.bind(null, k)} style={{ marginTop: 14, textAlign: "right" }}><button className="btn btn-primary btn-sm">Done, next step →</button></form> : null}
    </div>
  );
}
function Ol({ items }: { items: React.ReactNode[] }) {
  return <ol className="small" style={{ paddingLeft: 20, margin: "6px 0 0", listStyle: "decimal" }}>{items.map((i, x) => <li key={x} style={{ margin: "3px 0" }}>{i}</li>)}</ol>;
}

export default async function Setup({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const { st, db } = await requireAppState("/setup");
  const first = (st.P.name || "you").replace(/^(md\.?|mohammad|muhammad)\s+/i, "").split(/\s+/)[0];
  const { data: fwd } = await db.rpc("ensure_forwarding_address", { p_hint: first });
  const f = (Array.isArray(fwd) ? fwd[0] : fwd) as { alias: string; gmail_verification_code: string | null; gmail_verification_link: string | null; gmail_code_received_at: string | null } | null;
  const addr = f ? `${f.alias}@${publicEnv.inboundDomain}` : "";
  // The placeholder domain cannot receive mail, so the address is hidden until a real one is configured.
  const inboundReady = !/(^|\.)example\.com$/.test(publicEnv.inboundDomain);
  const { count } = await db.from("inbound_emails").select("id", { count: "exact", head: true }).eq("user_id", st.userId).eq("kind", "job_alert").eq("status", "processed");
  const steps = st.profile.setup_steps || {};
  const ports = portals(st.country);
  const done = sitesDone(steps, ports);
  // One job site at a time: the one asked for, else the first one not set up yet.
  const asked = (await searchParams).site;
  const site = ports.find((p) => p === asked) ?? userSetupSites(ports).find((p) => !siteDone(steps, p)) ?? ports.find((p) => !siteDone(steps, p)) ?? ports[0];
  const help = PORTAL_HELP[site];
  const acct = accountKind(steps, site);
  const gmail2 = acct === "gmail2";
  const k = { alerts: siteKey("alerts", site), forward: forwardKey(steps, site), filter: siteKey("filter", site), test: siteKey("test", site) };
  const otherDone = ports.filter((p) => p !== site && siteDone(steps, p));
  const next = ports.filter((p) => p !== site && !siteDone(steps, p));
  const roles = st.P.targetRoles.slice(0, 2).join(", ") || "your target role";
  // The wizard opens the first unfinished step; copying the address is part of the Gmail step.
  const current = (["alerts", "forward", "filter", "test"] as const).find((x) => !steps[k[x]]) ?? null;
  const filterFrom = help?.from || "";
  // Open the Gmail account the user signed up with when it is a Gmail address; otherwise the browser's first Gmail.
  const email = (st.profile.email || "").toLowerCase();
  const gmailBase = !gmail2 && /@(gmail|googlemail)\.com$/.test(email) ? `https://mail.google.com/mail/u/${encodeURIComponent(email)}/` : "https://mail.google.com/mail/u/0/";
  // A second Gmail gets its own confirmation, so only one that arrived after the user picked it counts.
  const since = steps[`since:${site}`];
  const confirmLink = !gmail2 || (typeof since === "string" && (f?.gmail_code_received_at || "") > since) ? f?.gmail_verification_link || null : null;
  const confirmCode = confirmLink || !gmail2 ? f?.gmail_verification_code || null : null;
  // The one thing to do on the site sits next to the button, so nobody has to come back to re-read the steps.
  const siteHow = (
    <>
      {help?.todo ? <p className="small" style={{ margin: 0 }}>{help.todo}</p> : <p className="small" style={{ margin: 0 }}>Search for jobs like <b>{roles}</b>{st.country !== "XX" ? <> in <b>{cname(st.country)}</b></> : null} and save the search as an email alert.</p>}
      {help ? <ExternalLink className="btn btn-primary btn-sm" style={{ marginTop: 8 }} href={help.url}>Open {site} ↗</ExternalLink> : null}
      {help && !help.todo ? <details className="small" style={{ marginTop: 8 }}><summary>Need more help?</summary><Ol items={help.steps} /></details> : null}
    </>
  );
  const filterUrl = `${gmailBase}#create-filter/from=${encodeURIComponent(filterFrom)}&hasnot=${encodeURIComponent(FILTER_HASNOT)}`;

  return (
    <>
      <PageHead back={{ href: "/inbox", label: "Back to Home" }} kicker={`Setup guide · ${done} of ${ports.length} job sites set up`} title={<>Get new jobs <span>automatically</span></>} sub="Job sites already email new jobs to your Gmail. You set Gmail to pass only those job emails on to JobPao, and we turn them into matched jobs for you. No passwords, and we never see your other emails." />
      <div className="ob">
        <div className="sg-flow">
          <div><b>1</b><span>{site} emails new jobs to your Gmail</span></div>
          <div><b>2</b><span>Gmail passes only those emails to JobPao</span></div>
          <div><b>3</b><span>You see matched jobs in JobPao</span></div>
        </div>
        {!inboundReady ? <p className="note" style={{ marginTop: 14 }}><b>Coming soon:</b> your JobPao address is being switched on. You can do step 1 now.</p> : null}
        <p className="small muted" style={{ marginTop: 12 }}>About 3 minutes for each job site. After that, new jobs arrive on their own.</p>
        <h3 style={{ fontSize: 16, marginTop: 20 }}>Pick a job site to set up</h3>
        <div className="sg-tabs">
          {ports.map((p) => <Link key={p} href={`/setup?site=${encodeURIComponent(p)}`} className={`sg-tab${p === site ? " on" : ""}`} aria-current={p === site ? "page" : undefined}>{siteDone(steps, p) ? "✓ " : ""}{p}</Link>)}
        </div>
        {CENTRAL_SITES.includes(site) && !siteDone(steps, site) ? <p className="note" style={{ marginTop: 14 }}><b>Optional.</b> {site} Hot Jobs already come in for everyone, with no setup. Do this only if you also want your own {site} alerts.</p> : null}
        {siteDone(steps, site) ? (
          <div className="note" style={{ marginTop: 14 }}>
            <b>{site} is set up.</b> {next.length ? <>Set up {next.join(" and ")} too, so you get jobs from there as well.</> : <>All your job sites are set up.</>}
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              {next.slice(0, 1).map((p) => <Link key={p} className="btn btn-primary btn-sm" href={`/setup?site=${encodeURIComponent(p)}`}>Set up {p} →</Link>)}
              <form action={resetSiteSetupAction.bind(null, site)}><button className="btn btn-ghost btn-sm">Set up {site} again</button></form>
            </div>
          </div>
        ) : null}
        <div className="stack" style={{ marginTop: 16 }}>
          <Step k={k.alerts} isDone={!!steps[k.alerts]} active={current === "alerts"} n={1} title={help?.todo ? `On ${site}, turn on job alert emails` : `Turn on job alerts on ${site}`}>
            {siteHow}
          </Step>
          <Step k={k.forward} isDone={!!steps[k.forward]} active={current === "forward"} n={2} title={`In Gmail, add your JobPao address for forwarding`}>
            <p className="small" style={{ margin: 0 }}>Open the Gmail that gets your {site} emails, add this address under <b>Forwarding</b>, then tap <b>Confirm in Gmail</b> here when it appears.</p>
            {inboundReady ? <div className="row" style={{ marginTop: 10, flexWrap: "nowrap" }}><code className="copybox" style={{ padding: "8px 10px", flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{addr || "Could not create your address. Reload the page."}</code>{addr ? <CopyButton text={addr} label="Copy" /> : null}</div> : <p className="small" style={{ marginTop: 8 }}>Your JobPao address will appear here soon.</p>}
            <ExternalLink className="btn btn-primary btn-sm" style={{ marginTop: 8 }} href={`${gmailBase}#settings/fwdandpop`}>Open Gmail forwarding ↗</ExternalLink>
            <p className="small muted" style={{ marginTop: 6 }}>There: <b>Add a forwarding address</b> → paste → <b>Next → Proceed → OK</b>.</p>
            <div className="sg-phone note">
              <p className="small" style={{ margin: 0 }}><b>On a phone,</b> Gmail shows this only as a desktop page: in Chrome tap <b>⋮</b> → <b>Desktop site</b>, then the gear <b>⚙</b> → <b>See all settings</b> → <b>Forwarding and POP/IMAP</b>. Easier on a computer:</p>
              <EmailGuideButton site={site} />
            </div>
            <CodeWatcher code={confirmCode} link={confirmLink} stepKey={k.forward} />
          </Step>
          <Step k={k.filter} isDone={!!steps[k.filter]} active={current === "filter"} n={3} title={`Forward only ${site} emails`}>
            <p className="small" style={{ margin: 0 }}>We filled in the Gmail filter. Tick <b>Forward it to</b>, choose your JobPao address, and tap <b>Create filter</b>. Your other emails stay private.</p>
            <ExternalLink className="btn btn-primary btn-sm" style={{ marginTop: 8 }} href={filterUrl}>Open the ready-made filter ↗</ExternalLink>
            <p className="small muted" style={{ marginTop: 6 }}>If the boxes are empty: From <b>{filterFrom}</b>, Doesn&apos;t have <b>{FILTER_HASNOT}</b>.{otherDone.length ? <> Keep the filter you made for {otherDone.join(" and ")}.</> : null}</p>
          </Step>
          <Step k={k.test} isDone={!!steps[k.test]} active={current === "test"} n={4} title={`All set: your next ${site} alert shows up here`}>
            <p className="small muted">When the next {site} alert email comes, its jobs appear in your Opportunities with the site name. This step ticks itself.</p>
            <div className="row" style={{ marginTop: 8 }}>{count ? <><span className="pill p-st">{count} alert email{count === 1 ? "" : "s"} received</span><Link className="btn-text small" href="/inbox">See it in Opportunities</Link></> : <span className="small muted">Waiting for your first alert email…</span>}</div>
          </Step>
        </div>
        <p className="note" style={{ marginTop: 18 }}>To stop at any time, delete the filter in Gmail (Settings → Filters and Blocked Addresses). Only emails sent to your JobPao address reach us.</p>
      </div>
    </>
  );
}
