"use client";
import { useEffect } from "react";

/** Each setup step opens at the top of the page: the steps share one URL, so the browser would keep the old scroll position. */
export function ScrollTop({ step }: { step: string }) {
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior }); }, [step]);
  return null;
}
