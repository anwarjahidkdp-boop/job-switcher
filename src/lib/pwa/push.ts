// What the phone-alerts switch can do on this browser. iPhone only allows alerts from an installed app (iOS 16.4+).
export type PushState = "loading" | "unsupported" | "needs-install" | "blocked" | "off" | "on";

export function pushState(env: { push: boolean; ios: boolean; standalone: boolean; permission: NotificationPermission | null; subscribed: boolean }): Exclude<PushState, "loading"> {
  if (env.ios && !env.standalone) return "needs-install";
  if (!env.push || !env.permission) return "unsupported";
  if (env.permission === "denied") return "blocked";
  return env.permission === "granted" && env.subscribed ? "on" : "off";
}

/** How to allow alerts again after "Block", per browser. */
export function unblockSteps(ios: boolean, android: boolean): string {
  if (ios) return "Open iPhone Settings, then Notifications, then JobPao, and turn on Allow Notifications.";
  if (android) return "In Chrome, tap ⋮, then Settings, Site settings, Notifications, and allow jobpao.app. In the installed app, long-press the JobPao icon, App info, Notifications.";
  return "Click the icon at the left of the address bar, then allow Notifications for jobpao.app.";
}

export function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const s = atob(key.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - key.length % 4) % 4));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
