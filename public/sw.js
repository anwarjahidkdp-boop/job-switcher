// Cache only immutable build assets. Never store HTML, RSC, API responses, CVs or account data.
const STATIC_CACHE = "jobpao-static-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith("jobpao-static-") && n !== STATIC_CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith("/_next/static/")) return;
  event.respondWith((async () => {
    let cache;
    try {
      cache = await caches.open(STATIC_CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
    } catch {
      return fetch(request); // Storage restrictions must never prevent the app from opening.
    }
    const response = await fetch(request);
    if (response.status === 200 && response.type === "basic") {
      const copy = response.clone();
      event.waitUntil((async () => {
        await cache.put(request, copy);
        const keys = await cache.keys();
        await Promise.all(keys.slice(0, Math.max(0, keys.length - 100)).map(key => cache.delete(key)));
      })().catch(() => {}));
    }
    return response;
  })());
});

// Phone notifications (Web Push). The server sends {title, body, link, tag}; tapping opens that page in JobPao.
self.addEventListener("push", (event) => {
  let m = {};
  try { m = event.data ? event.data.json() : {}; } catch { m = { body: event.data ? event.data.text() : "" }; }
  const link = typeof m.link === "string" && m.link.startsWith("/") && !m.link.startsWith("//") ? m.link : "/notifications";
  event.waitUntil(self.registration.showNotification(m.title || "JobPao", {
    body: m.body || "You have a new update.",
    icon: "/icon-192.png",
    badge: "/badge-96.png", // Android draws the small icon from the shape alone: white on transparent
    tag: m.tag || "jobpao",
    renotify: true,
    data: { link },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.link) || "/notifications", self.location.origin).href;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of open) {
      if (new URL(c.url).origin === self.location.origin && "focus" in c) {
        await c.focus();
        if ("navigate" in c) await c.navigate(url).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
// The browser renewed its push address: tell the server, so alerts keep arriving.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    const res = await fetch("/api/push", { credentials: "same-origin" });
    if (!res.ok) return;
    const { key } = await res.json();
    const pad = "=".repeat((4 - key.length % 4) % 4);
    const raw = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/") + pad), (c) => c.charCodeAt(0));
    const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
    await fetch("/api/push", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
  })().catch(() => {}));
});
