import Link from "next/link";
import { requireAppState } from "@/lib/server/page";
import { cname, PORTALS } from "@/lib/countries";
import { publicEnv } from "@/lib/env";
import { toggleSetupStepAction } from "@/app/actions";
import { CopyButton } from "@/components/CopyButton";
import { CodeWatcher } from "./CodeWatcher";

export const metadata = { title: "Automatic jobs setup" };
const SETUP_STEPS = ["address", "alerts", "forward", "filter", "test"] as const;

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
  return <ol className="small" style={{ paddingLeft: 18, margin: "6px 0 0" }}>{items.map((i, x) => <li key={x} style={{ margin: "3px 0" }}>{i}</li>)}</ol>;
}

export default async function Setup() {
  const { st, db } = await requireAppState("/setup");
  const first = (st.P.name || "you").replace(/^(md\.?|mohammad|muhammad)\s+/i, "").split(/\s+/)[0];
  const { data: fwd } = await db.rpc("ensure_forwarding_address", { p_hint: first });
  const f = (Array.isArray(fwd) ? fwd[0] : fwd) as { alias: string; gmail_verification_code: string | null; gmail_code_received_at: string | null } | null;
  const addr = f ? `${f.alias}@${publicEnv.inboundDomain}` : "";
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
        <p className="muted" style={{ marginTop: 6 }}>You turn on job alerts on the sites you already use, and Gmail forwards only those alert emails to JobPao. We read each alert, match it to your profile and prepare your application. We never ask for any password, and we never see your other emails.</p>
        <div className="stack" style={{ marginTop: 20 }}>
          <Step k="address" isDone={!!steps.address} n={1} title="Copy your personal JobPao address">
            <p className="small muted">This address only receives job alerts for you.</p>
            <div className="row" style={{ marginTop: 8, flexWrap: "nowrap" }}><code className="copybox" style={{ padding: "8px 10px", flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{addr || "Could not create your address. Reload the page."}</code>{addr ? <CopyButton text={addr} label="Copy" /> : null}</div>
          </Step>
          <Step k="alerts" isDone={!!steps.alerts} n={2} title={`Turn on job alerts on ${ports.join(", ")}`}>
            <Ol items={["Sign in to the site yourself, as you normally do.", "Open its Job Alert or Saved Search settings.", <>Choose roles like <b>{roles}</b>{st.country !== "XX" ? <> in <b>{cname(st.country)}</b></> : null}, and pick daily email alerts.</>, "Make sure the alerts go to your Gmail address."]} />
          </Step>
          <Step k="forward" isDone={!!steps.forward} n={3} title="Add the forwarding address in Gmail">
            <Ol items={[<>In Gmail on a computer, open <b>Settings (gear) → See all settings → Forwarding and POP/IMAP</b>.</>, <>Click <b>Add a forwarding address</b>, paste your JobPao address, then <b>Next → Proceed</b>.</>, <>Gmail sends a confirmation code to that address. It appears below; type it into Gmail and click <b>Verify</b>.</>, <>Keep <b>Disable forwarding</b> selected, so only the filter in step 4 forwards anything.</>]} />
            <CodeWatcher code={f?.gmail_verification_code || null} />
          </Step>
          <Step k="filter" isDone={!!steps.filter} n={4} title="Create a filter so only job alerts are forwarded">
            <Ol items={[<>Open one job-alert email you received and note its <b>From</b> address.</>, <>In the Gmail search bar, click the options icon and put that address in <b>From</b>.</>, <>Click <b>Create filter</b>, tick <b>Forward it to</b>, choose your JobPao address, then <b>Create filter</b>.</>, "Repeat for each job site."]} />
          </Step>
          <Step k="test" isDone={!!steps.test} n={5} title="Check that the first alert arrived">
            <p className="small muted">When the next alert email comes, its jobs appear in your Opportunities with the source shown.</p>
            <div className="row" style={{ marginTop: 8 }}>{count ? <><span className="pill p-st">{count} alert email{count === 1 ? "" : "s"} received</span><Link className="btn-text small" href="/inbox">See it in Opportunities</Link></> : <span className="small muted">Waiting for your first alert email…</span>}</div>
          </Step>
        </div>
        <p className="note" style={{ marginTop: 18 }}>To stop at any time, delete the filter in Gmail. Only emails sent to your JobPao address reach us.</p>
      </div>
    </>
  );
}
