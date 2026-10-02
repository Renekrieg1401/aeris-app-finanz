/* =====================================================================================
   AERIS Route — automatische km-Berechnung + Routenplanung mit Google Maps (Fahrt-Erfassung)
   -------------------------------------------------------------------------------------
   - km-Berechnung über OpenStreetMap: Nominatim (Adresse → Koordinaten) und OSRM (Fahrstrecke).
     Kostenlos, ohne API-Schlüssel. Es werden ausschließlich die eingetippten Orte/Adressen
     übertragen — niemals Pflege- oder Klientendaten aus der Dokumentation.
   - Automatik nur nach einmaliger Zustimmung (gespeichert je Gerät: 'aeris-route' = auto|manuell);
     der Knopf „km berechnen“ funktioniert jederzeit als ausdrückliche Einzelaktion.
   - „Route in Google Maps“ öffnet die Navigation (iPhone: Google-Maps-App, sonst Browser).
   - Ortsvorschläge aus bereits erfassten Fahrten (window.AERIS_DOKU.bekannteOrte, nur lokal).
   Schreibt ausschließlich in das km-Feld des Formulars; gespeichert wird wie bisher über app.js.
   ===================================================================================== */
(function () {
  'use strict';

  var KEY_MODUS = 'aeris-route';
  var NOMINATIM = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=de&accept-language=de&q=';
  var OSRM = 'https://router.project-osrm.org/route/v1/driving/';
  var geoCache = {}, fehlCache = {}, letzteAnfrage = 0, basisKm = null, anfrageNr = 0, paarLaufend = '', paarFertig = '';

  function $(id) { return document.getElementById(id); }
  function modus() { try { return localStorage.getItem(KEY_MODUS); } catch (e) { return null; } }
  function setModus(m) { try { localStorage.setItem(KEY_MODUS, m); } catch (e) { return; } }
  function wert(id) { var el = $(id); return el ? el.value.trim() : ''; }
  function hinweis(text, ton) { var n = $('ui-route-note'); if (!n) return; n.textContent = text; n.setAttribute('data-tone', ton || ''); }
  function warte(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // Nominatim-Nutzungsregeln: höchstens 1 Anfrage pro Sekunde → Anfragen zeitlich staffeln, Ergebnisse cachen.
  function geocode(ort) {
    var key = ort.toLowerCase();
    if (geoCache[key]) return Promise.resolve(geoCache[key]);
    if (fehlCache[key]) return Promise.reject(new Error('nicht gefunden: ' + ort));
    var pause = Math.max(0, letzteAnfrage + 1100 - Date.now());
    return warte(pause).then(function () {
      letzteAnfrage = Date.now();
      return fetch(NOMINATIM + encodeURIComponent(ort), { headers: { Accept: 'application/json' } });
    }).then(function (r) {
      if (!r.ok) throw new Error('geocode ' + r.status);
      return r.json();
    }).then(function (liste) {
      if (!Array.isArray(liste) || !liste.length) { fehlCache[key] = true; throw new Error('nicht gefunden: ' + ort); }
      var p = { lat: parseFloat(liste[0].lat), lon: parseFloat(liste[0].lon), name: liste[0].display_name || ort };
      if (!isFinite(p.lat) || !isFinite(p.lon)) throw new Error('ungültig: ' + ort);
      geoCache[key] = p;
      return p;
    });
  }
  function strecke(a, b) {
    return fetch(OSRM + a.lon + ',' + a.lat + ';' + b.lon + ',' + b.lat + '?overview=false&alternatives=false').then(function (r) {
      if (!r.ok) throw new Error('route ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || j.code !== 'Ok' || !j.routes || !j.routes.length) throw new Error('keine Route');
      return { km: j.routes[0].distance / 1000, min: j.routes[0].duration / 60 };
    });
  }
  function kmSetzen() {
    var feld = $('qc-f-km');
    if (!feld || basisKm === null) return;
    var km = basisKm * ($('ui-route-rueck') && $('ui-route-rueck').checked ? 2 : 1);
    feld.value = (Math.round(km * 10) / 10).toFixed(1);
    feld.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function berechnen(ausloeser) {
    var von = wert('qc-f-von'), nach = wert('qc-f-nach');
    if (von.length < 3 || nach.length < 3) { if (ausloeser === 'knopf') hinweis('Bitte zuerst Start- und Zielort eintragen.', 'warn'); return; }
    if (!navigator.onLine) { hinweis('Offline — km bitte manuell eintragen.', 'warn'); return; }
    // Doppelte Anfragen vermeiden (Knopf + Feld-Verlassen lösen oft gleichzeitig aus; Nominatim: max. 1/s).
    var paar = von.toLowerCase() + '|' + nach.toLowerCase();
    if (paar === paarLaufend) return;
    if (paar === paarFertig && basisKm !== null) { kmSetzen(); return; }
    var nr = ++anfrageNr;
    paarLaufend = paar;
    hinweis('Route wird berechnet …', '');
    geocode(von).then(function (a) {
      return geocode(nach).then(function (b) { return strecke(a, b); });
    }).then(function (r) {
      if (nr !== anfrageNr) return;
      basisKm = r.km; paarFertig = paar;
      kmSetzen();
      hinweis('✓ ' + r.km.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' km einfache Strecke · ca. ' + Math.round(r.min) + ' Min. (OpenStreetMap). Bitte kurz prüfen.', 'ok');
    }).catch(function (err) {
      if (nr !== anfrageNr) return;
      var nichtGefunden = /nicht gefunden/.test(String(err && err.message));
      hinweis(nichtGefunden ? 'Ort nicht gefunden — genauer eingeben (z. B. „Straße Nr, PLZ Ort“) oder km manuell eintragen.' : 'Routenberechnung gerade nicht möglich — km bitte manuell eintragen.', 'warn');
    }).then(function () { if (paarLaufend === paar) paarLaufend = ''; });
  }
  function mapsOeffnen() {
    var von = wert('qc-f-von'), nach = wert('qc-f-nach');
    if (!nach) { hinweis('Bitte zuerst ein Ziel eintragen.', 'warn'); return; }
    var url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(nach) + (von ? '&origin=' + encodeURIComponent(von) : '');
    window.open(url, '_blank', 'noopener');
  }
  function automatik() {
    var m = modus(), von = wert('qc-f-von'), nach = wert('qc-f-nach');
    if (von.length < 3 || nach.length < 3) return;
    if (m === 'auto') { berechnen('auto'); return; }
    if (m === null && $('ui-route-consent')) $('ui-route-consent').classList.remove('ae-hidden');
  }
  function orteFuellen() {
    var dl = $('ae-orte'), api = window.AERIS_DOKU;
    if (!dl || !api || typeof api.bekannteOrte !== 'function') return;
    dl.replaceChildren();
    api.bekannteOrte().slice(0, 40).forEach(function (o) { var opt = document.createElement('option'); opt.value = o; dl.appendChild(opt); });
  }
  function entprellt(fn, ms) { var t = 0; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  function boot() {
    if (!$('ui-route')) return;
    $('ui-route-calc').addEventListener('click', function () { berechnen('knopf'); });
    $('ui-route-maps').addEventListener('click', mapsOeffnen);
    $('ui-route-rueck').addEventListener('change', function () { if (basisKm !== null) kmSetzen(); });
    $('ui-route-ok').addEventListener('click', function () { setModus('auto'); $('ui-route-consent').classList.add('ae-hidden'); berechnen('auto'); });
    $('ui-route-nein').addEventListener('click', function () { setModus('manuell'); $('ui-route-consent').classList.add('ae-hidden'); hinweis('Automatik aus — „km berechnen“ funktioniert weiterhin auf Knopfdruck.', ''); });
    var auto = entprellt(automatik, 900);
    ['qc-f-von', 'qc-f-nach'].forEach(function (id) {
      $(id).addEventListener('change', auto);
      $(id).addEventListener('input', function () { basisKm = null; paarFertig = ''; });
    });
    $('qc-f-km').addEventListener('input', function (e) { if (e.isTrusted) basisKm = null; });
    $('qc-fahrt').addEventListener('submit', function () { setTimeout(function () { basisKm = null; hinweis('', ''); if ($('ui-route-rueck')) $('ui-route-rueck').checked = false; orteFuellen(); }, 0); });
    document.addEventListener('aeris:heute-gerendert', orteFuellen);
    orteFuellen();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
