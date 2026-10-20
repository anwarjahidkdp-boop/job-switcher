"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Os = "ios" | "android" | "desktop";
const KEY = "jp-install-hidden";

function detectOs(): Os {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return /Android/i.test(ua) ? "android" : "desktop";
}
const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const GUIDE: Record<Os, { title: string; steps: string[] }> = {
  ios: { title: "Install on iPhone", steps: ["Open jobpao.app in Safari.", "Tap the Share button (the square with an arrow) at the bottom.", "Scroll down and tap \"Add to Home Screen\", then \"Add\"."] },
  android: { title: "Install on Android", steps: ["Open jobpao.app in Chrome.", "Tap the ⋮ menu at the top right.", "Tap \"Install app\" (or \"Add to Home screen\"), then \"Install\"."] },
  desktop: { title: "Install on your computer", steps: ["Open jobpao.app in Chrome or Edge.", "Click the install icon at the right end of the address bar.", "Click \"Install\". JobPao opens in its own window."] },
};

/** "Install app" button on the right edge: one tap installs where the browser allows it, otherwise a short guide for the phone. */
export function InstallApp() {
  const [evt, setEvt] = useState<Prompt | null>(null);
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [os, setOs] = useState<Os>("android");
  // Only on the home page and the job inbox, so it never sits over a form button.
  const where = usePathname();
  const here = where === "/" || where.startsWith("/inbox");

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    let hidden = false;
    try { hidden = localStorage.getItem(KEY) === "1"; } catch {}
    const t = setTimeout(() => {
      const o = detectOs();
      setOs(o);
      // Chrome and Edge only fire beforeinstallprompt while the app is NOT installed, so there we wait for it.
      // iPhone never fires it and cannot tell us, so the guide button shows until the person hides it.
      setShow(!hidden && !standalone() && o === "ios");
    }, 0);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as Prompt); if (!hidden && !standalone()) setShow(true); };
    const onDone = () => { setShow(false); setOpen(false); try { localStorage.setItem(KEY, "1"); } catch {} };
    // Already installed on this device (Android Chrome can tell): never show the button.
    (navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> }).getInstalledRelatedApps?.().then((apps) => { if (apps.length) onDone(); }).catch(() => {});
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onDone);
    return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onDone); };
  }, []);

  if (!show || !here) return null;
  const install = async () => {
    if (!evt) { setOpen(true); return; }
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    setEvt(null);
    if (outcome === "accepted") onAccepted();
  };
  const onAccepted = () => { setShow(false); try { localStorage.setItem(KEY, "1"); } catch {} };
  const hide = () => { setShow(false); try { localStorage.setItem(KEY, "1"); } catch {} };
  const g = GUIDE[os];
  return (
    <>
      <div className="ia">
        <button type="button" className="ia-btn" onClick={install}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M12 7v7m-3-3 3 3 3-3M10 18h4" /></svg>
          Install on phone
        </button>
        <button type="button" className="ia-x" onClick={hide} aria-label="Hide install button">×</button>
      </div>
      {open ? (
        <div className="ia-sheet" role="dialog" aria-modal="true" aria-labelledby="ia-t" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="ia-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" width="56" height="56" />
            <h3 id="ia-t">{g.title}</h3>
            <p className="small muted">Get JobPao on your home screen. It opens like an app, with no app store needed.</p>
            <ol>{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            <div className="ia-tabs">{(["android", "ios", "desktop"] as Os[]).map((k) => <button key={k} type="button" className={k === os ? "on" : ""} onClick={() => setOs(k)}>{k === "ios" ? "iPhone" : k === "android" ? "Android" : "Computer"}</button>)}</div>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>Got it</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
