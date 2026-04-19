// ContractAI service worker — cache-first shell so the app opens instantly,
// even with zero connectivity (Trusted Web Activity / PWA).
//
// Strategy:
// - Same-origin GET HTML/JS/CSS/img/font: cache-first, fall back to network.
// - Network responses are written back to the cache so the shell stays fresh.
// - All API calls (path starts with /api/) bypass the cache entirely so
//   contract analysis, payments, etc. always hit live servers.

const CACHE_VERSION = "contractai-v3";

const SHELL_URLS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // Best-effort precache; ignore individual failures so install never breaks.
      await Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => undefined)
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/") || url.pathname.includes("/api/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return; // never cache API calls

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            cache.put(req, res.clone()).catch(() => undefined);
          }
          return res;
        })
        .catch(() => undefined);

      if (cached) {
        // stale-while-revalidate: return cached immediately, refresh in background
        event.waitUntil(network.then(() => undefined));
        return cached;
      }

      const fresh = await network;
      if (fresh) return fresh;

      // Offline navigation fallback: serve cached root document
      if (req.mode === "navigate") {
        const root = await cache.match("/");
        if (root) return root;
      }
      return Response.error();
    })()
  );
});
