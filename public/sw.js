// Aqua Nexus development cleanup service worker.
// It exists only so any old localhost registration can update and then remove itself.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("aqua-nexus"))
          .map((key) => caches.delete(key))
      );

      await self.registration.unregister();

      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clients) {
        client.navigate(client.url);
      }
    })()
  );
});

self.addEventListener("fetch", () => {
  // Intentionally no fetch interception in development.
});
