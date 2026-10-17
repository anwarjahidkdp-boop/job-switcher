"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";

/** Shows Gmail's forwarding confirmation code once our inbound worker receives it; polls until then. */
export function CodeWatcher({ code }: { code: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (code) return;
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [code, router]);
  return (
    <div className="row" style={{ marginTop: 10 }}>
      {code ? <><span className="pill p-st">Gmail code received: <b className="num">{code}</b></span><CopyButton text={code} label="Copy code" /></> : <span className="small muted">Waiting for Gmail&apos;s code… (this page checks every few seconds)</span>}
    </div>
  );
}
