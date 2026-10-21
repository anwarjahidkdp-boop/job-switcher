import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <>
      <SiteHeader inApp={false} />
      <main><div className="wrap">
        <PageHead title={<>Page not <span>found</span></>} sub="This page does not exist, or the job is no longer available." />
        <div className="card panel stack" style={{ marginTop: 14, maxWidth: 560 }}>
          <p>Check the link, or go back to your jobs.</p>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/inbox">Go to my dashboard</Link>
            <Link className="btn btn-ghost" href="/">Home page</Link>
          </div>
        </div>
      </div></main>
      <SiteFooter />
    </>
  );
}
