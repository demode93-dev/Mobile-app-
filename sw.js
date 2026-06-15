// Service worker: network-first so players always get the latest build when
// online, with an offline cache fallback. Bump CACHE on any asset change.
const CACHE = "lab-escape-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./js/utils.js",
  "./js/config.js",
  "./js/lore.js",
  "./js/commerce.js",
  "./js/audio.js",
  "./js/input.js",
  "./js/map.js",
  "./js/entities.js",
  "./js/game.js",
  "./js/main.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for GET requests: fetch fresh, update the cache, fall back to
// cache (then index.html) only when offline. No more stale builds.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
