// WorldView service worker
// - HTML/navigation: network-first (so new deploys are picked up instantly)
// - Hashed static assets (JS/CSS/images): cache-first
// - Live data feeds: pass-through, never cached
const CACHE = "worldview-v5";
const SCOPE = "/Worldview-project/";

self.addEventListener("install", (e) => {
  // Activate the new SW immediately on install
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (ev) => {
  if (ev.data === "SKIP_WAITING") self.skipWaiting();
});

const isLiveFeed = (url) =>
  url.hostname.includes("opensky-network.org") ||
  url.hostname.includes("earthquake.usgs.gov") ||
  url.hostname.includes("celestrak.org") ||
  url.hostname.includes("aisstream.io");

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Never cache live data feeds
  if (isLiveFeed(url)) {
    e.respondWith(fetch(e.request).catch(() => new Response("{}", { headers: { "Content-Type": "application/json" } })));
    return;
  }

  // Navigation / HTML → network-first, fall back to cache
  const isHTML = e.request.mode === "navigate" || (e.request.headers.get("accept") || "").includes("text/html");
  if (isHTML) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request).then((c) => c || caches.match(SCOPE)))
    );
    return;
  }

  // Hashed static assets → cache-first (safe because Vite content-hashes filenames)
  if (url.origin === location.origin || url.hostname.includes("jsdelivr.net") || url.hostname.includes("unpkg.com")) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res.ok && res.type !== "opaque") {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
  }
});
