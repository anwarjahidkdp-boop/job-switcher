import Link from "next/link";
import { requireAppState } from "@/lib/server/page";
import { cname, PORTALS } from "@/lib/countries";
import { publicEnv } from "@/lib/env";
import { completeSetupStepAction, toggleSetupStepAction } from "@/app/actions";
import { CopyButton } from "@/components/CopyButton";
import { CodeWatcher } from "./CodeWatcher";
import { PORTAL_HELP } from "@/lib/portalHelp";

export const metadata = { title: "Automatic jobs setup" };
const WIZARD = ["alerts", "forward", "filter", "test"] as const;
// Keeps login, OTP and password-reset emails from the job sites out of the forward.
const FILTER_HASNOT = "password OR OTP OR verify OR reset OR code";

type StepKey = (typeof WIZARD)[number];
/** One wizard step: only the current step is open; finished ones fold to a single line, later ones wait. */
function Step({ k, n, title, isDone, active, children }: { k: StepKey; n: number; title: string; isDone: boolean; active: boolean; children: React.ReactNode }) {
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

export default async function Setup() {
  const { st, db } = await requireAppState("/setup");
  const first = (st.P.name || "you").replace(/^(md\.?|mohammad|muhammad)\s+/i, "").split(/\s+/)[0];
  const { data: fwd } = await db.rpc("ensure_forwarding_address", { p_hint: first });
  const f = (Array.isArray(fwd) ? fwd[0] : fwd) as { alias: string; gmail_verification_code: string | null; gmail_verification_link: string | null; gmail_code_received_at: string | null } | null;
  const addr = f ? `${f.alias}@${publicEnv.inboundDomain}` : "";
  // The placeholder domain cannot receive mail, so the address is hidden until a real one is configured.
  const inboundReady = !/(^|\.)example\.com$/.test(publicEnv.inboundDomain);
  const { count } = await db.from("inbound_emails").select("id", { count: "exact", head: true }).eq("user_id", st.userId).eq("kind", "job_alert").eq("status", "processed");
  const steps = st.profile.setup_steps || {};
  const done = WIZARD.filter((k) => steps[k]).length;
  const ports = PORTALS[st.country];
  const roles = st.P.targetRoles.slice(0, 2).join(", ") || "your target role";
  // The wizard opens the first unfinished step; copying the address is part of the Gmail step.
  const current = WIZARD.find((k) => !steps[k]) ?? null;
  const filterFrom = ports.map((p) => PORTAL_HELP[p]?.from).filter(Boolean).join(" OR ");
  // Open the Gmail account the user signed up with when it is a Gmail address; otherwise the browser's first Gmail.
  const email = (st.profile.email || "").toLowerCase();
  const gmailBase = /@(gmail|googlemail)\.com$/.test(email) ? `https://mail.google.com/mail/u/${encodeURIComponent(email)}/` : "https://mail.google.com/mail/u/0/";
  const filterUrl = `${gmailBase}#create-filter/from=${encodeURIComponent(filterFrom)}&hasnot=${encodeURIComponent(FILTER_HASNOT)}`;

  return (
    <>
      <Link className="btn btn-text" href="/inbox">← Back to opportunities</Link>
      <div className="ob" style={{ marginTop: 8 }}>
        <p className="eyebrow">Setup guide · {done} of {WIZARD.length} done</p>
        <h1 style={{ fontSize: 28, marginTop: 6 }}>Get new jobs automatically</h1>
        <p className="muted" style={{ marginTop: 6 }}>Job sites already email new jobs to your Gmail. You set Gmail to pass only those job emails on to JobPao, and we turn them into matched jobs for you. No passwords, and we never see your other emails.</p>
        <div className="sg-flow">
          <div><b>1</b><span>{ports[0]} emails new jobs to your Gmail</span></div>
          <div><b>2</b><span>Gmail passes only those emails to JobPao</span></div>
          <div><b>3</b><span>You see matched jobs in JobPao</span></div>
        </div>
        {!inboundReady ? <p className="note" style={{ marginTop: 14 }}><b>Coming soon:</b> your JobPao address is being switched on. You can do step 1 now.</p> : null}
        <p className="small muted" style={{ marginTop: 12 }}>About 3 minutes, once. After that, new jobs arrive on their own.</p>
        <div className="stack" style={{ marginTop: 20 }}>
          <Step k="alerts" isDone={!!steps.alerts} active={current === "alerts"} n={1} title={`Turn on job alerts on ${ports.join(" and ")}`}>
            <p className="small muted">On the job site, use the <b>same Gmail address</b> as your account email, because the site sends alerts there. Look for jobs like <b>{roles}</b>{st.country !== "XX" ? <> in <b>{cname(st.country)}</b></> : null}.</p>
            <div className="sg-sites">
              {ports.map((name, i) => {
                const h = PORTAL_HELP[name];
                return (
                  <details key={name} className="sg-site" open={i === 0}>
                    <summary>How to do it on {name}</summary>
                    {h ? <><Ol items={h.steps} /><a className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} href={h.url} target="_blank" rel="noopener noreferrer">Open {name} ↗</a></> : <Ol items={["Sign in, search for your job, and look for a button like \"Create job alert\" or \"Save search\"."]} />}
                  </details>
                );
              })}
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>Already get job emails from these sites? Then this step is done.</p>
          </Step>
          <Step k="forward" isDone={!!steps.forward} active={current === "forward"} n={2} title="Connect your Gmail to JobPao">
            <p className="small muted">Do this on a computer (on a phone, open gmail.com in Chrome and choose &ldquo;Desktop version&rdquo;). Be signed in to the <b>same Gmail</b> that gets your job alerts. If you use more than one Gmail, check the address at the top right of Gmail before you start.</p>
            {inboundReady ? <div className="row" style={{ marginTop: 10, flexWrap: "nowrap" }}><code className="copybox" style={{ padding: "8px 10px", flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{addr || "Could not create your address. Reload the page."}</code>{addr ? <CopyButton text={addr} label="Copy" /> : null}</div> : <p className="small" style={{ marginTop: 8 }}>Your JobPao address will appear here soon.</p>}
            <Ol items={[<>Click <b>Copy</b> above, then <a className="btn btn-primary btn-sm" style={{ margin: "4px 0" }} href={`${gmailBase}#settings/fwdandpop`} target="_blank" rel="noopener noreferrer">Open Gmail settings ↗</a></>, <>Click <b>Add a forwarding address</b>, paste, then <b>Next → Proceed → OK</b>. If you see a box with a list instead of that button, click the box and choose <b>Add a forwarding address</b>. If your JobPao address is already in that list, this step is done.</>, <>Come back here. A <b>Confirm in Gmail</b> button appears below in a few seconds. Click it, then <b>Confirm</b> on Google&apos;s page.</>]} />
            <CodeWatcher code={f?.gmail_verification_code || null} link={f?.gmail_verification_link || null} />
            <p className="small muted" style={{ marginTop: 8 }}>Keep <b>Disable forwarding</b> selected in Gmail. Your other emails stay private; the next step sends only job emails.</p>
          </Step>
          <Step k="filter" isDone={!!steps.filter} active={current === "filter"} n={3} title="Send only job emails to JobPao">
            <p className="small muted">We filled in the Gmail filter for you. It picks only emails from {ports.join(" and ")}, and never login or password emails.</p>
            <Ol items={[<><a className="btn btn-primary btn-sm" style={{ margin: "4px 0" }} href={filterUrl} target="_blank" rel="noopener noreferrer">Open the ready-made filter ↗</a></>, <>In Gmail, click <b>Create filter</b>.</>, <>Tick <b>Forward it to</b>, choose <b>{addr || "your JobPao address"}</b>, and click <b>Create filter</b>.</>]} />
            <p className="small muted" style={{ marginTop: 8 }}>If the boxes are empty, type <b>{filterFrom}</b> in <b>From</b> and <b>{FILTER_HASNOT}</b> in <b>Doesn&apos;t have</b>.</p>
          </Step>
          <Step k="test" isDone={!!steps.test} active={current === "test"} n={4} title="All set: your next job alert shows up here">
            <p className="small muted">When the next alert email comes, its jobs appear in your Opportunities with the site name. This step ticks itself.</p>
            <div className="row" style={{ marginTop: 8 }}>{count ? <><span className="pill p-st">{count} alert email{count === 1 ? "" : "s"} received</span><Link className="btn-text small" href="/inbox">See it in Opportunities</Link></> : <span className="small muted">Waiting for your first alert email…</span>}</div>
          </Step>
        </div>
        <p className="note" style={{ marginTop: 18 }}>To stop at any time, delete the filter in Gmail (Settings → Filters and Blocked Addresses). Only emails sent to your JobPao address reach us.</p>
      </div>
    </>
  );
}
