import { SiteHeader } from "@/components/SiteHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPayments } from "@/lib/server/billing";
import { formatTaka } from "@/lib/billing/manual";
import { requireAdmin, reviewPaymentAction } from "./actions";

export const metadata = { title: "Payments (admin)" };

const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-");

export default async function AdminPayments() {
  await requireAdmin();
  const admin = createAdminClient();
  const [pending, recent] = await Promise.all([listPayments(admin, "pending"), listPayments(admin, "recent")]);
  return (
    <>
      <SiteHeader inApp={false} signedIn />
      <main><div className="wrap">
        <h1 style={{ fontSize: 28 }}>bKash payments</h1>
        <p className="muted" style={{ marginTop: 6 }}>Approve a payment only after you find the exact TrxID, amount and sender number in your bKash app or merchant statement. Approval adds 30 days of Pro and emails the user.</p>
        <h2 style={{ fontSize: 20, marginTop: 22 }}>Waiting for review ({pending.length})</h2>
        {pending.length ? <div className="stack" style={{ marginTop: 10 }}>{pending.map((p) => (
          <div key={p.id} className="card panel">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div><b style={{ fontSize: 17, letterSpacing: 0.5 }}>{p.trx_id}</b> · {formatTaka(p.amount_minor)} from <b>{p.payer_msisdn}</b><br /><span className="small muted">{p.name || "(no name)"} · {p.email || p.user_id} · submitted {when(p.created_at)} (Dhaka)</span></div>
              <form action={reviewPaymentAction} className="row">
                <input type="hidden" name="id" value={p.id} />
                <input type="text" name="note" placeholder="Note to user (optional)" maxLength={500} style={{ minWidth: 200 }} />
                <button className="btn btn-primary btn-sm" name="decision" value="approve">Approve</button>
                <button className="btn btn-ghost btn-sm" name="decision" value="reject">Reject</button>
              </form>
            </div>
          </div>))}</div> : <p className="muted" style={{ marginTop: 8 }}>Nothing to review.</p>}
        <h2 style={{ fontSize: 20, marginTop: 26 }}>Recent decisions</h2>
        <table className="small" style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead><tr><th align="left">When</th><th align="left">User</th><th align="left">Method</th><th align="left">TrxID</th><th align="left">Amount</th><th align="left">Status</th><th align="left">By</th><th /></tr></thead>
          <tbody>{recent.map((p) => (
            <tr key={p.id}><td>{when(p.reviewed_at || p.created_at)}</td><td>{p.email || p.user_id}</td><td>{p.method === "bkash_checkout" ? "Checkout" : "Manual"}</td><td>{p.trx_id || "-"}</td><td>{formatTaka(p.amount_minor)}</td><td>{p.status}{p.review_note ? ` (${p.review_note})` : ""}</td><td>{p.reviewed_by || "-"}</td>
              <td>{p.status === "rejected" && p.method === "bkash_manual" ? <form action={reviewPaymentAction}><input type="hidden" name="id" value={p.id} /><button className="btn-text small" name="decision" value="approve">Approve after all</button></form> : null}</td></tr>))}</tbody>
        </table>
      </div></main>
    </>
  );
}
