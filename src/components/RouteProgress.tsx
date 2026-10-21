"use client";
// Instant feedback for every tap: a gold bar runs along the top while the next page loads, and the tapped
// button or link dims with a small spinner. Cleared when the page changes (or after a few seconds).
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function clearBusy(bar: HTMLDivElement | null) {
  bar?.classList.remove("on");
  document.querySelectorAll("[data-busy]").forEach((el) => el.removeAttribute("data-busy"));
}

export function RouteProgress() {
  const path = usePathname();
  const qs = useSearchParams();
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Forms that stay on the same page (a server action that refreshes it) end when the page content changes.
    const watch = new MutationObserver(() => { watch.disconnect(); clearBusy(bar.current); });
    const start = (el: Element | null, samePage = false) => {
      bar.current?.classList.add("on");
      if (el) el.setAttribute("data-busy", "1");
      clearTimeout(timer);
      timer = setTimeout(() => clearBusy(bar.current), 12000);
      if (samePage) setTimeout(() => { const m = document.querySelector("main"); if (m) watch.observe(m, { childList: true, subtree: true, characterData: true }); }, 250);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page or #anchor
      start(a);
    };
    const onSubmit = (e: SubmitEvent) => {
      if (e.defaultPrevented) return;
      start(e.submitter || (e.target as HTMLFormElement).querySelector("button"), true);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("submit", onSubmit); clearTimeout(timer); watch.disconnect(); };
  }, []);

  // A new page arrived: clear the bar and every busy button.
  useEffect(() => { clearBusy(bar.current); }, [path, qs]);

  return <div ref={bar} className="rprog" aria-hidden="true" />;
}
