// App-shell-only service worker — see CLAUDE.md "PWA" for the exact scope
// decision. Two things on purpose:
//
// 1. Cache-first for Next's content-hashed static build assets
//    (/_next/static/*) — the filename changes whenever the content does, so
//    a cached copy is never stale. This is what keeps an already-open Kasir
//    tab's JS/CSS available through a network blip.
// 2. Network-first for page navigations, falling back to a static,
//    zero-data /offline page ONLY when there's no network at all. This
//    deliberately does NOT cache or serve a stale copy of any real page
//    (Order Aktif, Kasir, Dashboard) — a stale queue/cash snapshot is worse
//    than no page at all for a cash register, so a page that can't be
//    freshly loaded shows "you're offline", never yesterday's data.
//
// Explicitly NOT here: any offline transaction queue / background sync for
// saving orders while offline — out of scope on purpose (see CLAUDE.md).
const CACHE_NAME = "pos-mi-ayam-shell-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .catch(() => {
        // Best-effort precache — a failed install must never block the app
        // itself from working online.
      }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
