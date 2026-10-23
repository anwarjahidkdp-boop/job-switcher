import Link from "next/link";
import { PORTAL_HELP } from "@/lib/portalHelp";
import { siteKey, type SetupSteps } from "@/lib/setup";

/** This is an email-alert connection, not Bdjobs OAuth or a CV import. */
export function BdjobsConnectCard({ steps, ready = false }: { steps: SetupSteps; ready?: boolean }) {
  // Saved setup flags can be confirmed by the user; they are not an OAuth or email-delivery receipt.
  const configured = !!steps[siteKey("test", "Bdjobs")] || (!!steps[siteKey("alerts", "Bdjobs")] && !!steps[siteKey("filter", "Bdjobs")]);
  return <aside className="card panel bdjobs-connect" aria-label="Bdjobs job alerts">
    <div className="row" style={{ justifyContent: "space-between", gap: 8 }}><h3>Connect Bdjobs alerts</h3><span className="pill p-neutral">{configured ? "Setup saved" : "Setup needed"}</span></div>
    <p className="small muted">Required to receive your Bdjobs alerts automatically in JobPao.</p>
    <details>
      <summary>Easy setup · 3 steps</summary>
      <ol>
        <li><a href={PORTAL_HELP.Bdjobs.url} target="_blank" rel="noopener noreferrer">Open Bdjobs email notifications ↗</a> and turn on Hot Job Notification.</li>
        <li>Keep your Bdjobs CV and job category up to date.</li>
        <li>Use JobPao&apos;s guide to forward only Bdjobs job-alert emails. Your first received alert confirms the connection.</li>
      </ol>
      <p className="small muted">You sign in on Bdjobs itself. JobPao does not ask for that password or import your Bdjobs CV.</p>
    </details>
    {ready ? <Link prefetch={false} className="btn btn-primary btn-sm" href="/setup?site=Bdjobs">{configured ? "Manage Bdjobs alerts" : "Set up Bdjobs alerts →"}</Link> : <><a className="btn btn-ghost btn-sm" href={PORTAL_HELP.Bdjobs.url} target="_blank" rel="noopener noreferrer">Open Bdjobs alerts ↗</a><p className="small muted">Upload your CV here first. The forwarding guide opens when your profile is ready.</p></>}
  </aside>;
}
