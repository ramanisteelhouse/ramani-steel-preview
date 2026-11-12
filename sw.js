/*
 * Service worker: caching for returning visitors.
 *
 * GitHub Pages sends every file with `Cache-Control: max-age=600`, and the host's
 * headers cannot be changed. So after ten minutes a returning visitor's browser
 * asks the server again about every script and image on the page. This worker
 * answers those from the visitor's own device instead.
 *
 *  - /_next/static/*   Named after a hash of their contents, so a given URL never
 *                      changes: served from the cache, fetched once.
 *  - /images/*         Photographs, which can be replaced under the same name:
 *                      served from the cache at once and refreshed in the
 *                      background, so a new photo appears on the following visit.
 *
 * HTML is never cached here. Every page load goes to the network, so content and
 * price information are always current, and a bug in this file cannot leave a
 * visitor on an old page.
 *
 * Bump VERSION to discard every cache the next time the worker updates.
 */
const VERSION = "v1";
const STATIC_CACHE = `rsh-static-${VERSION}`;
const IMAGE_CACHE = `rsh-images-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("rsh-") && !name.endsWith(VERSION)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);
  return hit || refresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (/\/images\/.+\.(webp|png|jpe?g|svg)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
  }
});
