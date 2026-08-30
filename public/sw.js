/* DEEPWAVE service worker — offline app shell.
 * All URLs are scope-relative so the same file works at site root
 * and under a basePath (e.g. GitHub Pages /deepwave/).
 * Bump VERSION to invalidate caches on deploy. */
const VERSION = "deepwave-v1";
const SHELL = ["./"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== location.origin) return;

  /* navigations: network-first, fall back to cached shell when offline */
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./"))
    );
    return;
  }

  /* hashed static assets: cache-first */
  const cacheable =
    url.pathname.includes("/_next/static/") ||
    /\.(css|js|png|svg|jpg|jpeg|webp|woff2|ico)$/.test(url.pathname);
  if (!cacheable) return;

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
    )
  );
});
