const CACHE_NAME = "kmart-cache-v3";
const ASSETS = ["index.html","style.css","app.js","manifest.json","icon-192.jpeg","banner.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(()=>{}));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null))));
});
self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match("index.html"))));
});