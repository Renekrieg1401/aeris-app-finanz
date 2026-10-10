/* AERIS Doku — Service Worker (Scope: Wurzel)
   - Network-First am HTTP-Cache vorbei (cache:'no-cache'); Cache nur als Offline-Rückfall.
   - Precache enthält die versionierten URLs (?v=VERSION), wie index.html sie lädt — damit
     funktioniert offline bereits nach dem ERSTEN Online-Start und direkt nach jedem Update.
   - Rückfall zusätzlich mit ignoreSearch (falls eine Datei unter anderer ?v= gecacht ist).
   - Räumt ausschließlich EIGENE Caches auf (Präfix 'aeris-doku-' + Altnamen 'aeris-finanz-vNN'),
     niemals die von AERIS Buch (gleicher Origin, eigener Service Worker in /buchhaltung/).
   - Versionsprüfungen (?v=<Zeitstempel>) und ?neu=-Neuladen werden NICHT gecacht; Seiten
     werden unter ihrer Adresse ohne Query abgelegt (kein Cache-Wachstum).
   VERSION muss mit den ?v=-Stempeln in index.html übereinstimmen. */
const VERSION = '2026-10-10-017';
const CACHE_NAME = 'aeris-doku-' + VERSION;
const STAMPED = ['app.css', 'app.js', 'aeris-fx.css', 'aeris-fx.js', 'aeris-ui.css', 'aeris-ui.js', 'aeris-login.js', 'aeris-route.js'];
const APP_SHELL = ['./', './index.html', './manifest.json', './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/icon-192.png', './icons/icon-512.png']
  .concat(STAMPED.map(function (f) { return './' + f + '?v=' + VERSION; }));

function istEigenerAltCache(name) {
  return name !== CACHE_NAME && (name.indexOf('aeris-doku-') === 0 || /^aeris-finanz-v\d+$/.test(name));
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(istEigenerAltCache).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/buchhaltung/') !== -1) return; // AERIS Buch hat einen eigenen Service Worker
  var v = url.searchParams.get('v');
  if (v && /^\d{10,}$/.test(v)) return; // Update-Prüfung: immer direkt ans Netz, nie cachen

  var key = req.mode === 'navigate' ? url.origin + url.pathname : req;
  event.respondWith(
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(key, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(key).then(function (hit) {
        if (hit) return hit;
        return caches.match(req, { ignoreSearch: true }).then(function (loose) {
          if (loose) return loose;
          return req.mode === 'navigate' ? caches.match('./index.html', { ignoreSearch: true }) : Response.error();
        });
      });
    })
  );
});
