"use client";
// A new page starts at its top. While it loads, the short skeleton would otherwise leave the window scrolled down to
// the footer (the browser clamps the old scroll position), and the real page then opened halfway down.
import { useLayoutEffect } from "react";

export function ScrollTop() {
  useLayoutEffect(() => { if (!location.hash && window.scrollY > 0) window.scrollTo(0, 0); }, []);
  return null;
}
