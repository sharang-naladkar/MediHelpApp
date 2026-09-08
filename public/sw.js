/*
 * MediDrone service worker — installable PWA shell cache.
 *
 * Contract:
 *  - Caches the app SHELL ONLY (same-origin static assets + navigations).
 *  - NEVER fetches, caches or replays anything cross-origin. The MediDrone
 *    backend lives on a different origin (NEXT_PUBLIC_API_BASE_URL), so every
 *    API request passes straight through to the network untouched. There is
 *    no offline API response and no cached data of any kind.
 */
const CACHE_NAME = "medidrone-shell-v1";
const SHELL_CACHE = "medidrone-shell";
const PRECACHE = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(SHELL_CACHE) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // External origin (the API) — never intercept. Same rule for any subdomain.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first so users always get the freshest shell when
  // online; fall back to the cached shell on flaky/offline connections.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Static shell assets: stale-while-revalidate (instant on flaky networks).
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
