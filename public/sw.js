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
