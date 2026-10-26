import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { paddleConfig } from "@/lib/billing/paddle";
import { publicEnv } from "@/lib/env";
import { PaddleCheckout } from "./client";

export const metadata = { title: "Secure card payment", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Paddle's "default payment link": /pay?_ptxn=txn_... opens the checkout for a transaction the server created. */
export default async function Pay({ searchParams }: { searchParams: Promise<{ _ptxn?: string }> }) {
  const cfg = paddleConfig();
  const txn = /^txn_[a-z0-9]+$/i.test((await searchParams)._ptxn || "");
  return (
    <>
      <SiteHeader inApp={false} />
      <main><div className="wrap">
        <PageHead kicker="JobPao Pro" title={<>Secure card <span>payment</span></>} sub="Checkout by Paddle, our reseller and Merchant of Record. We never see your card details." />
        <div className="card panel stack" style={{ marginTop: 14 }}>
          {!cfg ? <p className="note">Card payment opens very soon. Your trial features keep working until the trial ends.</p>
            : !txn ? <p className="note">This payment link is incomplete. Start again from the <Link href="/upgrade">pricing page</Link>.</p>
            : <PaddleCheckout token={cfg.clientToken} sandbox={cfg.sandbox} successUrl={`${publicEnv.appUrl}/upgrade?payment=card`} />}
          <p className="small muted">Changed your mind? <Link href="/upgrade">Back to pricing</Link>.</p>
        </div>
      </div></main>
      <SiteFooter />
    </>
  );
}
