import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const LEGAL_UPDATED = "22 October 2026";
export const SUPPORT_EMAIL = "hello@jobpao.app";

/** Shared frame for the Terms, Privacy and Refund pages: public, plain text in one readable column. */
export function LegalPage({ title, sub, children }: { title: React.ReactNode; sub: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader inApp={false} />
      <main><div className="wrap">
        <PageHead kicker="JobPao" title={title} sub={sub} />
        <article className="card panel legal" style={{ marginTop: 14 }}>
          <p className="muted small">Last updated {LEGAL_UPDATED}</p>
          {children}
          <hr />
          <p className="small">Questions? Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See also our{" "}
            <Link href="/terms">Terms</Link>, <Link href="/privacy">Privacy Policy</Link> and <Link href="/refund">Refund Policy</Link>.</p>
        </article>
      </div></main>
      <SiteFooter />
    </>
  );
}
