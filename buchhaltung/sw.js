/* AERIS Buch — Service Worker
   Network-First für ALLE eigenen Dateien (HTML, JS, CSS, Icons), jeweils am HTTP-Cache vorbei
   (cache: 'no-cache' → Revalidierung beim Server). Der Cache dient nur als Offline-Rückfall.
   Hintergrund (Befund 2026-10-02, iPhone): Cache-First für Skripte + 10-Minuten-HTTP-Cache von
   GitHub Pages lieferten nach einem Update weiter das alte app.js — der Update-Hinweis lief in
   einer Schleife. Asset-URLs tragen zusätzlich ?v=<Version> (index.html).
   Es werden ausschliesslich eigene GET-Antworten gecacht — keine Nutzerdaten (die liegen
   verschlüsselt im localStorage). */
const CACHE_NAME = 'aeris-buch-v2026-10-02-004';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES_TO_CACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
