// Minimal offline cache so the game is playable once installed.
const CACHE = "lab-escape-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./js/utils.js",
  "./js/audio.js",
  "./js/input.js",
  "./js/map.js",
  "./js/entities.js",
  "./js/game.js",
  "./js/main.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
