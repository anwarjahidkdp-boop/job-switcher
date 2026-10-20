"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { completeSetupStepAction } from "@/app/actions";

/** Shows Gmail's forwarding confirmation (a link, a code or both) once our inbound worker receives it; polls until then. */
export function CodeWatcher({ code, link, stepKey = "forward" }: { code: string | null; link: string | null; stepKey?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (code || link) return;
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [code, link, router]);
  return (
    <div className="row" style={{ marginTop: 10 }}>
      {link ? <a className="btn btn-primary btn-sm" href={link} target="_blank" rel="noopener noreferrer nofollow" onClick={() => { void completeSetupStepAction(stepKey).then(() => router.refresh()); }}>Confirm in Gmail ↗</a> : null}
      {code ? <><span className="pill p-st">Gmail code received: <b className="num">{code}</b></span><CopyButton text={code} label="Copy code" /></> : null}
      {!code && !link ? <span className="small muted">Waiting for Gmail&apos;s confirmation… (this page checks every few seconds)</span> : null}
    </div>
  );
}
