// Vite's hashed asset URLs keep each published build isolated from older caches.
const CACHE = "navy-lights-v2";
const APP_URL = new URL("./", self.location.href).href;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("navy-lights-") && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_CARDS")
    event.waitUntil(
      caches.open(CACHE).then((cache) => cache.addAll(event.data.urls)),
    );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE).then((cache) => cache.put(APP_URL, copy)),
            );
          }
          return response;
        })
        .catch(
          async () =>
            (await (
              await caches.open(CACHE)
            ).match(APP_URL, { ignoreVary: true })) || Response.error(),
        ),
    );
    return;
  }
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(event.request, { ignoreVary: true }))
      .then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              event.waitUntil(
                caches
                  .open(CACHE)
                  .then((cache) => cache.put(event.request, copy)),
              );
            }
            return response;
          }),
      ),
  );
});
