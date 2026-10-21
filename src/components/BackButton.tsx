"use client";
// Installed app (no browser toolbar): a back arrow in the header. Hidden in a normal browser tab by CSS.
import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();
  return (
    <button type="button" className="app-back" aria-label="Go back" onClick={() => (history.length > 1 ? router.back() : router.push("/inbox"))}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
  );
}
