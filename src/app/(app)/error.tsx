"use client";
// Shown inside the app frame when a page fails (for example the database is briefly unreachable), with a way to retry.
import Link from "next/link";
import { useEffect } from "react";
import { PageHead } from "@/components/PageHead";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <>
      <PageHead slim title={<>Something went <span>wrong</span></>} sub="This page could not load just now. Your data is safe." />
      <div className="card panel stack" role="alert" style={{ marginTop: 14, maxWidth: 560 }}>
        <p>Please try again. If it keeps happening, wait a minute and reload.</p>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={() => reset()}>Try again</button>
          <Link className="btn btn-ghost" href="/inbox">Go to my dashboard</Link>
        </div>
        {error.digest ? <p className="small muted">Reference: {error.digest}</p> : null}
      </div>
    </>
  );
}
