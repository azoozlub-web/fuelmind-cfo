const CACHE_PREFIX = "fuelmind-";
const CACHE = "fuelmind-v1.6-cfo-rc1.4-salary-family";
const CORE = ["./index.html", "./core.js", "./app.js", "./manifest.webmanifest"];
const SCOPE_PATH = new URL(self.registration.scope).pathname;

function isInScope(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(SCOPE_PATH);
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const request = event.request;
  const url = new URL(request.url);
  if (!isInScope(url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    if (request.mode === "navigate") {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response && response.ok && response.type === "basic") {
          await cache.put("./index.html", response.clone());
        }
        return response;
      } catch {
        return (await cache.match("./index.html")) || Response.error();
      }
    }

    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
