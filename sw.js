// AERIS Finanz-App — Service Worker (2026-09-19, Network-First)
// Network-First fuer die eigene App-Shell (rein clientseitige PWA, kein Backend/API):
// immer frisch aus dem Netz laden, Cache nur als Offline-Fallback. Ersetzt die vorherige
// Cache-First-Strategie, die dazu fuehrte, dass die Leistungsnachweis-Korrektur (Massnahmen-
// Namen je SGB-Kategorie) auf dem echten iPhone nicht ankam, obwohl index.html bereits
// korrekt war (Befund 2026-09-19). CACHE_NAME weiterhin bei jedem SW-Update hochzaehlen,
// damit alte Caches im activate-Event sauber aufgeraeumt werden.
const CACHE_NAME = 'aeris-finanz-v9';
const APP_SHELL = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './aeris-fx.css',
  './aeris-fx.js',
  './manifest.json',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './buchhaltung/',
  './buchhaltung/index.html',
  './buchhaltung/app.css',
  './buchhaltung/app.js',
  './buchhaltung/manifest.json',
  './buchhaltung/icons/apple-touch-icon.png',
  './buchhaltung/icons/favicon-32.png',
  './buchhaltung/icons/icon-192.png',
  './buchhaltung/icons/icon-512.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  var isOwnOrigin = url.origin === self.location.origin;

  if (!isOwnOrigin) {
    // Keine externen Requests mehr zu erwarten (Tailwind-CDN entfernt, Font ist Base64-inline).
    // Falls doch etwas Externes angefragt wird: einfach ans Netzwerk durchreichen, kein Cache-Eingriff.
    event.respondWith(fetch(req));
    return;
  }

  // Network-First — zuerst frisch aus dem Netz, Antwort im Cache aktualisieren.
  // Nur bei Netzwerkfehler (z.B. offline) auf den Cache zurueckfallen.
  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var resClone = res.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(req, resClone);
        });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        if (cached) return cached;
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
