// ContractAI service worker — minimal install/activate/fetch lifecycle.
// Required by the Google Play Trusted Web Activity (TWA) installability checks.
// Pass-through fetch handler: no caching today so users always get the latest
// version of the app shell. We can layer a real caching strategy on later.

const CACHE_VERSION = "contractai-v1";

self.addEventListener("install", (event) => {
  // Activate this worker on first install without waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop any stale caches from older versions.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  // Network-first, no caching. The empty handler still satisfies the TWA
  // installability requirement that a service worker handles fetch events.
  event.respondWith(fetch(event.request).catch(() => Response.error()));
});
