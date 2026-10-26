"use client";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui";

type PaddleJs = { Environment: { set(env: string): void }; Initialize(o: Record<string, unknown>): void };
declare global { interface Window { Paddle?: PaddleJs } }

/** Loads Paddle.js; it opens the checkout itself because the page has ?_ptxn=<transaction id>. */
export function PaddleCheckout({ token, sandbox, successUrl }: { token: string; sandbox: boolean; successUrl: string }) {
  const [state, setState] = useState<"loading" | "open" | "error">("loading");
  useEffect(() => {
    const start = () => {
      const P = window.Paddle;
      if (!P) { setState("error"); return; }
      if (sandbox) P.Environment.set("sandbox");
      P.Initialize({ token, checkout: { settings: { displayMode: "overlay", theme: "light", locale: "en", successUrl } } });
      setState("open");
    };
    if (window.Paddle) { start(); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.async = true;
    s.onload = start;
    s.onerror = () => setState("error");
    document.head.appendChild(s);
  }, [token, sandbox, successUrl]);
  if (state === "loading") return <p><Spinner /> Opening secure checkout</p>;
  if (state === "error") return <p role="alert" className="err">The secure checkout could not load. Check your connection, turn off any script blocker for this page, and try again.</p>;
  return <p className="small">The secure checkout is open. If you closed it, <a href="">reload this page</a> to open it again.</p>;
}
