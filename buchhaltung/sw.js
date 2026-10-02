/* AERIS Buch — Service Worker (Scope: /buchhaltung/)
   - Network-First am HTTP-Cache vorbei (cache:'no-cache'); Cache nur als Offline-Rückfall.
   - Precache mit den versionierten URLs (?v=VERSION) aus index.html → offline ab dem ersten Start.
   - Räumt ausschließlich EIGENE Caches auf (Präfix 'aeris-buch-' + Altnamen), niemals die der
     AERIS Doku (gleicher Origin, eigener Service Worker an der Wurzel).
   - Versionsprüfungen (?v=<Zeitstempel>) und ?neu= werden nicht gecacht (kein Cache-Wachstum).
   Es werden nur eigene GET-Antworten gecacht — keine Nutzerdaten (verschlüsselt im localStorage).
   VERSION muss mit den ?v=-Stempeln in index.html übereinstimmen. */
const VERSION = '2026-10-02-005';
const CACHE_NAME = 'aeris-buch-' + VERSION;
const FILES_TO_CACHE = [
  './', './index.html', './manifest.json',
  './app.css?v=' + VERSION, './app.js?v=' + VERSION,
  './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png', './icons/apple-touch-icon.png'
];

function istEigenerAltCache(name) {
  return name !== CACHE_NAME && (name.indexOf('aeris-buch-') === 0 || name.indexOf('aeris-buchhaltung-') === 0 || /^aeris-finanz-v20\d\d-/.test(name));
}

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
      .then((names) => Promise.all(names.filter(istEigenerAltCache).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const v = url.searchParams.get('v');
  if (v && /^\d{10,}$/.test(v)) return; // Update-Prüfung: direkt ans Netz, nie cachen

  const key = req.mode === 'navigate' ? url.origin + url.pathname : req;
  event.respondWith(
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(key, copy));
      }
      return res;
    }).catch(() => caches.match(key)
      .then((hit) => hit || caches.match(req, { ignoreSearch: true }))
      .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html', { ignoreSearch: true }) : Response.error())))
  );
});
