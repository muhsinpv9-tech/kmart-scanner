const CACHE_NAME = "kmart-cache-v2"; // v1 -> v2 aakki, pazhaya cache kalayan

const ASSETS = [
  "index.html",
  "style.css",
  "app.js",
  "manifest.json",
  "products.json", // PUTHIYATHU - database main branch-il ninnu
  "icon-192.jpeg",
  "icon-512.png",
  "banner.png"
];

// Install SW
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate SW
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
});

// Fetch handler - products.json eppozhum fresh edukkum
self.addEventListener("fetch", (event) => {
  // products.json-nu cache venda, fresh venam
  if (event.request.url.includes("products.json")) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("products.json"))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() =>
          caches.match("index.html")
        )
      );
    })
  );
});