"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";

export function CheckoutButton({ label, endpoint = "/api/billing/checkout", opening = "Opening bKash" }: { label: string; endpoint?: string; opening?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div>
      <button className="btn btn-primary" disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        try {
          const r = await fetch(endpoint, { method: "POST" });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j.url) throw new Error(j.error || "Could not start the payment.");
          window.location.assign(j.url);
        } catch (e) { setErr((e as Error).message); setBusy(false); }
      }}>{busy ? <><Spinner /> {opening}</> : label}</button>
      {err ? <p className="err" style={{ marginTop: 8 }}>{err}</p> : null}
    </div>
  );
}

export const CardCheckoutButton = ({ label }: { label: string }) => <CheckoutButton label={label} endpoint="/api/billing/card" opening="Opening secure checkout" />;

export function ManualPaymentForm() {
  const router = useRouter();
  const [trxId, setTrx] = useState("");
  const [msisdn, setMsisdn] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  if (done) return <p className="note" style={{ borderColor: "var(--accent)" }}>Thank you. We will check TrxID {trxId.toUpperCase()} and email you when Pro is active. Pro does not start until we confirm it.</p>;
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      try {
        const r = await fetch("/api/billing/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trxId, msisdn }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Could not save the payment.");
        setDone(true); router.refresh();
      } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
    }}>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="f" htmlFor="trx" style={{ flex: 1, minWidth: 160 }}>Transaction ID (TrxID)<input id="trx" type="text" required maxLength={20} autoComplete="off" value={trxId} onChange={(e) => setTrx(e.target.value)} placeholder="e.g. 9JK7ABC1XY" /></label>
        <label className="f" htmlFor="msisdn" style={{ flex: 1, minWidth: 160 }}>bKash number you paid from<input id="msisdn" type="tel" required maxLength={16} inputMode="tel" value={msisdn} onChange={(e) => setMsisdn(e.target.value)} placeholder="01XXXXXXXXX" /></label>
      </div>
      {err ? <p className="err">{err}</p> : null}
      <div><button className="btn btn-primary" disabled={busy}>{busy ? <><Spinner /> Saving</> : "Submit payment for review"}</button></div>
    </form>
  );
}
