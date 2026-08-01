const CACHE = "whoop-doctor-v3";
const API_CACHE = "whoop-doctor-api-v2";
const ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.svg",
  "/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE && k !== API_CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Cache API responses from the whoop-diet worker
  if (url.hostname === "whoop-diet.alif-ahmad999.workers.dev" && url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(API_CACHE).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return new Response(JSON.stringify({
            error: "offline",
            message: "No cached data available. Connect to internet to refresh.",
            _cached: true
          }), { headers: { "Content-Type": "application/json" } });
        }))
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
