"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export const SAVE_FAILED = "We could not save that. Please try again.";

/**
 * Runs a server action, then refreshes the page in a separate request. A failed save shows a short message
 * instead of the browser's "This page couldn't load" screen.
 */
export function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const save = (f: () => Promise<unknown>, done?: () => void) => start(async () => {
    setErr("");
    try { await f(); } catch (e) {
      // After a new release, a page opened earlier cannot reach the old server actions: reload it once to get the new version.
      if (/server action/i.test(String((e as Error)?.message || ""))) { window.location.reload(); return; }
      setErr(SAVE_FAILED); return;
    }
    done?.();
    router.refresh();
  });
  return { pending, err, save };
}
