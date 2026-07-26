// Minimal service worker: just enough for the "Add to Home Screen" / PWA
// installability checks (a fetch handler + a manifest) and to let the app
// shell load offline after the first visit. It deliberately does NOT try to
// cache Google Maps / Static Maps requests - those are cross-origin, change
// per-search, and aren't needed for the app shell to boot.
const CACHE_NAME = "lockhart-quotes-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests - everything else (Google Maps
  // JS/tiles/Static Maps, POSTs, etc.) goes straight to the network.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);

      // Stale-while-revalidate: serve the cached app shell instantly if we
      // have one, and refresh it in the background for next time.
      return cached || networkFetch;
    })
  );
});
