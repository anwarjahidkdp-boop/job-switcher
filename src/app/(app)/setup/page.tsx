import Link from "next/link";
import { requireAppState } from "@/lib/server/page";
import { cname, PORTALS } from "@/lib/countries";
import { publicEnv } from "@/lib/env";
import { toggleSetupStepAction } from "@/app/actions";
import { CopyButton } from "@/components/CopyButton";
import { CodeWatcher } from "./CodeWatcher";
import { PORTAL_HELP } from "@/lib/portalHelp";

export const metadata = { title: "Automatic jobs setup" };
const SETUP_STEPS = ["alerts", "address", "forward", "filter", "test"] as const;

type StepKey = (typeof SETUP_STEPS)[number];
function Step({ k, n, title, isDone, children }: { k: StepKey; n: number; title: string; isDone: boolean; children: React.ReactNode }) {
  return (
    <div className="card panel" style={isDone ? { opacity: 0.8 } : undefined}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "nowrap" }}>
        <div className="row" style={{ gap: 10, flexWrap: "nowrap", alignItems: "flex-start" }}>
          <span className={`mk ${isDone ? "ok" : ""}`} style={{ width: 26, height: 26, fontSize: 13, ...(isDone ? {} : { background: "var(--accent-soft)", color: "var(--accent)" }) }}>{isDone ? "✓" : n}</span>
          <div><h3 style={{ fontSize: 16, margin: "2px 0 6px" }}>{title}</h3>{children}</div>
        </div>
        <form action={toggleSetupStepAction.bind(null, k)}><button className={`btn ${isDone ? "btn-text" : "btn-ghost"} btn-sm`} style={{ flex: "none" }}>{isDone ? "Undo" : "Done"}</button></form>
      </div>
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
  const done = SETUP_STEPS.filter((k) => steps[k]).length;
  const ports = PORTALS[st.country];
  const roles = st.P.targetRoles.slice(0, 2).join(", ") || "your target role";

  return (
    <>
      <Link className="btn btn-text" href="/inbox">← Back to opportunities</Link>
      <div className="ob" style={{ marginTop: 8 }}>
        <p className="eyebrow">Setup guide · {done} of {SETUP_STEPS.length} done</p>
        <h1 style={{ fontSize: 28, marginTop: 6 }}>Get new jobs automatically</h1>
        <p className="muted" style={{ marginTop: 6 }}>Job sites already email new jobs to your Gmail. You set Gmail to pass only those job emails on to JobPao, and we turn them into matched jobs for you. No passwords, and we never see your other emails.</p>
        <div className="sg-flow">
          <div><b>1</b><span>{ports[0]} emails new jobs to your Gmail</span></div>
          <div><b>2</b><span>Gmail passes only those emails to JobPao</span></div>
          <div><b>3</b><span>You see matched jobs in JobPao</span></div>
        </div>
        {!inboundReady ? <p className="note" style={{ marginTop: 14 }}><b>Coming soon:</b> your JobPao address is being switched on. You can do step 1 now; steps 2 to 4 will work once your address appears below.</p> : null}
        <div className="stack" style={{ marginTop: 20 }}>
          <Step k="alerts" isDone={!!steps.alerts} n={1} title={`Turn on job alerts on ${ports.join(" and ")}`}>
            <p className="small muted">Do this on the job site itself. Use the <b>same Gmail address</b> for your account there, because the site sends the alerts to the email in your account. Search for jobs like <b>{roles}</b>{st.country !== "XX" ? <> in <b>{cname(st.country)}</b></> : null}.</p>
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
            <p className="small muted" style={{ marginTop: 8 }}>Site menus change a little sometimes. If a button name is different, look for &ldquo;alert&rdquo;, &ldquo;save search&rdquo; or &ldquo;email me jobs&rdquo;.</p>
          </Step>
          <Step k="address" isDone={!!steps.address} n={2} title="Copy your JobPao address">
            <p className="small muted">You will paste this into <b>Gmail</b> in the next two steps. Do not put it on {ports.join(" or ")}.</p>
            {inboundReady ? <div className="row" style={{ marginTop: 8, flexWrap: "nowrap" }}><code className="copybox" style={{ padding: "8px 10px", flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{addr || "Could not create your address. Reload the page."}</code>{addr ? <CopyButton text={addr} label="Copy" /> : null}</div> : <p className="small" style={{ marginTop: 8 }}>Your address will appear here soon.</p>}
          </Step>
          <Step k="forward" isDone={!!steps.forward} n={3} title="Allow Gmail to send to your JobPao address">
            <p className="small muted">Gmail only allows this on a computer. On a phone, open gmail.com in Chrome and choose &ldquo;Desktop version&rdquo; from the menu.</p>
            <Ol items={[<>Open <a href="https://mail.google.com/mail/u/0/#settings/fwdandpop" target="_blank" rel="noopener noreferrer">Gmail forwarding settings ↗</a> (or in Gmail: the <b>gear icon → See all settings → Forwarding and POP/IMAP</b>).</>, <>Click <b>Add a forwarding address</b>, paste your JobPao address from step 2, then click <b>Next → Proceed → OK</b>.</>, <>Gmail sends a confirmation to JobPao. In a few seconds a <b>Confirm in Gmail</b> button (or a code) shows up below. Click the button and then <b>Confirm</b> on Google&apos;s page, or type the code into Gmail and click <b>Verify</b>. If nothing comes, click <b>Re-send email</b> in Gmail.</>, <>Leave <b>Disable forwarding</b> selected and close settings. This keeps your other emails private; step 4 forwards only the job emails.</>]} />
            <CodeWatcher code={f?.gmail_verification_code || null} link={f?.gmail_verification_link || null} />
          </Step>
          <Step k="filter" isDone={!!steps.filter} n={4} title="Tell Gmail to pass on only the job alert emails">
            <p className="small muted">Do this after the first alert email from {ports.join(" or ")} arrives in your Gmail.</p>
            <Ol items={[<>Open that job alert email in Gmail on a computer.</>, <>Click the <b>three dots (⋮)</b> at the top right of the email and choose <b>Filter messages like these</b>. Gmail fills in the sender for you.</>, <>Click <b>Create filter</b>.</>, <>Tick <b>Forward it to</b>, pick your JobPao address, and click <b>Create filter</b> again.</>, `Do the same once for each job site (${ports.join(", ")}).`]} />
          </Step>
          <Step k="test" isDone={!!steps.test} n={5} title="Done: wait for the next alert">
            <p className="small muted">When the next alert email comes, its jobs appear in your Opportunities with the site name shown. This step ticks itself.</p>
            <div className="row" style={{ marginTop: 8 }}>{count ? <><span className="pill p-st">{count} alert email{count === 1 ? "" : "s"} received</span><Link className="btn-text small" href="/inbox">See it in Opportunities</Link></> : <span className="small muted">Waiting for your first alert email…</span>}</div>
          </Step>
        </div>
        <p className="note" style={{ marginTop: 18 }}>To stop at any time, delete the filter in Gmail (Settings → Filters and Blocked Addresses). Only emails sent to your JobPao address reach us.</p>
      </div>
    </>
  );
}
