/* AERIS Buch — Service Worker
   HTML: network-first (Updates kommen sofort an, offline aus dem Cache).
   Statische Dateien: cache-first. Es werden ausschliesslich eigene, gleich-originige
   GET-Anfragen gecacht — keine Nutzerdaten (die liegen verschluesselt im localStorage). */
const CACHE_NAME = 'aeris-finanz-v2026-10-02-002';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './app.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

function putInCache(request, response) {
  if (response && response.status === 200 && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (new URL(req.url).searchParams.has('v')) return; // Update-Pruefung immer direkt ans Netz

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => putInCache(req, res)).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => putInCache(req, res))));
});
