import { PageHead } from "@/components/PageHead";
import Link from "next/link";
import { requireAppState } from "@/lib/server/page";
import { cname, portals } from "@/lib/countries";
import { publicEnv } from "@/lib/env";
import { completeSetupStepAction, resetSiteSetupAction, toggleSetupStepAction } from "@/app/actions";
import { CopyButton } from "@/components/CopyButton";
import { CodeWatcher } from "./CodeWatcher";
import { PORTAL_HELP } from "@/lib/portalHelp";
import { accountKind, forwardKey, siteDone, siteKey, sitesDone } from "@/lib/setup";
import { AccountChoice } from "./AccountChoice";

export const metadata = { title: "Automatic jobs setup" };
// Keeps login, OTP and password-reset emails from the job sites out of the forward.
const FILTER_HASNOT = "password OR OTP OR verify OR reset OR code";

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
  const site = ports.find((p) => p === asked) ?? ports.find((p) => !siteDone(steps, p)) ?? ports[0];
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
  const siteHow = (
    <>
      <p className="small muted">Search for jobs like <b>{roles}</b>{st.country !== "XX" ? <> in <b>{cname(st.country)}</b></> : null}, then:</p>
      {help ? <><Ol items={help.steps} /><a className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} href={help.url} target="_blank" rel="noopener noreferrer">Open {site} ↗</a></> : <Ol items={["Sign in, search for your job, and look for a button like \"Create job alert\" or \"Save search\"."]} />}
    </>
  );
  const me = <b>{email || "your JobPao email"}</b>;
  const filterUrl = `${gmailBase}#create-filter/from=${encodeURIComponent(filterFrom)}&hasnot=${encodeURIComponent(FILTER_HASNOT)}`;

  return (
    <>
      <PageHead back={{ href: "/inbox", label: "Back to opportunities" }} kicker={`Setup guide · ${done} of ${ports.length} job sites set up`} title={<>Get new jobs <span>automatically</span></>} sub="Job sites already email new jobs to your Gmail. You set Gmail to pass only those job emails on to JobPao, and we turn them into matched jobs for you. No passwords, and we never see your other emails." />
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
          <Step k={k.alerts} isDone={!!steps[k.alerts]} active={current === "alerts"} n={1} title={`Turn on job alerts on ${site}`}>
            <p className="small muted">Which email does your {site} account use?</p>
            <AccountChoice site={site} value={acct} options={[
              { v: "new", label: `I don't have ${/^[aeiou]/i.test(site) ? "an" : "a"} ${site} account` },
              { v: "same", label: `The same email I use here (${email || "my JobPao email"})` },
              { v: "gmail2", label: "A different Gmail" },
              { v: "other", label: "Outlook, Yahoo or another email" },
            ]} panels={{
              new: <><p className="small">Create a free {site} account with {me}.</p>{siteHow}</>,
              same: siteHow,
              gmail2: <><p className="small">Easiest: in your {site} account settings, change the email to {me}. Or keep that Gmail; step 2 then connects it too.</p>{siteHow}</>,
              other: <><p className="small">In your {site} account settings, change the email to {me}, so alerts come to your Gmail.</p>{siteHow}<p className="small muted" style={{ marginTop: 8 }}>Want to keep Outlook? In Outlook, open Settings → Mail → Rules → Add new rule: From <b>{filterFrom}</b>, Forward to <b>{addr || "your JobPao address"}</b>. Then press Done on steps 2 and 3.</p></>,
            }} />
          </Step>
          <Step k={k.forward} isDone={!!steps[k.forward]} active={current === "forward"} n={2} title={gmail2 ? `Connect your other Gmail to JobPao` : "Connect your Gmail to JobPao"}>
            <p className="small muted">Do this on a computer (on a phone, open gmail.com in Chrome and choose &ldquo;Desktop version&rdquo;). {gmail2 ? <>Be signed in to the Gmail your <b>{site}</b> account uses. Check the address at the top right of Gmail, and switch account there if needed.</> : <>Be signed in to the <b>same Gmail</b> that gets your job alerts. If you use more than one Gmail, check the address at the top right of Gmail before you start.</>}</p>
            {inboundReady ? <div className="row" style={{ marginTop: 10, flexWrap: "nowrap" }}><code className="copybox" style={{ padding: "8px 10px", flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{addr || "Could not create your address. Reload the page."}</code>{addr ? <CopyButton text={addr} label="Copy" /> : null}</div> : <p className="small" style={{ marginTop: 8 }}>Your JobPao address will appear here soon.</p>}
            <Ol items={[<>Click <b>Copy</b> above, then <a className="btn btn-primary btn-sm" style={{ margin: "4px 0" }} href={`${gmailBase}#settings/fwdandpop`} target="_blank" rel="noopener noreferrer">Open Gmail settings ↗</a></>, <>Click <b>Add a forwarding address</b>, paste, then <b>Next → Proceed → OK</b>. If you see a box with a list instead of that button, click the box and choose <b>Add a forwarding address</b>. If your JobPao address is already in that list, this step is done.</>, <>Come back here. A <b>Confirm in Gmail</b> button appears below in a few seconds. Click it, then <b>Confirm</b> on Google&apos;s page.</>]} />
            <CodeWatcher code={confirmCode} link={confirmLink} stepKey={k.forward} />
            <p className="small muted" style={{ marginTop: 8 }}>Keep <b>Disable forwarding</b> selected in Gmail. Your other emails stay private; the next step sends only job emails.</p>
          </Step>
          <Step k={k.filter} isDone={!!steps[k.filter]} active={current === "filter"} n={3} title={`Send only ${site} job emails to JobPao`}>
            <p className="small muted">We filled in the Gmail filter for you. It picks only emails from {site}, and never login or password emails.{otherDone.length ? <> This is a new filter; keep the one you made for {otherDone.join(" and ")}.</> : null}</p>
            <Ol items={[<><a className="btn btn-primary btn-sm" style={{ margin: "4px 0" }} href={filterUrl} target="_blank" rel="noopener noreferrer">Open the ready-made filter ↗</a></>, <>In Gmail, click <b>Create filter</b>.</>, <>Tick <b>Forward it to</b>, choose <b>{addr || "your JobPao address"}</b>, and click <b>Create filter</b>.</>]} />
            <p className="small muted" style={{ marginTop: 8 }}>If the boxes are empty, type <b>{filterFrom}</b> in <b>From</b> and <b>{FILTER_HASNOT}</b> in <b>Doesn&apos;t have</b>.</p>
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
