"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { installOs } from "@/lib/pwa/install";
import { keyBytes, pushState, unblockSteps, type PushState } from "@/lib/pwa/push";

const HIDE_KEY = "jp-push-hidden-until";
const SYNC_KEY = "jp-push-synced";
const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => installOs(navigator.userAgent, navigator.platform, navigator.maxTouchPoints) === "ios";
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const post = (sub: PushSubscription) => fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) return reg;
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

/** The phone-alerts switch: state, and Turn on / Turn off / Send a test. */
export function usePushAlerts() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const read = useCallback(async () => {
    const push = supported();
    const sub = push ? await registration().then((r) => r.pushManager.getSubscription()).catch(() => null) : null;
    const next = pushState({ push, ios: isIos(), standalone: standalone(), permission: push ? Notification.permission : null, subscribed: !!sub });
    setState(next);
    return sub;
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      void read().then((sub) => {
        // Once a session, tell the server this browser belongs to whoever is signed in now (it may be a new sign-in).
        let synced = false;
        try { synced = sessionStorage.getItem(SYNC_KEY) === "1"; sessionStorage.setItem(SYNC_KEY, "1"); } catch {}
        if (sub && !synced) void post(sub).catch(() => {});
      });
    }, 0);
    return () => clearTimeout(t);
  }, [read]);
  const turnOn = useCallback(async () => {
    setBusy(true); setNote(null);
    try {
      // Ask first, inside the tap: iPhone ignores a permission request that comes after other waiting.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { await read(); return; }
      const res = await fetch("/api/push");
      if (!res.ok) throw new Error("key");
      const { key } = (await res.json()) as { key: string };
      const reg = await registration();
      const old = await reg.pushManager.getSubscription();
      const sub = old ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
      if (!(await post(sub)).ok) throw new Error("save");
      setState("on");
      setNote("Alerts are on for this device.");
    } catch {
      setNote("Could not turn alerts on. Check your connection and try again.");
      await read().catch(() => {});
    } finally { setBusy(false); }
  }, [read]);
  const turnOff = useCallback(async () => {
    setBusy(true); setNote(null);
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
      setNote("Alerts are off for this device. The bell in JobPao still shows everything.");
    } catch { setNote("Could not turn alerts off. Try again."); } finally { setBusy(false); }
  }, []);
  const test = useCallback(async () => {
    setBusy(true); setNote(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const { sent } = (await res.json()) as { sent?: number };
      setNote(sent ? "Test sent. It should appear in a few seconds." : "No device received it. Turn alerts off and on again.");
    } catch { setNote("Could not send the test. Try again."); } finally { setBusy(false); }
  }, []);
  return { state, busy, note, turnOn, turnOff, test };
}

/** The full switch, on the notifications page. */
export function PushAlertsCard() {
  const { state, busy, note, turnOn, turnOff, test } = usePushAlerts();
  if (state === "loading") return null;
  const ios = isIos();
  return (
    <div className={`card panel pa ${state === "on" ? "pa-on" : ""}`}>
      <span className="pa-ic" aria-hidden="true">🔔</span>
      <div className="pa-txt">
        <b>{state === "on" ? "Phone alerts are on" : "Get alerts on your phone"}</b>
        <span className="small muted">
          {state === "on" ? "New strong matches, ready applications and reminders pop up on this device, even when JobPao is closed."
            : state === "needs-install" ? "On iPhone, alerts work from the installed app. Add JobPao to your Home Screen, open it from there, then turn alerts on here."
            : state === "blocked" ? `Alerts are blocked for JobPao on this device. ${unblockSteps(ios, /Android/i.test(navigator.userAgent))}`
            : state === "unsupported" ? "This browser cannot show alerts. Open jobpao.app in Chrome, Edge, Firefox or Safari, or install the app."
            : "See new strong matches, ready applications and reminders the moment they arrive, even when JobPao is closed."}
        </span>
        {note ? <span className="small pa-note" role="status">{note}</span> : null}
      </div>
      <div className="pa-act">
        {state === "off" ? <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void turnOn()}>{busy ? "Turning on…" : "Turn on alerts"}</button> : null}
        {state === "needs-install" ? <button type="button" className="btn btn-primary" onClick={() => window.dispatchEvent(new Event("jobpao:install"))}>Install JobPao</button> : null}
        {state === "on" ? <>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void test()}>Send a test</button>
          <button type="button" className="btn btn-ghost pa-off" disabled={busy} onClick={() => void turnOff()}>Turn off</button>
        </> : null}
      </div>
    </div>
  );
}

/** A slim invitation on Home until alerts are on (or it is hidden for two weeks). */
export function PushAlertsPrompt() {
  const where = usePathname();
  const { state, busy, note, turnOn } = usePushAlerts();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { try { setHidden(Number(localStorage.getItem(HIDE_KEY) || 0) > Date.now()); } catch { setHidden(false); } }, 0);
    return () => clearTimeout(t);
  }, []);
  // Once alerts are on, the bar says so briefly and then goes away by itself.
  useEffect(() => {
    if (state !== "on") return;
    const t = setTimeout(() => setHidden(true), 3500);
    return () => clearTimeout(t);
  }, [state]);
  if (where !== "/inbox" || hidden || (state !== "off" && state !== "needs-install" && !note)) return null;
  const hide = () => { setHidden(true); try { localStorage.setItem(HIDE_KEY, String(Date.now() + 14 * 86_400_000)); } catch {} };
  return (
    <div className="wrap pa-wrap"><div className="pa-bar" role="region" aria-label="Phone alerts">
      <span className="pa-ic" aria-hidden="true">🔔</span>
      <span className="pa-bar-t">{note ?? (state === "needs-install" ? "Install JobPao to get new-match alerts on your iPhone." : "Get new-match alerts on your phone, even when JobPao is closed.")}</span>
      {state === "off" ? <button type="button" className="pa-bar-b" disabled={busy} onClick={() => void turnOn()}>{busy ? "…" : "Turn on"}</button> : null}
      {state === "needs-install" ? <button type="button" className="pa-bar-b" onClick={() => window.dispatchEvent(new Event("jobpao:install"))}>Install</button> : null}
      <button type="button" className="pa-bar-x" onClick={hide} aria-label="Hide for two weeks">×</button>
    </div></div>
  );
}
