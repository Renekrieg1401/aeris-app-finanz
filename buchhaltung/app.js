/* =====================================================================================
   AERIS Buch — Abrechnung, Ausgaben, Zahlungsübersicht, Steuer-Rücklagen & Exporte (GmbH i.G.)
   -------------------------------------------------------------------------------------
   Datenquellen
   1) AERIS Dokumentation (localStorage 'ae-finanz-log-v1-enc'): NUR LESEND. Gleiche PIN,
      gleiche Krypto (PBKDF2-SHA-256 150.000 → AES-256-GCM) wie ../app.js. Diese App
      schreibt niemals in diesen Datenbestand.
   2) AERIS Buch (localStorage 'ae-buchhaltung-v1-enc'): eigene Daten — Belege,
      Zahlungseingänge, Versand-Zugänge, Kontenrahmen/Rücklagequote. Ebenfalls mit der
      PIN verschlüsselt (eigenes Salt).
   Abrechnungsformel (Stunden × Satz + Zuschläge, Feiertage Hessen, Nachtfenster
   19–06 Uhr, Mitternachts-Splitting) ist 1:1 aus ../app.js (renderRechnung /
   berechneBudgetZahlenFuer) übernommen, damit Rechnung und Finanz-Zahlen nie
   auseinanderlaufen.
   ===================================================================================== */
(function () {
  'use strict';

  var APP_VERSION = '2026-10-02-008';
  var KEY_DOKU = 'ae-finanz-log-v1-enc';
  var KEY_FIN = 'ae-buchhaltung-v1-enc';
  var KEY_STB = 'ae-buchhaltung-stb-v1-enc';
  var KEY_LEGACY_VERSAND = 'ae-buchhaltung-versand-config';
  var KEY_FX = 'ae-finanz-fx';
  var PBKDF2_ITER = 150000;
  var KM_SATZ = 0.30;
  var AUTO_LOCK_MS = 15 * 60 * 1000;
  // Korrektur 2026-10-09 (René-Direktive, s. app.js ZUSCHLAG_KOEFFIZIENTEN): nacht 19%→25%, sonntag 25%→50%.
  var ZUSCHLAG = { nacht: 0.25, samstag: 0.08, sonntag: 0.50, feiertag: 1.25, weihnachten: 1.35 };
  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  var WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var FX_STUFEN = ['voll', 'reduziert', 'aus'];

  // ---------- Kontenrahmen (Erlöse/Fahrt identisch zum Steuerberater-Export in ../app.js) ----------
  var KONTEN = {
    basis:    { skr03: '8100', skr04: '4100', label: 'Pflegeerlöse Basis (§ 37c SGB V)' },
    zuschlag: { skr03: '8115', skr04: '4115', label: 'Zuschläge Pflege' },
    privat:   { skr03: '8400', skr04: '4400', label: 'Privatleistungen (Aufnahme/Anamnese) — Erlöse 19% USt' },
    fahrt:    { skr03: '4660', skr04: '6650', label: 'Reisekosten Arbeitnehmer 0,30 €/km' }
  };
  // Kontenvorschläge nach DATEV-Standardkontenrahmen — vor Übergabe mit dem Steuerbüro abstimmen.
  var BELEG_KATEGORIEN = [
    { key: 'versicherung', label: 'Versicherungen (Berufshaftpflicht u. a.)', skr03: '4360', skr04: '6400', icon: 'i-shield' },
    { key: 'beitraege', label: 'Beiträge (Berufsverband, Kammer)', skr03: '4380', skr04: '6420', icon: 'i-receipt' },
    { key: 'fortbildung', label: 'Fortbildung & Pflichtschulungen', skr03: '4945', skr04: '6821', icon: 'i-doc' },
    { key: 'fachliteratur', label: 'Fachliteratur & Zeitschriften', skr03: '4940', skr04: '6820', icon: 'i-doc' },
    { key: 'arbeitsmittel', label: 'Arbeitsmittel & Betriebsbedarf', skr03: '4980', skr04: '6850', icon: 'i-heart' },
    { key: 'gwg', label: 'Geringwertige Wirtschaftsgüter (GWG)', skr03: '4855', skr04: '6260', icon: 'i-wallet' },
    { key: 'telefon', label: 'Telefon & Internet', skr03: '4920', skr04: '6805', icon: 'i-receipt' },
    { key: 'porto', label: 'Porto', skr03: '4910', skr04: '6800', icon: 'i-receipt' },
    { key: 'buero', label: 'Bürobedarf', skr03: '4930', skr04: '6815', icon: 'i-receipt' },
    { key: 'edv', label: 'Software & IT-Wartung', skr03: '4806', skr04: '6495', icon: 'i-gear' },
    { key: 'beratung', label: 'Steuerberatung & Rechtskosten', skr03: '4950', skr04: '6825', icon: 'i-tax' },
    { key: 'werbung', label: 'Werbekosten', skr03: '4600', skr04: '6600', icon: 'i-receipt' },
    { key: 'geldverkehr', label: 'Nebenkosten des Geldverkehrs', skr03: '4970', skr04: '6855', icon: 'i-wallet' },
    { key: 'sonstige', label: 'Sonstige betriebliche Aufwendungen', skr03: '4900', skr04: '6300', icon: 'i-receipt' }
  ];
  var KAT = {};
  BELEG_KATEGORIEN.forEach(function (k) { KAT[k.key] = k; });

  var EMPFAENGER = [
    { key: 'steuerberater', label: 'Steuerbüro', hinweis: 'Monatspaket: Kontenmatrix, Buchungsliste, Fahrtenbuch.', csv: 'paket',
      felder: [{ key: 'email', label: 'E-Mail Steuerbüro' }, { key: 'elsterZertifikat', label: 'ELSTER-Zertifikat (Referenz)' }] },
    { key: 'kasse', label: 'Kranken-/Pflegekasse', hinweis: 'Leistungsnachweis: Schichten, Stunden, Zuschläge.', csv: 'leistung',
      felder: [{ key: 'ikNummer', label: 'IK-Nummer Kasse' }, { key: 'portalEndpunkt', label: 'Kassen-Portal-Endpunkt' }] },
    { key: 'auftraggeber', label: 'Auftraggeber (Klient/Budgetnehmer)', hinweis: 'Rechnungspositionen Budget und Privat.', csv: 'positionen',
      felder: [{ key: 'email', label: 'E-Mail Klient/Budgetnehmer' }] },
    { key: 'wirtschaftspruefer', label: 'Wirtschaftsprüfer', hinweis: 'Buchungsliste mit Konten (Jahresabschluss).', csv: 'buchungen',
      felder: [{ key: 'email', label: 'E-Mail Wirtschaftsprüfer' }] },
    { key: 'sammelordner', label: 'Sammelordner (eigene Ablage)', hinweis: 'Alles in einer Datei: Paket und Leistungsnachweis.', csv: 'alles', felder: [] },
    { key: 'md', label: 'Medizinischer Dienst (MD)', hinweis: 'MD-Prüfungen benötigen Pflegedokumentation und Assessments — Export direkt in AERIS Doku (Auswertungen).', csv: null,
      felder: [{ key: 'endpunkt', label: 'MD-/TI-Endpunkt' }] }
  ];

  // ---------- Zustand ----------
  var S = { doku: null, fin: null, key: null, salt: null, demo: false, ym: '', tab: 'cockpit', pendingFinBlob: null, dokuKeyPin: null, dokuKey: null, dokuRaw: '', dokuSalt: '', syncedAt: 0 };
  var persistQueue = Promise.resolve();
  var lockTimer = 0;

  // =====================================================================================
  // Hilfsfunktionen
  // =====================================================================================
  function $(id) { return document.getElementById(id); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function isoDate(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); }
  function todayIso() { var d = new Date(); return isoDate(d.getFullYear(), d.getMonth(), d.getDate()); }
  function currentYm() { return todayIso().slice(0, 7); }
  function isIso(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00');
    return !isNaN(d.getTime()) && isoDate(d.getFullYear(), d.getMonth(), d.getDate()) === s;
  }
  function isYm(s) { return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s); }
  function isCent(n) { return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 1e11; }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function uid() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function toCent(n) { return Math.round(n * 100); }
  function ymShift(ym, delta) {
    var y = parseInt(ym.slice(0, 4), 10), m = parseInt(ym.slice(5, 7), 10) - 1 + delta;
    var d = new Date(y, m, 1);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }
  function ymLabel(ym) { return MONATE[parseInt(ym.slice(5, 7), 10) - 1] + ' ' + ym.slice(0, 4); }
  function lastDayIso(ym) {
    var d = new Date(parseInt(ym.slice(0, 4), 10), parseInt(ym.slice(5, 7), 10), 0);
    return isoDate(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function fmtDate(iso) { return iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '—'; }
  function fmtEuro(n) { return (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
  function fmtCent(c) { return fmtEuro((c || 0) / 100); }
  function fmtNum(n, digits) { return (n || 0).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  function fmtCompact(n) {
    if (Math.abs(n) >= 1000) return (n / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' T€';
    return Math.round(n).toLocaleString('de-DE') + ' €';
  }
  function decimalDe(n) { return r2(n).toFixed(2).replace('.', ','); }
  function parseEuroToCent(input) {
    var s = String(input || '').replace(/[\s€]/g, '');
    if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null;
    var c = Math.round(parseFloat(s) * 100);
    return c > 0 ? c : null;
  }
  function kontoNr(konto) { return konto[S.fin ? S.fin.settings.skr : 'skr03']; }
  function skrLabel() { return S.fin && S.fin.settings.skr === 'skr04' ? 'SKR04' : 'SKR03'; }

  // ---------- DOM-Bau (ausschließlich textContent — kein innerHTML mit Daten) ----------
  function appendKids(el, kids) {
    if (kids === null || kids === undefined || kids === false) return;
    if (!Array.isArray(kids)) kids = [kids];
    kids.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
  }
  function setAttrs(el, attrs) {
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    });
  }
  function h(tag, attrs, kids) { var el = document.createElement(tag); setAttrs(el, attrs); appendKids(el, kids); return el; }
  function s(tag, attrs, kids) { var el = document.createElementNS('http://www.w3.org/2000/svg', tag); setAttrs(el, attrs); appendKids(el, kids); return el; }
  function icon(id, cls) { return s('svg', { class: cls || 'tab-ico', 'aria-hidden': 'true', focusable: 'false' }, s('use', { href: '#' + id })); }
  function mount(id, kids) { var el = $(id); el.replaceChildren(); appendKids(el, kids); return el; }
  function chip(tone, text) {
    var sym = { ok: '✓', warn: '!', crit: '✕', info: 'i' }[tone] || '';
    return h('span', { class: 'chip', 'data-tone': tone }, [h('span', { 'aria-hidden': 'true', text: sym }), text]);
  }
  function table(head, rows, foot) {
    var th = h('tr', null, head.map(function (c) { return h('th', { class: c.r ? 'r' : null, scope: 'col', text: c.t }); }));
    function cell(c, tag) {
      if (isObj(c) && !(c instanceof Node)) return h(tag, { class: c.cls || (c.r ? 'r' : null), colspan: c.span || null }, c.v);
      return h(tag, null, c);
    }
    var body = rows.map(function (r) { return h('tr', null, r.map(function (c) { return cell(c, 'td'); })); });
    var tfoot = foot ? h('tfoot', null, h('tr', null, foot.map(function (c) { return cell(c, 'td'); }))) : null;
    return [h('thead', null, th), h('tbody', null, body), tfoot];
  }
  function emptyState(title, text) { return h('div', { class: 'empty' }, [h('strong', { text: title }), text]); }
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('is-on'); }, 3200);
  }
  function note(id, msg, tone) { var el = $(id); el.textContent = msg; if (tone) el.setAttribute('data-tone', tone); else el.removeAttribute('data-tone'); }

  // =====================================================================================
  // Kryptografie (kompatibel zu ../app.js)
  // =====================================================================================
  function ab2b64(buf) {
    var bytes = new Uint8Array(buf), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b642ab(b64) {
    var bin = atob(b64), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr.buffer;
  }
  function randomSaltB64() { var a = new Uint8Array(16); crypto.getRandomValues(a); return ab2b64(a.buffer); }
  // Unverzerrte Zufallsziffer: Rejection-Sampling gegen Modulo-Bias (256 ist nicht durch 10 teilbar).
  function randomDigit() {
    var a = new Uint8Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= 250);
    return a[0] % 10;
  }
  function randomSechsstelligePin() {
    var s = '';
    for (var i = 0; i < 6; i++) s += randomDigit();
    return s;
  }
  function deriveKey(pin, saltB64, iterations) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']).then(function (material) {
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: b642ab(saltB64), iterations: iterations || PBKDF2_ITER, hash: 'SHA-256' },
        material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
    });
  }
  function encryptJson(key, obj) {
    var iv = new Uint8Array(12); crypto.getRandomValues(iv);
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(obj))).then(function (ct) {
      return { iv: ab2b64(iv.buffer), ct: ab2b64(ct) };
    });
  }
  function decryptJson(key, ivB64, ctB64) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(b642ab(ivB64)) }, key, b642ab(ctB64)).then(function (plain) {
      return JSON.parse(new TextDecoder().decode(plain));
    });
  }
  function parseEnvelope(raw) {
    var p = null;
    try { p = JSON.parse(raw); } catch (e) { return null; }
    if (!isObj(p) || typeof p.salt !== 'string' || typeof p.iv !== 'string' || typeof p.ct !== 'string') return null;
    var it = typeof p.iterations === 'number' && p.iterations >= 100000 && p.iterations <= 5000000 ? p.iterations : PBKDF2_ITER;
    return { salt: p.salt, iv: p.iv, ct: p.ct, iterations: it };
  }
  function readStorage(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  // Doku-Datensatz lesen (NUR lesend): seit 2026-10-02 speichert AERIS Doku in IndexedDB ('aeris-doku'/'kv');
  // Rückfall auf localStorage für ältere Doku-Stände oder Browser ohne IndexedDB.
  function ladeDokuRaw() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(readStorage(KEY_DOKU)); return; }
      var req;
      try { req = indexedDB.open('aeris-doku', 1); } catch (e) { resolve(readStorage(KEY_DOKU)); return; }
      req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
      req.onerror = function () { resolve(readStorage(KEY_DOKU)); };
      req.onsuccess = function () {
        var db = req.result;
        try {
          var g = db.transaction('kv', 'readonly').objectStore('kv').get(KEY_DOKU);
          g.onsuccess = function () { db.close(); resolve(typeof g.result === 'string' ? g.result : readStorage(KEY_DOKU)); };
          g.onerror = function () { db.close(); resolve(readStorage(KEY_DOKU)); };
        } catch (e) { db.close(); resolve(readStorage(KEY_DOKU)); }
      };
    });
  }

  // =====================================================================================
  // Validierung an Vertrauensgrenzen (entschlüsselte Daten, Sicherungsdatei, Formulare)
  // =====================================================================================
  function sanitizeDoku(raw) {
    var d = isObj(raw) ? raw : {};
    var settings = isObj(d.settings) ? d.settings : {};
    var satz = typeof settings.satzPflege === 'number' && settings.satzPflege > 0 ? settings.satzPflege : parseFloat(settings.satzPflege) || 105;
    var entries = Array.isArray(d.entries) ? d.entries.filter(function (e) { return isObj(e) && isIso(e.datum); }) : [];
    var tage = {};
    if (isObj(d.tage)) Object.keys(d.tage).forEach(function (iso) { if (isIso(iso) && isObj(d.tage[iso])) tage[iso] = d.tage[iso]; });
    var rn = isObj(d.rechnungsnummern) ? d.rechnungsnummern : {};
    var re = isObj(d.rechnungen) ? d.rechnungen : {};
    return {
      rechnungen: { budget: sanitizeRechnungen(re.budget), privat: sanitizeRechnungen(re.privat) },
      entries: entries, tage: tage,
      settings: { satzPflege: satz, kassenname: str(settings.kassenname, 120), pauschaleAufnahme: parseFloat(settings.pauschaleAufnahme) || 0, firma: sanitizeFirma(settings.firma) },
      rechnungsnummern: { budget: isObj(rn.budget) ? rn.budget : {}, privat: isObj(rn.privat) ? rn.privat : {} }
    };
  }
  // Firmendaten der GmbH i.G. aus AERIS Doku (Einstellungen → Firmendaten); leer = sichtbarer Platzhalter.
  var FIRMA_PLATZHALTER = { name: '[Firmenname] GmbH i.G.', strasse: '[Straße Hausnr.]', plzOrt: '[PLZ Ort]', geschaeftsfuehrer: '[Geschäftsführer/in]', registergericht: '[Registergericht]', hrb: '[HRB-Nummer]' };
  function sanitizeFirma(f) {
    var out = {};
    Object.keys(FIRMA_PLATZHALTER).forEach(function (k) { out[k] = isObj(f) ? str(f[k], 120).trim() : ''; });
    return out;
  }
  function firma(k) { return (S.doku && S.doku.settings.firma && S.doku.settings.firma[k]) || FIRMA_PLATZHALTER[k]; }
  // Festgeschriebene Rechnungen aus AERIS Doku (Nummer, Datum, eingefrorene Werte) — nur lesend übernommen.
  function sanitizeRechnungen(obj) {
    var out = {};
    if (!isObj(obj)) return out;
    Object.keys(obj).forEach(function (ym) {
      var r = obj[ym];
      if (!isYm(ym) || !isObj(r) || typeof r.nr !== 'string' || !isIso(r.datum) || !isObj(r.werte)) return;
      var w = r.werte, num = function (v) { return typeof v === 'number' && isFinite(v) ? v : 0; };
      var raw = isObj(w.raw) ? w.raw : {}, z = isObj(w.zStd) ? w.zStd : {};
      out[ym] = { nr: str(r.nr, 60), datum: r.datum, empfaenger: str(r.empfaenger, 400), werte: {
        std: num(w.std), nachtStd: num(w.nachtStd), satz: num(w.satz), summe: num(w.summe), zuschlaege: num(w.zuschlaege), anzahl: num(w.anzahl),
        zStd: { samstag: num(z.samstag), sonntag: num(z.sonntag), feiertag: num(z.feiertag), weihnachten: num(z.weihnachten) },
        raw: { basis: num(raw.basis), nacht: num(raw.nacht), samstag: num(raw.samstag), sonntag: num(raw.sonntag), feiertag: num(raw.feiertag), weihnachten: num(raw.weihnachten) }
      } };
    });
    return out;
  }
  function gmbhDefault() {
    return { grundgehaltCent: 0, bavCent: 0, firmenwagenCent: 0, ladestromCent: 0, hebesatz: 400, startYm: '', rentenzielCent: 0, renteneintrittJahr: 0 };
  }
  function finDefault() {
    return { v: 1, belege: [], zahlungen: {}, versand: {}, settings: { skr: 'skr03', quote: 30, gmbh: gmbhDefault(), stbEmail: '' } };
  }
  // belegDatei: { name, typ, dataUrl } -- optionaler Anhang (Rechnung/Beleg als PDF/Foto), zur
  // Sammelablage für den Steuerberater (Auftrag René 2026-10-09). Läuft im selben AES-256-GCM-
  // verschlüsselten Datensatz wie der Rest von AE.fin -- kein separater Speicherkanal.
  var BELEG_DATEI_MAX_BYTES = 8 * 1024 * 1024;
  function sanitizeBelegDatei(d) {
    if (!isObj(d) || typeof d.dataUrl !== 'string' || !/^data:(application\/pdf|image\/(jpeg|png|heic));base64,/.test(d.dataUrl)) return null;
    if (d.dataUrl.length > BELEG_DATEI_MAX_BYTES * 1.4) return null; // Base64 ~33% größer als Rohdaten
    return { name: str(d.name, 120).trim() || 'Beleg', typ: d.dataUrl.slice(5, d.dataUrl.indexOf(';')), dataUrl: d.dataUrl };
  }
  function sanitizeBeleg(b) {
    if (!isObj(b) || !isIso(b.datum) || !KAT[b.kat] || !isCent(b.betragCent) || b.betragCent === 0) return null;
    var text = str(b.text, 120).trim();
    if (!text) return null;
    return {
      id: typeof b.id === 'string' && /^[\w-]{1,40}$/.test(b.id) ? b.id : uid(),
      datum: b.datum, kat: b.kat, betragCent: b.betragCent, text: text,
      belegnr: str(b.belegnr, 40).trim(),
      zahlart: ['bank', 'karte', 'bar'].indexOf(b.zahlart) !== -1 ? b.zahlart : 'bank',
      datei: b.datei ? sanitizeBelegDatei(b.datei) : null,
      createdAt: typeof b.createdAt === 'number' ? b.createdAt : Date.now()
    };
  }
  function sanitizeZahlungen(raw) {
    var out = {};
    if (!isObj(raw)) return out;
    Object.keys(raw).forEach(function (k) {
      var z = raw[k];
      if (/^(budget|privat):\d{4}-(0[1-9]|1[0-2])$/.test(k) && isObj(z) && isIso(z.bezahltAm) && isCent(z.betragCent)) {
        out[k] = { bezahltAm: z.bezahltAm, betragCent: z.betragCent };
      }
    });
    return out;
  }
  function sanitizeVersand(raw) {
    var out = {};
    if (!isObj(raw)) return out;
    EMPFAENGER.forEach(function (e) {
      if (!isObj(raw[e.key])) return;
      out[e.key] = {};
      e.felder.forEach(function (f) { out[e.key][f.key] = str(raw[e.key][f.key], 200).trim(); });
    });
    return out;
  }
  function sanitizeFin(raw) {
    var d = finDefault();
    if (!isObj(raw)) return d;
    if (Array.isArray(raw.belege)) d.belege = raw.belege.map(sanitizeBeleg).filter(Boolean);
    d.zahlungen = sanitizeZahlungen(raw.zahlungen);
    d.versand = sanitizeVersand(raw.versand);
    if (isObj(raw.settings)) {
      if (raw.settings.skr === 'skr04') d.settings.skr = 'skr04';
      var q = raw.settings.quote;
      if (typeof q === 'number' && Number.isInteger(q) && q >= 0 && q <= 50) d.settings.quote = q;
      d.settings.gmbh = sanitizeGmbh(raw.settings.gmbh);
      d.settings.stbEmail = str(raw.settings.stbEmail, 120).trim();
    }
    return d;
  }
  function sanitizeGmbh(raw) {
    var d = gmbhDefault();
    if (!isObj(raw)) return d;
    ['grundgehaltCent', 'bavCent', 'firmenwagenCent', 'ladestromCent', 'rentenzielCent'].forEach(function (k) {
      if (isCent(raw[k])) d[k] = raw[k];
    });
    if (typeof raw.hebesatz === 'number' && raw.hebesatz >= 200 && raw.hebesatz <= 900) d.hebesatz = raw.hebesatz;
    if (isYm(raw.startYm) || raw.startYm === '') d.startYm = raw.startYm;
    if (typeof raw.renteneintrittJahr === 'number' && raw.renteneintrittJahr >= 2026 && raw.renteneintrittJahr <= 2100) d.renteneintrittJahr = raw.renteneintrittJahr;
    return d;
  }
  // ---------------- GmbH-Ebene: Grundgehalt/bAV/Firmenwagen/Steuerlast/Eigenkapitalbildung/Rentenziel ----------------
  // Rechnet ausschließlich mit echten, in dieser App erfassten Einnahmen/Ausgaben (monat()/jahr()) — keine
  // Planzahlen. Die fixen GF-Kosten (Grundgehalt/bAV/Firmenwagen) werden erst ab dem hinterlegten GmbH-Start
  // monatlich angesetzt, nicht rückwirkend.
  function gmbhSteuersatz(hebesatz) {
    var kst = 15, soli = r2(kst * 0.055), gewst = r2(3.5 * (hebesatz / 100));
    return r2(kst + soli + gewst);
  }
  function monatGmbh(ym) {
    var m = monat(ym), g = S.fin.settings.gmbh, aktiv = !!g.startYm && ym >= g.startYm;
    var fix = aktiv ? r2((g.grundgehaltCent + g.bavCent + g.firmenwagenCent + g.ladestromCent) / 100) : 0;
    var ebt = r2(m.einnahmen - m.ausgaben - fix);
    var satz = gmbhSteuersatz(g.hebesatz), steuer = ebt > 0 ? r2(ebt * satz / 100) : 0;
    return { ym: ym, basis: m, fix: fix, aktiv: aktiv, ebt: ebt, steuersatz: satz, steuer: steuer, eigenkapital: r2(ebt - steuer) };
  }
  function gmbhSeitStart() {
    var g = S.fin.settings.gmbh;
    if (!g.startYm) return { monate: 0, eigenkapital: 0, ebt: 0, steuer: 0, list: [] };
    var cur = currentYm(), ym = g.startYm, list = [], eigenkapital = 0, ebt = 0, steuer = 0, guard = 0;
    while (ym <= cur && guard < 600) {
      var r = monatGmbh(ym);
      list.push(r); eigenkapital += r.eigenkapital; ebt += r.ebt; steuer += r.steuer;
      ym = ymShift(ym, 1); guard++;
    }
    return { monate: list.length, eigenkapital: r2(eigenkapital), ebt: r2(ebt), steuer: r2(steuer), list: list };
  }
  // Kapitalbedarf-Faktor aus dem 30-Jahre/4%-Auszahlungsmodell (Kapital ≈ 301 × gewünschte Monatsrente netto).
  var RENTEN_FAKTOR_30J = 301;
  function gmbhRentenziel() {
    var g = S.fin.settings.gmbh, seit = gmbhSeitStart();
    if (!(g.rentenzielCent > 0) || !g.renteneintrittJahr) return null;
    var kapitalbedarf = r2(g.rentenzielCent / 100 * RENTEN_FAKTOR_30J);
    var heute = new Date(), monateBisRente = Math.max(0, (g.renteneintrittJahr - heute.getFullYear()) * 12 - heute.getMonth());
    var rate = seit.monate > 0 ? seit.eigenkapital / seit.monate : 0;
    var prognose = r2(seit.eigenkapital + rate * monateBisRente);
    return { kapitalbedarf: kapitalbedarf, bisher: seit.eigenkapital, monateBisRente: monateBisRente, rate: r2(rate), prognose: prognose, aufKurs: prognose >= kapitalbedarf };
  }
  function validateBelegForm(form) {
    var errors = [];
    var datum = form.datum.value, kat = form.kat.value, text = form.text.value.trim();
    var cent = parseEuroToCent(form.betrag.value);
    [form.datum, form.betrag, form.kat, form.text].forEach(function (f) { f.removeAttribute('aria-invalid'); });
    if (!isIso(datum)) { errors.push('Bitte ein gültiges Zahlungsdatum wählen.'); form.datum.setAttribute('aria-invalid', 'true'); }
    if (cent === null) { errors.push('Betrag bitte als Zahl > 0 mit höchstens zwei Nachkommastellen (z. B. 49,90).'); form.betrag.setAttribute('aria-invalid', 'true'); }
    if (!KAT[kat]) { errors.push('Bitte eine Kategorie wählen.'); form.kat.setAttribute('aria-invalid', 'true'); }
    if (!text) { errors.push('Bitte eine Beschreibung angeben.'); form.text.setAttribute('aria-invalid', 'true'); }
    if (errors.length) return { ok: false, errors: errors };
    return { ok: true, value: { datum: datum, kat: kat, betragCent: cent, text: text, belegnr: form.belegnr.value, zahlart: form.zahlart.value } };
  }

  // =====================================================================================
  // Abrechnungs-Kern (rein, seiteneffektfrei — 1:1 zu ../app.js)
  // =====================================================================================
  function timeToMinutes(hhmm) {
    if (typeof hhmm !== 'string') return null;
    var p = hhmm.split(':');
    if (p.length !== 2) return null;
    var hh = parseInt(p[0], 10), mm = parseInt(p[1], 10);
    return isNaN(hh) || isNaN(mm) ? null : hh * 60 + mm;
  }
  function shiftDauer(tag) {
    var st = timeToMinutes(tag.von), en = timeToMinutes(tag.bis);
    if (st === null || en === null) return null;
    var dur = en - st; if (dur <= 0) dur += 1440;
    return { start: st, dur: dur };
  }
  // Zeitumstellung (identisch zu AERIS Doku): echte lokale Zeitpunkte statt Uhrzeiten-Differenz.
  function schichtZeitraum(tag, iso) {
    if (!tag || !iso) return null;
    var s = timeToMinutes(tag.von), e = timeToMinutes(tag.bis);
    if (s === null || e === null) return null;
    var zp = function (tagIso, min) { return new Date(tagIso + 'T' + pad2(Math.floor(min / 60)) + ':' + pad2(min % 60) + ':00').getTime(); };
    return { start: zp(iso, s), end: zp(e > s ? iso : addDaysIso(new Date(iso + 'T00:00:00'), 1), e) };
  }
  function shiftStunden(tag, iso) {
    var z = schichtZeitraum(tag, iso);
    if (z) return Math.max(0, z.end - z.start) / 3600000;
    var d = shiftDauer(tag); return d ? d.dur / 60 : 0;
  }
  function nachtMinuten(tag, iso) {
    var z = schichtZeitraum(tag, iso);
    if (!z) return 0;
    var total = 0;
    for (var k = -1; k <= 1; k++) {
      var d = addDaysIso(new Date(iso + 'T00:00:00'), k);
      var ws = new Date(d + 'T19:00:00').getTime(), we = new Date(addDaysIso(new Date(d + 'T00:00:00'), 1) + 'T06:00:00').getTime();
      var ov = Math.min(z.end, we) - Math.max(z.start, ws);
      if (ov > 0) total += ov;
    }
    return total / 60000;
  }
  function easterSunday(year) {
    var a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), hh = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451);
    return new Date(year, Math.floor((hh + l - 7 * m + 114) / 31) - 1, ((hh + l - 7 * m + 114) % 31) + 1);
  }
  function addDaysIso(date, n) { var d = new Date(date); d.setDate(d.getDate() + n); return isoDate(d.getFullYear(), d.getMonth(), d.getDate()); }
  function hessenFeiertage(year) {
    var o = easterSunday(year);
    return [isoDate(year, 0, 1), addDaysIso(o, -2), addDaysIso(o, 1), isoDate(year, 4, 1), addDaysIso(o, 39),
      addDaysIso(o, 50), addDaysIso(o, 60), isoDate(year, 9, 3), isoDate(year, 11, 25), isoDate(year, 11, 26)];
  }
  var feiertagCache = {};
  function feiertagSet(year) {
    if (!feiertagCache[year]) {
      var set = {};
      hessenFeiertage(year).concat(hessenFeiertage(year + 1)).forEach(function (f) { set[f] = true; });
      feiertagCache[year] = set;
    }
    return feiertagCache[year];
  }
  function zuschlagTyp(iso, feiertage) {
    var mmdd = iso.slice(5);
    if (mmdd === '12-24' || mmdd === '12-25' || mmdd === '12-26') return 'weihnachten';
    if (feiertage[iso]) return 'feiertag';
    var wd = new Date(iso + 'T00:00:00').getDay();
    return wd === 0 ? 'sonntag' : wd === 6 ? 'samstag' : null;
  }
  function zuschlagStunden(tag, iso, feiertage) {
    var out = {}, zr = schichtZeitraum(tag, iso);
    if (!zr) return out;
    var mitternacht = new Date(addDaysIso(new Date(iso + 'T00:00:00'), 1) + 'T00:00:00').getTime();
    var vor = Math.max(0, Math.min(zr.end, mitternacht) - zr.start) / 60000, nach = Math.max(0, zr.end - Math.max(zr.start, mitternacht)) / 60000;
    var t1 = zuschlagTyp(iso, feiertage), t2 = zuschlagTyp(addDaysIso(new Date(iso + 'T00:00:00'), 1), feiertage);
    if (vor > 0 && t1) out[t1] = (out[t1] || 0) + vor / 60;
    if (nach > 0 && t2) out[t2] = (out[t2] || 0) + nach / 60;
    return out;
  }
  function tageImMonat(doku, ym) { return Object.keys(doku.tage).filter(function (iso) { return iso.indexOf(ym) === 0; }).sort(); }
  function budgetZahlen(doku, ym) {
    var fest = doku.rechnungen && doku.rechnungen.budget[ym];
    if (fest) {
      var w = fest.werte;
      return { std: w.std, nachtStd: w.nachtStd, zStd: w.zStd, satz: w.satz, raw: w.raw, basis: w.raw.basis, zuschlaege: w.zuschlaege, summe: w.summe, fest: true };
    }
    var feiertage = feiertagSet(parseInt(ym.slice(0, 4), 10));
    var std = 0, nachtStd = 0, z = { samstag: 0, sonntag: 0, feiertag: 0, weihnachten: 0 };
    tageImMonat(doku, ym).forEach(function (iso) {
      var tag = doku.tage[iso];
      std += shiftStunden(tag, iso);
      nachtStd += nachtMinuten(tag, iso) / 60;
      var a = zuschlagStunden(tag, iso, feiertage);
      Object.keys(a).forEach(function (t) { z[t] += a[t]; });
    });
    std = r2(std); nachtStd = r2(nachtStd);
    Object.keys(z).forEach(function (k) { z[k] = r2(z[k]); });
    var satz = doku.settings.satzPflege;
    var raw = { basis: r2(std * satz), nacht: r2(nachtStd * satz * ZUSCHLAG.nacht), samstag: r2(z.samstag * satz * ZUSCHLAG.samstag),
      sonntag: r2(z.sonntag * satz * ZUSCHLAG.sonntag), feiertag: r2(z.feiertag * satz * ZUSCHLAG.feiertag), weihnachten: r2(z.weihnachten * satz * ZUSCHLAG.weihnachten) };
    var zuschlaege = r2(raw.nacht + raw.samstag + raw.sonntag + raw.feiertag + raw.weihnachten);
    return { std: std, nachtStd: nachtStd, zStd: z, satz: satz, raw: raw, basis: raw.basis, zuschlaege: zuschlaege, summe: r2(raw.basis + zuschlaege), fest: false };
  }
  function entriesIn(doku, type, ym) {
    return doku.entries.filter(function (e) { return e.type === type && e.datum.indexOf(ym) === 0; })
      .sort(function (a, b) { return a.datum.localeCompare(b.datum) || String(a.uhrzeit || '').localeCompare(String(b.uhrzeit || '')); });
  }
  function privatZahlen(doku, ym) {
    var list = entriesIn(doku, 'privat', ym), fest = doku.rechnungen && doku.rechnungen.privat[ym];
    if (fest) return { list: list, summe: fest.werte.summe, fest: true };
    return { list: list, summe: r2(list.reduce(function (acc, e) { return acc + (parseFloat(e.betrag) || 0); }, 0)), fest: false };
  }
  function fahrtZahlen(doku, ym) {
    var list = entriesIn(doku, 'fahrt', ym), km = 0, kmBeratung = 0;
    list.forEach(function (e) { var k = parseFloat(e.km) || 0; km += k; if (e.sparte === 'beratung') kmBeratung += k; });
    return { list: list, km: km, kmBeratung: kmBeratung, betrag: r2(km * KM_SATZ) };
  }
  function belegeIn(fin, prefix) {
    return fin.belege.filter(function (b) { return b.datum.indexOf(prefix) === 0; })
      .sort(function (a, b) { return a.datum.localeCompare(b.datum) || a.createdAt - b.createdAt; });
  }
  function centSum(list) { return list.reduce(function (acc, b) { return acc + b.betragCent; }, 0); }
  function monat(ym) {
    var budget = budgetZahlen(S.doku, ym), privat = privatZahlen(S.doku, ym), fahrt = fahrtZahlen(S.doku, ym);
    var belege = belegeIn(S.fin, ym), belegeSumme = centSum(belege) / 100;
    var einnahmen = r2(budget.summe + privat.summe), ausgaben = r2(fahrt.betrag + belegeSumme);
    return { ym: ym, budget: budget, privat: privat, fahrt: fahrt, belege: belege, belegeSumme: belegeSumme,
      einnahmen: einnahmen, ausgaben: ausgaben, ergebnis: r2(einnahmen - ausgaben) };
  }
  function jahr(year) {
    var out = [];
    for (var m = 0; m < 12; m++) out.push(monat(year + '-' + pad2(m + 1)));
    return out;
  }
  // Nur festgeschriebene Rechnungen haben eine gültige Nummer (bloß reservierte Altnummern werden nicht angezeigt).
  function rechnungsnr(art, ym) { var r = S.doku.rechnungen && S.doku.rechnungen[art][ym]; return r ? r.nr : ''; }
  function zahlung(art, ym) { return S.fin.zahlungen[art + ':' + ym] || null; }
  function offeneForderungen() {
    var out = [], seen = {};
    Object.keys(S.doku.tage).concat(S.doku.entries.filter(function (e) { return e.type === 'privat'; }).map(function (e) { return e.datum; }))
      .forEach(function (iso) { seen[iso.slice(0, 7)] = true; });
    Object.keys(seen).sort().forEach(function (ym) {
      if (ym >= currentYm()) return;
      var m = { budget: budgetZahlen(S.doku, ym).summe, privat: privatZahlen(S.doku, ym).summe };
      ['budget', 'privat'].forEach(function (art) { if (m[art] > 0 && !zahlung(art, ym)) out.push({ art: art, ym: ym, betrag: m[art] }); });
    });
    return out;
  }
  function zahlungsuebersicht(year) {
    var rows = [];
    for (var i = 0; i < 12; i++) rows.push({ ym: year + '-' + pad2(i + 1), zufluss: 0, abfluss: 0 });
    Object.keys(S.fin.zahlungen).forEach(function (k) {
      var z = S.fin.zahlungen[k];
      if (z.bezahltAm.slice(0, 4) === String(year)) rows[parseInt(z.bezahltAm.slice(5, 7), 10) - 1].zufluss += z.betragCent / 100;
    });
    rows.forEach(function (r) { r.abfluss = fahrtZahlen(S.doku, r.ym).betrag + centSum(belegeIn(S.fin, r.ym)) / 100; });
    rows.forEach(function (r) { r.zufluss = r2(r.zufluss); r.abfluss = r2(r.abfluss); r.ueberschuss = r2(r.zufluss - r.abfluss); });
    return rows;
  }
  function naechsterWerktag(iso) {
    var d = new Date(iso + 'T00:00:00'), fei = feiertagSet(d.getFullYear());
    while (d.getDay() === 0 || d.getDay() === 6 || fei[isoDate(d.getFullYear(), d.getMonth(), d.getDate())]) d.setDate(d.getDate() + 1);
    return isoDate(d.getFullYear(), d.getMonth(), d.getDate());
  }
  // GmbH: Körperschaftsteuer-Vorauszahlungen (§ 31 KStG i. V. m. § 37 EStG: 10.3./10.6./10.9./10.12.)
  // und Gewerbesteuer-Vorauszahlungen (§ 19 GewStG: 15.2./15.5./15.8./15.11.), jeweils nächster Werktag.
  function steuertermine(anzahl) {
    var out = [], heute = todayIso(), y = parseInt(heute.slice(0, 4), 10);
    for (var yy = y; yy <= y + 1; yy++) {
      ['03', '06', '09', '12'].forEach(function (mm) { out.push({ datum: naechsterWerktag(yy + '-' + mm + '-10'), art: 'Körperschaftsteuer', quartal: 'Q' + (parseInt(mm, 10) / 3) + ' ' + yy }); });
      ['02', '05', '08', '11'].forEach(function (mm) { out.push({ datum: naechsterWerktag(yy + '-' + mm + '-15'), art: 'Gewerbesteuer', quartal: 'Q' + ((parseInt(mm, 10) + 1) / 3) + ' ' + yy }); });
    }
    return out.filter(function (x) { return x.datum >= heute; }).sort(function (a, b) { return a.datum.localeCompare(b.datum); }).slice(0, anzahl);
  }
  function tageBis(iso) { return Math.round((new Date(iso + 'T00:00:00') - new Date(todayIso() + 'T00:00:00')) / 86400000); }

  // =====================================================================================
  // Speicherung der eigenen Finanzdaten (verschlüsselt)
  // =====================================================================================
  function persistFin() {
    if (S.demo || !S.key) return Promise.resolve();
    persistQueue = persistQueue.then(function () { return encryptJson(S.key, S.fin); }).then(function (enc) {
      localStorage.setItem(KEY_FIN, JSON.stringify({ v: 1, salt: S.salt, iterations: PBKDF2_ITER, iv: enc.iv, ct: enc.ct }));
    }).catch(function () {
      toast('Speichern fehlgeschlagen — Gerätespeicher prüfen und eine Sicherung herunterladen.');
    });
    return persistQueue;
  }
  function setupFinStore(pin) {
    var raw = readStorage(KEY_FIN);
    var env = raw ? parseEnvelope(raw) : null;
    if (!env) return createFinStore(pin);
    return deriveKey(pin, env.salt, env.iterations).then(function (key) {
      return decryptJson(key, env.iv, env.ct).then(function (data) {
        S.key = key; S.salt = env.salt; S.fin = sanitizeFin(data);
        return 'ok';
      });
    }).catch(function () { S.pendingFinBlob = env; return 'old-pin'; });
  }
  function createFinStore(pin) {
    S.salt = randomSaltB64();
    return deriveKey(pin, S.salt, PBKDF2_ITER).then(function (key) {
      S.key = key; S.fin = finDefault();
      var legacy = readStorage(KEY_LEGACY_VERSAND);
      if (legacy) {
        try { S.fin.versand = sanitizeVersand(JSON.parse(legacy)); } catch (e) { S.fin.versand = {}; }
      }
      return persistFin().then(function () {
        try { localStorage.removeItem(KEY_LEGACY_VERSAND); } catch (e) { return 'ok'; }
        return 'ok';
      });
    });
  }
  function steuerberaterZugangStatus() {
    var raw = readStorage(KEY_STB);
    if (!raw) return null;
    try { var env = JSON.parse(raw); return { erstelltAm: env.erstelltAm || 0 }; } catch (e) { return null; }
  }
  function steuerberaterZugangSpeichern(pin) {
    var salt = randomSaltB64();
    return deriveKey(pin, salt, PBKDF2_ITER).then(function (key) {
      return encryptJson(key, steuerberaterSnapshotDaten());
    }).then(function (enc) {
      localStorage.setItem(KEY_STB, JSON.stringify({ v: 1, salt: salt, iterations: PBKDF2_ITER, iv: enc.iv, ct: enc.ct, erstelltAm: Date.now() }));
    });
  }
  function steuerberaterZugangLoeschen() { try { localStorage.removeItem(KEY_STB); } catch (e) { return; } }
  // Separate, eigenständig entschlüsselbare Übergabe-Datei für die Steuerberater-PIN:
  // Passwort ist NICHT die PIN selbst, sondern ein frei wählbares Mandats-Aktenzeichen —
  // Datei und Aktenzeichen werden auf getrennten Wegen übermittelt (Trennung der Faktoren).
  function erzeugePinUebergabeDatei(pin, aktenzeichen) {
    var salt = randomSaltB64();
    return deriveKey(aktenzeichen, salt, PBKDF2_ITER).then(function (key) {
      return encryptJson(key, { pin: pin });
    }).then(function (enc) {
      return pinUebergabeDateiHtml(salt, enc.iv, enc.ct);
    });
  }
  function pinUebergabeDateiHtml(salt, iv, ct) {
    return '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">' +
      '<title>AERIS — PIN-Übergabe</title><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
      'background:#131B27;color:#E7E2D6;font-family:system-ui,sans-serif;padding:1.5rem;box-sizing:border-box}' +
      '.card{max-width:380px;width:100%;background:#1A2536;border:1px solid rgba(232,195,158,.25);' +
      'border-radius:14px;padding:1.6rem}h1{font-size:1.1rem;margin:0 0 .3rem}' +
      'p{font-size:.85rem;color:#9CADC9;line-height:1.5}input{width:100%;box-sizing:border-box;' +
      'padding:.6rem .7rem;border-radius:8px;border:1px solid rgba(232,195,158,.3);background:#253144;' +
      'color:#E7E2D6;font-size:1rem;margin:.6rem 0}button{width:100%;padding:.65rem;border:0;' +
      'border-radius:8px;background:linear-gradient(135deg,#6B4423,#B87333,#E8C39E);color:#131B27;' +
      'font-weight:700;cursor:pointer}#pin{font-size:1.6rem;letter-spacing:.1em;text-align:center;' +
      'font-weight:700;margin-top:.8rem;user-select:all}#msg{font-size:.82rem;color:#E8C39E;min-height:1.2em;margin-top:.5rem}</style>' +
      '</head><body><div class="card"><h1>AERIS — PIN-Übergabe</h1>' +
      '<p>Diese Datei enthält ausschließlich eine Zugangs-PIN, verschlüsselt mit dem Mandats-Aktenzeichen. Ohne das Aktenzeichen ist sie wertlos.</p>' +
      '<input id="az" type="text" placeholder="Mandats-Aktenzeichen" autocomplete="off">' +
      '<button id="go">Entschlüsseln</button><div id="msg"></div><div id="pin"></div>' +
      '<script>(function(){' +
      'var SALT="' + salt + '",IV="' + iv + '",CT="' + ct + '";' +
      'function b642ab(b){var bin=atob(b),a=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a.buffer;}' +
      'document.getElementById("go").addEventListener("click",function(){' +
      'var az=document.getElementById("az").value.trim();if(!az){return;}' +
      'document.getElementById("msg").textContent="Entschlüssele …";' +
      'crypto.subtle.importKey("raw",new TextEncoder().encode(az),{name:"PBKDF2"},false,["deriveKey"]).then(function(m){' +
      'return crypto.subtle.deriveKey({name:"PBKDF2",salt:b642ab(SALT),iterations:' + PBKDF2_ITER + ',hash:"SHA-256"},m,{name:"AES-GCM",length:256},false,["decrypt"]);' +
      '}).then(function(key){return crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(b642ab(IV))},key,b642ab(CT));' +
      '}).then(function(plain){var obj=JSON.parse(new TextDecoder().decode(plain));' +
      'document.getElementById("msg").textContent="";document.getElementById("pin").textContent=obj.pin;' +
      '}).catch(function(){document.getElementById("msg").textContent="Falsches Aktenzeichen.";document.getElementById("pin").textContent="";});' +
      '});})();<\/script></div></body></html>';
  }
  function rekeyFromOldPin(oldPin) {
    var env = S.pendingFinBlob;
    return deriveKey(oldPin, env.salt, env.iterations).then(function (oldKey) {
      return decryptJson(oldKey, env.iv, env.ct);
    }).then(function (data) {
      S.fin = sanitizeFin(data);
      S.salt = randomSaltB64();
      return deriveKey(S.dokuKeyPin, S.salt, PBKDF2_ITER);
    }).then(function (key) {
      S.key = key; S.pendingFinBlob = null; S.dokuKeyPin = null;
      return persistFin();
    });
  }

  // =====================================================================================
  // PIN-Gate
  // =====================================================================================
  var gateMode = 'doku';
  var gateStbMode = false;
  var STB_ANFRAGE_MAIL = 'r.krieg.home@gmail.com';
  function stbMailtoHref(email) {
    var betreff = 'AERIS Buch — Anfrage Steuerberater-Zugang';
    var text = 'Hallo,\n\nbitte richten Sie mir einen Steuerberater-Lesezugang für AERIS Buch ein.\n\n' +
      'Meine E-Mail-Adresse für die Rücksendung der Zugangsdaten:\n' + email + '\n\nKanzlei:\nAnsprechpartner:\n\nVielen Dank.';
    return 'mailto:' + STB_ANFRAGE_MAIL + '?subject=' + encodeURIComponent(betreff) + '&body=' + encodeURIComponent(text);
  }
  function setStbSubtab(which) {
    $('stb-subtabs').querySelectorAll('[data-stbtab]').forEach(function (b) {
      b.setAttribute('aria-checked', b.getAttribute('data-stbtab') === which ? 'true' : 'false');
    });
    var isAnfrage = which === 'anfrage';
    $('pin-form').classList.toggle('hidden', isAnfrage);
    $('stb-anfrage-form').classList.toggle('hidden', !isAnfrage);
    note('pin-note', ''); note('stb-anfrage-note', '');
    if (isAnfrage) $('stb-anfrage-email').focus(); else $('pin-input').focus();
  }
  function onStbAnfrageSubmit(e) {
    e.preventDefault();
    var email = $('stb-anfrage-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return note('stb-anfrage-note', 'Bitte eine gültige E-Mail-Adresse eingeben.', 'crit');
    window.location.href = stbMailtoHref(email);
    note('stb-anfrage-note', 'Mail-Programm wird geöffnet …', 'ok');
  }
  function toggleStbGateMode() {
    gateStbMode = !gateStbMode;
    var input = $('pin-input');
    input.value = ''; renderDots(); note('pin-note', ''); note('stb-anfrage-note', '');
    $('stb-gate-toggle').textContent = gateStbMode ? '← Zurück zum normalen Login' : 'Ich bin Steuerberater/-in →';
    $('stb-subtabs').classList.toggle('hidden', !gateStbMode);
    if (gateStbMode) {
      $('gate-title').textContent = 'Steuerberater-Zugang';
      gateHint('Mit vorhandener PIN einloggen — oder unter „Anfrage" einen Zugang anfordern.', false);
      setStbSubtab('login');
    } else {
      $('gate-title').textContent = 'Entsperren';
      $('pin-form').classList.remove('hidden');
      $('stb-anfrage-form').classList.add('hidden');
      gatePruefen(S.dokuRawGeladen, input);
    }
    input.focus();
  }
  function gateInit() {
    $('gate-version').textContent = 'Version ' + APP_VERSION + ' · offline verfügbar';
    buildKeypad();
    var input = $('pin-input');
    input.addEventListener('input', function () { input.value = input.value.replace(/\D/g, '').slice(0, 6); renderDots(); });
    input.addEventListener('focus', function () { $('pin-dots').classList.add('is-focus'); });
    $('pin-form').addEventListener('submit', onPinSubmit);
    document.querySelector('[data-action="demo"]').addEventListener('click', startDemo);
    $('stb-gate-toggle').addEventListener('click', toggleStbGateMode);
    $('stb-gate-toggle-2').addEventListener('click', toggleStbGateMode);
    $('stb-subtabs').querySelectorAll('[data-stbtab]').forEach(function (b) {
      b.addEventListener('click', function () { setStbSubtab(b.getAttribute('data-stbtab')); });
    });
    $('stb-anfrage-form').addEventListener('submit', onStbAnfrageSubmit);
    $('stb-logout').addEventListener('click', closeSteuerberaterView);
    renderDots();
    if (!window.crypto || !window.crypto.subtle) return gateHint('Verschlüsselung wird von diesem Browser nicht unterstützt. Bitte einen aktuellen Browser über HTTPS verwenden.', true);
    gateHint('Speicherstand wird geprüft …', true);
    ladeDokuRaw().then(function (raw) { gatePruefen(raw, input); });
  }
  function gatePruefen(raw, input) {
    S.dokuRawGeladen = raw;
    if (!raw) return gateHint('In AERIS Dokumentation sind noch keine Daten vorhanden. Erfasse dort zuerst Schichten — oder sieh dir die Demo an.', true);
    if (!parseEnvelope(raw)) return gateHint('Datenformat der AERIS Dokumentation nicht lesbar. Bitte AERIS Doku einmal normal öffnen.', true);
    gateHint('Bitte dieselbe PIN wie in AERIS Dokumentation eingeben.', false);
    input.focus();
  }
  function gateHint(text, disable) {
    $('gate-hint').textContent = text;
    $('pin-submit').disabled = !!disable;
    $('keypad').querySelectorAll('button').forEach(function (b) { b.disabled = !!disable; });
  }
  function buildKeypad() {
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
    mount('keypad', keys.map(function (k) {
      var label = k === 'del' ? '⌫' : k === 'ok' ? '→' : k;
      var aria = k === 'del' ? 'Letzte Ziffer löschen' : k === 'ok' ? 'Entsperren' : 'Ziffer ' + k;
      return h('button', { type: k === 'ok' ? 'submit' : 'button', class: 'btn key', 'aria-label': aria, 'data-key': k, onclick: onKey, text: label });
    }));
  }
  function onKey(e) {
    var k = e.currentTarget.getAttribute('data-key'), input = $('pin-input');
    if (k === 'ok') return;
    if (k === 'del') input.value = input.value.slice(0, -1);
    else if (input.value.length < 6) input.value += k;
    renderDots();
  }
  function renderDots() {
    var len = $('pin-input').value.length;
    mount('pin-dots', [0, 1, 2, 3, 4, 5].map(function (i) {
      return h('span', { class: 'pin-dot' + (i < len ? ' is-filled' : '') + (i >= 4 && i >= len ? ' is-off' : '') });
    }));
  }
  function gateFail(msg) {
    note('pin-note', msg, 'crit');
    var card = document.querySelector('.gate-card');
    card.classList.remove('gate-shake'); void card.offsetWidth; card.classList.add('gate-shake');
    $('pin-input').value = ''; renderDots();
    $('pin-submit').disabled = false;
    $('pin-input').focus();
  }
  // Gemeinsame PIN-Fehlversuchssperre mit AERIS Doku: nach 5 Fehlversuchen 15 Minuten gesperrt.
  var PIN_SPERRE_KEY = 'aeris-pin-sperre', PIN_MAX = 5, PIN_SPERRE_MS = 15 * 60 * 1000;
  function pinSperre() { try { return JSON.parse(localStorage.getItem(PIN_SPERRE_KEY)) || { fehl: 0, bis: 0 }; } catch (e) { return { fehl: 0, bis: 0 }; } }
  function pinSperreSetzen(s) { try { localStorage.setItem(PIN_SPERRE_KEY, JSON.stringify(s)); } catch (e) { return; } }
  function pinSperrText(bis) { return 'Zu viele falsche PIN-Eingaben — gesperrt bis ' + new Date(bis).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr.'; }
  function onPinSubmit(e) {
    e.preventDefault();
    var pin = $('pin-input').value.trim();
    if (gateStbMode) {
      if (!/^\d{6}$/.test(pin)) return gateFail('Steuerberater-PIN besteht aus genau 6 Ziffern.');
      if (pinSperre().bis > Date.now()) return gateFail(pinSperrText(pinSperre().bis));
      $('pin-submit').disabled = true;
      note('pin-note', 'Entschlüssele …');
      return trySteuerberaterPin(pin);
    }
    if (!/^\d{4,6}$/.test(pin)) return gateFail('Bitte eine PIN aus 4–6 Ziffern eingeben.');
    if (pinSperre().bis > Date.now()) return gateFail(pinSperrText(pinSperre().bis));
    $('pin-submit').disabled = true;
    note('pin-note', 'Entschlüssele …');
    if (gateMode === 'fin-old') return onOldPin(pin);
    var env = parseEnvelope(S.dokuRawGeladen);
    if (!env) return gateFail('Daten der AERIS Dokumentation nicht mehr lesbar.');
    deriveKey(pin, env.salt, env.iterations).then(function (key) {
      S.dokuKey = key; S.dokuSalt = env.salt;
      return decryptJson(key, env.iv, env.ct);
    }).then(function (data) {
      S.doku = sanitizeDoku(data);
      pinSperreSetzen({ fehl: 0, bis: 0 });
      S.dokuRaw = S.dokuRawGeladen || ''; S.syncedAt = Date.now(); S.dokuKeyPin = pin;
      return setupFinStore(pin).then(function (state) {
        if (state === 'ok') return openApp();
        S.dokuKeyPin = pin; gateMode = 'fin-old';
        $('pin-input').value = ''; renderDots(); $('pin-submit').disabled = false;
        note('pin-note', '');
        $('gate-hint').textContent = 'Deine PIN wurde in AERIS Doku geändert. Bitte einmalig die FRÜHERE PIN eingeben, damit Belege und Zahlungseingänge auf die neue PIN umgeschlüsselt werden.';
      });
    }).catch(function () { trySteuerberaterPin(pin); });
  }
  function gateFailCounted() {
    var s = pinSperre();
    s.fehl = (s.fehl || 0) + 1;
    if (s.fehl >= PIN_MAX) { s.bis = Date.now() + PIN_SPERRE_MS; s.fehl = 0; }
    pinSperreSetzen(s);
    gateFail(s.bis > Date.now() ? pinSperrText(s.bis) : 'Falsche PIN — noch ' + (PIN_MAX - s.fehl) + ' Versuch(e), danach 15 Minuten Sperre.');
  }
  // Fällt die normale Entsperrung durch, zusätzlich gegen einen evtl. eingerichteten
  // Steuerberater-Zugang prüfen (eigene PIN, eigenes Salt, entschlüsselt NUR die vom
  // Inhaber zuletzt erzeugte Momentaufnahme — nie die Live-Daten). Erst wenn auch das
  // fehlschlägt, zählt der Versuch als Fehlversuch für die gemeinsame Sperre.
  function trySteuerberaterPin(pin) {
    var raw = readStorage(KEY_STB);
    if (!raw) return gateFailCounted();
    var env;
    try { env = JSON.parse(raw); } catch (e) { return gateFailCounted(); }
    if (!isObj(env) || !env.salt || !env.iv || !env.ct) return gateFailCounted();
    deriveKey(pin, env.salt, env.iterations).then(function (key) {
      return decryptJson(key, env.iv, env.ct);
    }).then(function (snap) {
      openSteuerberaterView(snap);
    }).catch(gateFailCounted);
  }
  function openSteuerberaterView(snap) {
    note('pin-note', '');
    $('gate').classList.add('hidden');
    $('stb-view').classList.remove('hidden');
    $('stb-frame').srcdoc = steuerberaterBerichtAus(snap);
    $('pin-input').value = ''; renderDots(); $('pin-submit').disabled = false;
  }
  function closeSteuerberaterView() {
    $('stb-frame').srcdoc = '';
    $('stb-view').classList.add('hidden');
    $('gate').classList.remove('hidden');
    if (gateStbMode) toggleStbGateMode();
    $('pin-input').focus();
  }
  function onOldPin(pin) {
    rekeyFromOldPin(pin).then(openApp).catch(function () { gateFail('Diese frühere PIN passt nicht zu den gespeicherten Finanzdaten.'); });
  }
  function openApp() {
    note('pin-note', '');
    $('gate').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('demo-pill').classList.toggle('hidden', !S.demo);
    S.ym = currentYm();
    var fromHash = location.hash.replace('#', '');
    initApp();
    selectTab(document.querySelector('[data-tab="' + fromHash + '"]') ? fromHash : 'cockpit', false);
    resetLockTimer();
  }

  // =====================================================================================
  // Demo-Daten (deterministisch, nur im Arbeitsspeicher — wird nie gespeichert)
  // =====================================================================================
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function demoMonat(doku, fin, ym, rand) {
    var tage = new Date(parseInt(ym.slice(0, 4), 10), parseInt(ym.slice(5, 7), 10), 0).getDate();
    var bis = ym === currentYm() ? parseInt(todayIso().slice(8, 10), 10) : tage;
    for (var d = 1; d <= bis; d++) {
      if (rand() < 0.3) continue;
      var iso = ym + '-' + pad2(d), nacht = rand() < 0.35;
      doku.tage[iso] = { von: nacht ? '19:00' : '07:00', bis: nacht ? '07:00' : '19:00', pfk: 'RK' };
      doku.entries.push({ type: 'massnahme', datum: iso, uhrzeit: nacht ? '20:10' : '08:15', cat: 'sgb5', label: 'Beatmung/Respiratormanagement' });
      doku.entries.push({ type: 'fahrt', datum: iso, uhrzeit: nacht ? '18:20' : '06:20', von: 'Dautphetal', nach: 'Klient (Biedenkopf)', km: String(Math.round(18 + rand() * 24)), zweck: 'Fahrt zur Schicht', sparte: rand() < 0.15 ? 'beratung' : 'pflege' });
    }
    if (rand() < 0.5) doku.entries.push({ type: 'privat', datum: ym + '-' + pad2(Math.min(bis, 3 + Math.floor(rand() * 20))), uhrzeit: '10:00', art: 'aufnahme', betrag: '165' });
    demoBelege(fin, ym, bis, rand);
  }
  function demoBelege(fin, ym, bis, rand) {
    var add = function (tag, kat, cent, text) { fin.belege.push({ id: uid(), datum: ym + '-' + pad2(Math.min(bis, tag)), kat: kat, betragCent: cent, text: text, belegnr: '', zahlart: 'bank', createdAt: Date.now() }); };
    add(2, 'telefon', 3999, 'Mobilfunk & Internet');
    add(5, 'versicherung', 8930, 'Berufshaftpflicht (monatlich)');
    if (rand() < 0.35) add(12, 'fortbildung', 18900, 'Fortbildung Atemwegsmanagement');
    if (rand() < 0.4) add(18, 'arbeitsmittel', Math.round(2000 + rand() * 6000), 'Schutzausrüstung & Verbrauchsmaterial');
    if (rand() < 0.25) add(22, 'fachliteratur', 4590, 'Fachzeitschrift Intensivpflege');
  }
  function demoDaten() {
    var rand = rng(20261002), doku = { entries: [], tage: {}, settings: { satzPflege: 105 }, rechnungsnummern: { budget: {}, privat: {} }, rechnungen: { budget: {}, privat: {} } };
    var fin = finDefault(), cur = currentYm(), y = cur.slice(0, 4), nr = 0;
    fin.settings.gmbh = { grundgehaltCent: 1054000, bavCent: 100000, firmenwagenCent: 100000, ladestromCent: 6000, hebesatz: 340, startYm: y + '-01', rentenzielCent: 600000, renteneintrittJahr: parseInt(y, 10) + 17 };
    for (var ym = y + '-01'; ym <= cur; ym = ymShift(ym, 1)) demoMonat(doku, fin, ym, rand);
    S.doku = sanitizeDoku(doku); S.fin = fin;
    for (var m = y + '-01'; m < cur; m = ymShift(m, 1)) {
      nr += 1;
      var bz = budgetZahlen(S.doku, m);
      S.doku.rechnungen.budget[m] = { nr: 'RE-' + y + '-PFLEGE-' + nr, datum: ymShift(m, 1) + '-02', empfaenger: 'Demo-Pflegekasse', werte: { std: bz.std, nachtStd: bz.nachtStd, zStd: bz.zStd, satz: bz.satz, raw: bz.raw, zuschlaege: bz.zuschlaege, summe: bz.summe } };
      if (m < ymShift(cur, -1)) {
        fin.zahlungen['budget:' + m] = { bezahltAm: ymShift(m, 1) + '-' + pad2(12 + Math.floor(rand() * 8)), betragCent: toCent(budgetZahlen(S.doku, m).summe) };
        var p = privatZahlen(S.doku, m).summe;
        if (p > 0) fin.zahlungen['privat:' + m] = { bezahltAm: ymShift(m, 1) + '-05', betragCent: toCent(p) };
      }
    }
  }
  function startDemo() {
    S.demo = true;
    demoDaten();
    openApp();
    toast('Demo-Modus: Beispieldaten, nichts wird gespeichert.');
  }

  // =====================================================================================
  // Navigation
  // =====================================================================================
  var appInitialized = false;
  function initApp() {
    if (appInitialized) return renderAll();
    appInitialized = true;
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { selectTab(t.getAttribute('data-tab'), true); });
      t.addEventListener('keydown', function (e) { onTabKey(e, tabs); });
    });
    document.addEventListener('click', onAction);
    $('beleg-form').addEventListener('submit', onBelegSubmit);
    $('beleg-form').kat.addEventListener('change', renderKontoHint);
    $('restore-file').addEventListener('change', onRestoreFile);
    initSettings();
    $('version-info').textContent = 'AERIS Buch ' + APP_VERSION;
    $('foot-version').textContent = 'PWA v' + APP_VERSION + ' · Daten verschlüsselt & lokal';
    renderAll();
  }
  function onTabKey(e, tabs) {
    var i = tabs.indexOf(e.currentTarget), next = null;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    e.preventDefault();
    selectTab(next.getAttribute('data-tab'), false);
    next.focus();
  }
  function selectTab(name, focusPanel) {
    S.tab = name;
    document.querySelectorAll('[role="tab"]').forEach(function (t) {
      var on = t.getAttribute('data-tab') === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    document.querySelectorAll('[role="tabpanel"]').forEach(function (p) { p.classList.toggle('is-active', p.id === 'panel-' + name); });
    if (history.replaceState) history.replaceState(null, '', '#' + name);
    if (focusPanel) $('panel-' + name).focus({ preventScroll: true });
  }
  var ACTIONS = {
    'month-prev': function () { setMonth(ymShift(S.ym, -1)); },
    'month-next': function () { setMonth(ymShift(S.ym, 1)); },
    'month-today': function () { setMonth(currentYm()); },
    'beleg-neu': function () { openBelegDialog(null); },
    'dialog-close': function () { $('beleg-dialog').close(); },
    'lock': lockApp,
    'backup': downloadBackup,
    'restore': function () { if (S.demo) return toast('Im Demo-Modus nicht verfügbar.'); $('restore-file').click(); },
    'update-now': hardUpdate,
    'update-later': function () { $('update-banner').classList.remove('is-on'); }
  };
  function onAction(e) {
    var el = e.target.closest('[data-action],[data-goto],[data-tab-link]');
    if (!el) return;
    if (el.hasAttribute('data-goto')) { e.preventDefault(); return selectTab(el.getAttribute('data-goto'), true); }
    if (el.hasAttribute('data-tab-link')) { e.preventDefault(); return selectTab(el.getAttribute('data-tab-link'), true); }
    var fn = ACTIONS[el.getAttribute('data-action')];
    if (fn) fn(e);
  }
  function setMonth(ym) { if (isYm(ym)) { S.ym = ym; renderAll(); } }
  function lockApp() {
    S.key = null; S.fin = null; S.doku = null; S.dokuKey = null;
    location.replace(location.pathname);
  }
  function resetLockTimer() {
    clearTimeout(lockTimer);
    lockTimer = setTimeout(lockApp, AUTO_LOCK_MS);
  }

  // =====================================================================================
  // Rendering
  // =====================================================================================
  function renderAll() {
    var m = monat(S.ym);
    $('month-label').textContent = ymLabel(S.ym);
    $('print-month').textContent = ymLabel(S.ym);
    $('source-hint').textContent = S.demo ? 'Quelle: Demo-Beispieldaten' : '● Live mit AERIS Doku verbunden · Stand ' + new Date(S.syncedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' · ' + S.doku.entries.length + ' Einträge, ' + Object.keys(S.doku.tage).length + ' Schichttage';
    renderCockpit(m);
    renderEinnahmen(m);
    renderAusgaben(m);
    renderSteuer();
    renderGmbhTab();
    renderBerichte(m);
    bindTilt();
  }

  // ---------------- GmbH-Ebene: Ansicht ----------------
  function renderGmbhTab() {
    var g = S.fin.settings.gmbh;
    if (!g.startYm) {
      mount('gmbh-kpis', null);
      mount('gmbh-rentenziel', null);
      return mount('t-gmbh-monate', h('div', { class: 'nm', style: 'padding:1.2rem;' }, [
        h('p', { class: 'small', text: 'Noch kein GmbH-Start hinterlegt — die GF-Vergütung (Grundgehalt/bAV/Firmenwagen) wird erst ab diesem Monat angesetzt.' }),
        h('button', { type: 'button', class: 'btn btn-sm btn-copper', 'data-goto': 'einstellungen', text: 'In Einstellungen festlegen' })
      ]));
    }
    var mo = monatGmbh(S.ym), seit = gmbhSeitStart(), ziel = gmbhRentenziel();
    mount('gmbh-kpis', [
      kpi({ icon: 'i-wallet', label: 'EBT ' + ymLabel(S.ym), value: fmtEuro(mo.ebt), foot: 'Einnahmen − Ausgaben − GF-Vergütung (' + fmtEuro(mo.fix) + ')' }),
      kpi({ icon: 'i-tax', label: 'GmbH-Ertragsteuern', value: fmtEuro(mo.steuer), foot: fmtNum(mo.steuersatz, 3) + ' % · KSt 15 % + SolZ 0,825 % + GewSt (Hebesatz ' + g.hebesatz + ' %)' }),
      kpi({ icon: 'i-in', label: 'Netto-Eigenkapitalbildung', value: fmtEuro(mo.eigenkapital), color: mo.eigenkapital < 0 ? 'var(--crit)' : null, foot: ymLabel(S.ym) }),
      kpi({ icon: 'i-shield', label: 'Kumuliert seit GmbH-Start', value: fmtEuro(seit.eigenkapital), foot: seit.monate + ' Monat(e) seit ' + ymLabel(g.startYm) })
    ]);
    if (ziel) {
      var pct = ziel.kapitalbedarf > 0 ? Math.max(0, Math.min(100, ziel.bisher / ziel.kapitalbedarf * 100)) : 0;
      mount('gmbh-rentenziel', h('div', { class: 'nm', style: 'padding:1.2rem;' }, [
        h('div', { class: 'small', style: 'font-weight:700;margin-bottom:.5rem;', text: 'Rentenziel-Fortschritt (echte Daten, kein Plan)' }),
        h('div', { class: 'kpi-bar', 'aria-hidden': 'true', style: 'margin-bottom:.5rem;' }, h('i', { style: 'width:' + pct + '%' })),
        h('p', { class: 'small muted', text: fmtEuro(ziel.bisher) + ' von ' + fmtEuro(ziel.kapitalbedarf) + ' Kapitalbedarf angespart (' + fmtNum(pct, 1) + ' %)' }),
        h('p', { class: 'small', text: 'Ø ' + fmtEuro(ziel.rate) + '/Monat bisher · ' + ziel.monateBisRente + ' Monate bis Renteneintritt · Prognose bei gleichem Tempo: ' + fmtEuro(ziel.prognose) }),
        h('p', { class: 'small', style: 'font-weight:700;color:' + (ziel.aufKurs ? '#7fb98a' : 'var(--crit)'), text: ziel.aufKurs ? '✓ Auf Kurs für das Rentenziel' : '✗ Beim aktuellen Tempo wird das Rentenziel verfehlt' })
      ]));
    } else {
      mount('gmbh-rentenziel', h('p', { class: 'small muted', text: 'Rentenziel (Zielrente/Monat, Renteneintrittsjahr) noch nicht in den Einstellungen hinterlegt.' }));
    }
    var rows = seit.list.slice(-12).reverse().map(function (r) {
      return [ymLabel(r.ym), { v: fmtEuro(r.basis.einnahmen), r: true }, { v: fmtEuro(r2(r.basis.ausgaben + r.fix)), r: true }, { v: fmtEuro(r.ebt), r: true }, { v: fmtEuro(r.steuer), r: true }, { v: fmtEuro(r.eigenkapital), r: true }];
    });
    if (!rows.length) rows.push([{ v: emptyState('Noch keine Monate', 'Ab dem GmbH-Start erscheinen hier echte Monatswerte.'), span: 6 }]);
    mount('t-gmbh-monate', table(
      [{ t: 'Monat' }, { t: 'Einnahmen', r: true }, { t: 'Ausgaben inkl. GF-Vergütung', r: true }, { t: 'EBT', r: true }, { t: 'Steuer', r: true }, { t: 'Eigenkapitalbildung', r: true }],
      rows, seit.list.length ? ['Letzte ' + Math.min(12, seit.list.length) + ' Monate', '', '', '', '', { v: fmtEuro(seit.eigenkapital) + ' gesamt seit Start', r: true }] : null
    ));
  }

  // ---------------- Cockpit ----------------
  function kpi(opts) {
    return h('article', { class: 'nm kpi tilt', 'data-tilt': '' }, [
      h('div', { class: 'kpi-label' }, [h('span', { class: 'kpi-orb' }, icon(opts.icon, '')), opts.label]),
      h('div', { class: 'kpi-value', style: opts.color ? 'color:' + opts.color : null, text: opts.value }),
      h('div', { class: 'kpi-foot' }, opts.foot),
      opts.bar !== undefined ? h('div', { class: 'kpi-bar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + Math.max(0, Math.min(100, opts.bar)) + '%' })) : null
    ]);
  }
  function delta(cur, prev, invert) {
    if (!prev) return h('span', { class: 'muted', text: 'kein Vormonatswert' });
    var p = (cur - prev) / Math.abs(prev) * 100, up = p >= 0, good = invert ? !up : up;
    return h('span', { class: 'delta', 'data-tone': good ? 'up' : 'down' }, [(up ? '▲ ' : '▼ ') + fmtNum(Math.abs(p), 1) + ' %', h('span', { class: 'muted', text: ' ggü. Vormonat' })]);
  }
  function renderCockpit(m) {
    var prev = monat(ymShift(S.ym, -1)), offen = offeneForderungen();
    var offenSumme = offen.reduce(function (a, o) { return a + o.betrag; }, 0);
    var maxIn = Math.max(m.einnahmen, m.ausgaben, 1);
    mount('kpis', [
      kpi({ icon: 'i-in', label: 'Einnahmen', value: fmtEuro(m.einnahmen), foot: [delta(m.einnahmen, prev.einnahmen, false), h('br'), fmtNum(m.budget.std, 2) + ' Pflegestunden'], bar: m.einnahmen / maxIn * 100 }),
      kpi({ icon: 'i-out', label: 'Ausgaben', value: fmtEuro(m.ausgaben), foot: [delta(m.ausgaben, prev.ausgaben, true), h('br'), m.belege.length + ' Belege · ' + fmtNum(m.fahrt.km, 0) + ' km'], bar: m.ausgaben / maxIn * 100 }),
      kpi({ icon: 'i-wallet', label: 'Ergebnis', value: fmtEuro(m.ergebnis), color: m.ergebnis < 0 ? 'var(--crit)' : null, foot: 'Einnahmen − Ausgaben im Leistungsmonat' }),
      kpi({ icon: 'i-clock', label: 'Offene Forderungen', value: fmtEuro(offenSumme), foot: offen.length ? offen.length + ' Rechnung(en) ohne Zahlungseingang' : 'Alle Rechnungen bezahlt' })
    ]);
    renderYearChart(S.ym.slice(0, 4));
    renderGauge(m);
    renderMix(m);
    renderTodo(m, offen);
    renderDeadlines('deadlines-mini', 2);
  }
  function renderYearChart(year) {
    var data = jahr(year);
    $('chart-year-sub').textContent = 'Einnahmen und Ausgaben je Leistungsmonat ' + year + ' · Monat anklicken zum Öffnen';
    var host = mount('chart-year', null);
    host.appendChild(buildBarChart(data));
    host.appendChild(h('div', { class: 'tooltip', id: 'chart-tip', role: 'presentation' }));
    host.appendChild(h('details', { class: 'data-table' }, [h('summary', { text: 'Als Tabelle anzeigen' }),
      h('div', { class: 'table-wrap' }, h('table', { class: 't' }, table(
        [{ t: 'Monat' }, { t: 'Einnahmen', r: true }, { t: 'Ausgaben', r: true }, { t: 'Ergebnis', r: true }],
        data.map(function (d, i) { return [MONATE[i], { v: fmtEuro(d.einnahmen), r: true }, { v: fmtEuro(d.ausgaben), r: true }, { v: fmtEuro(d.ergebnis), r: true }]; })
      )))]));
  }
  function niceMax(v) {
    if (v <= 0) return 1000;
    var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function bar3d(x, y, w, hgt, color, depth) {
    var g = s('g', null);
    if (hgt <= 0) return g;
    g.appendChild(s('polygon', { points: [x + w, y, x + w + depth, y - depth * 0.8, x + w + depth, y + hgt - depth * 0.8, x + w, y + hgt].join(' '), fill: color }));
    g.appendChild(s('polygon', { points: [x + w, y, x + w + depth, y - depth * 0.8, x + w + depth, y + hgt - depth * 0.8, x + w, y + hgt].join(' '), fill: '#000', 'fill-opacity': '0.35' }));
    g.appendChild(s('rect', { x: x, y: y, width: w, height: hgt, fill: color }));
    g.appendChild(s('rect', { x: x, y: y, width: w * 0.35, height: hgt, fill: '#fff', 'fill-opacity': '0.10' }));
    g.appendChild(s('polygon', { points: [x, y, x + depth, y - depth * 0.8, x + w + depth, y - depth * 0.8, x + w, y].join(' '), fill: color }));
    g.appendChild(s('polygon', { points: [x, y, x + depth, y - depth * 0.8, x + w + depth, y - depth * 0.8, x + w, y].join(' '), fill: '#fff', 'fill-opacity': '0.28' }));
    return g;
  }
  function buildBarChart(data) {
    var W = 680, H = 270, pl = 58, pr = 14, pt = 18, pb = 30, ih = H - pt - pb, gw = (W - pl - pr) / 12;
    var max = niceMax(Math.max.apply(null, data.map(function (d) { return Math.max(d.einnahmen, d.ausgaben); })));
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Säulendiagramm Einnahmen und Ausgaben je Monat. Werte in der Tabelle darunter.' });
    var axis = s('g', { class: 'axis' });
    for (var t = 0; t <= 4; t++) {
      var yy = pt + ih - ih * t / 4;
      axis.appendChild(s('line', { class: 'grid-line', x1: pl, x2: W - pr, y1: yy, y2: yy }));
      axis.appendChild(s('text', { x: pl - 8, y: yy + 4, 'text-anchor': 'end' }, fmtCompact(max * t / 4)));
    }
    svg.appendChild(axis);
    data.forEach(function (d, i) { svg.appendChild(buildColumn(d, i, { pl: pl, pt: pt, ih: ih, gw: gw, max: max, H: H })); });
    return svg;
  }
  function buildColumn(d, i, g) {
    var bw = Math.min(16, g.gw * 0.3), x0 = g.pl + i * g.gw + (g.gw - bw * 2 - 2) / 2 - 2;
    var hIn = d.einnahmen / g.max * g.ih, hOut = d.ausgaben / g.max * g.ih, base = g.pt + g.ih, sel = d.ym === S.ym;
    var col = s('g', { class: 'col', style: 'animation-delay:' + (i * 40) + 'ms' });
    if (sel) col.appendChild(s('rect', { x: g.pl + i * g.gw + 2, y: g.pt - 6, width: g.gw - 4, height: g.ih + 6, rx: 10, fill: 'rgba(232,195,158,0.07)', stroke: 'rgba(232,195,158,0.35)' }));
    col.appendChild(bar3d(x0, base - hIn, bw, hIn, '#C77B3F', 5));
    col.appendChild(bar3d(x0 + bw + 2, base - hOut, bw, hOut, '#5E8FD6', 5));
    col.appendChild(s('text', { x: g.pl + i * g.gw + g.gw / 2, y: g.H - 10, 'text-anchor': 'middle', class: 'axis', fill: sel ? '#E8C39E' : '#A3B2CA', 'font-size': '11', 'font-weight': sel ? '700' : '400' }, MONATE_KURZ[i]));
    var hit = s('rect', { class: 'hit', x: g.pl + i * g.gw, y: g.pt - 6, width: g.gw, height: g.ih + 30 });
    hit.addEventListener('pointerenter', function (e) { showTip(e, d, i); });
    hit.addEventListener('pointermove', function (e) { showTip(e, d, i); });
    hit.addEventListener('pointerleave', hideTip);
    hit.addEventListener('click', function () { setMonth(d.ym); });
    col.appendChild(hit);
    return col;
  }
  function showTip(e, d, i) {
    var tip = $('chart-tip'), host = $('chart-year'), r = host.getBoundingClientRect();
    tip.replaceChildren(h('b', { text: MONATE[i] + ' ' + d.ym.slice(0, 4) }),
      tipRow('#C77B3F', 'Einnahmen', fmtEuro(d.einnahmen)), tipRow('#5E8FD6', 'Ausgaben', fmtEuro(d.ausgaben)), tipRow(null, 'Ergebnis', fmtEuro(d.ergebnis)));
    var x = e.clientX - r.left + 14, y = e.clientY - r.top - 20;
    tip.style.left = Math.min(x, r.width - 190) + 'px';
    tip.style.top = Math.max(0, y) + 'px';
    tip.classList.add('is-on');
    host.querySelectorAll('.col').forEach(function (c, idx) { c.classList.toggle('is-dim', idx !== i); });
  }
  function tipRow(color, label, val) {
    return h('div', { class: 'row' }, [h('span', null, [color ? h('i', { style: 'background:' + color }) : null, label]), h('span', { class: 'num', text: val })]);
  }
  function hideTip() {
    $('chart-tip').classList.remove('is-on');
    $('chart-year').querySelectorAll('.col').forEach(function (c) { c.classList.remove('is-dim'); });
  }
  function renderGauge(m) {
    var marge = m.einnahmen > 0 ? m.ergebnis / m.einnahmen : 0, pct = Math.max(-1, Math.min(1, marge));
    var R = 78, C = 2 * Math.PI * R, len = Math.abs(pct) * C * 0.75, neg = pct < 0;
    var svg = s('svg', { viewBox: '0 0 200 200', role: 'img', 'aria-label': 'Ergebnis-Marge ' + fmtNum(marge * 100, 1) + ' Prozent' }, [
      s('defs', null, s('linearGradient', { id: 'gaugeGrad', x1: '0', y1: '0', x2: '1', y2: '1' }, [s('stop', { offset: '0', 'stop-color': '#E8C39E' }), s('stop', { offset: '0.55', 'stop-color': '#B87333' }), s('stop', { offset: '1', 'stop-color': '#6B4423' })])),
      s('circle', { cx: 100, cy: 100, r: 96, fill: '#1E293B', class: 'gauge-dish' }),
      s('circle', { cx: 100, cy: 100, r: R, fill: 'none', stroke: '#141C29', 'stroke-width': 16, 'stroke-dasharray': (C * 0.75) + ' ' + C, transform: 'rotate(135 100 100)', 'stroke-linecap': 'round' }),
      s('circle', { cx: 100, cy: 100, r: R, fill: 'none', stroke: neg ? '#FF8A80' : 'url(#gaugeGrad)', 'stroke-width': 12, 'stroke-dasharray': len + ' ' + C, transform: 'rotate(135 100 100)', 'stroke-linecap': 'round', class: 'gauge-arc', style: '--len:' + len })
    ]);
    mount('gauge', [svg, h('div', { class: 'gauge-center' }, h('div', null, [
      h('div', { class: 'gauge-value', text: (m.einnahmen > 0 ? fmtNum(marge * 100, 1) : '—') + ' %' }),
      h('div', { class: 'xs muted', text: neg ? 'Verlust im Monat' : 'vom Umsatz bleibt' })
    ]))]);
  }
  function renderMix(m) {
    var parts = [
      { label: 'Pflege-Basis', v: m.budget.basis, c: 'var(--data-1)' },
      { label: 'Zuschläge', v: m.budget.zuschlaege, c: 'var(--data-2)' },
      { label: 'Privatleistungen', v: m.privat.summe, c: 'var(--data-3)' }
    ], total = m.einnahmen;
    if (!total) return mount('mix', h('p', { class: 'small muted', text: 'Noch keine Einnahmen in diesem Monat.' }));
    mount('mix', [
      h('div', { class: 'small', style: 'font-weight:700;margin-bottom:.4rem;', text: 'Erlös-Mix' }),
      h('div', { class: 'stack nm-inset', role: 'img', 'aria-label': parts.map(function (p) { return p.label + ' ' + fmtNum(p.v / total * 100, 0) + ' %'; }).join(', ') },
        parts.filter(function (p) { return p.v > 0; }).map(function (p) { return h('span', { style: 'flex-grow:' + p.v + ';background:' + p.c }); })),
      h('ul', { class: 'mix-list' }, parts.map(function (p) {
        return h('li', null, [h('i', { style: 'background:' + p.c }), p.label, h('span', { class: 'num muted', text: fmtNum(p.v / total * 100, 0) + ' %' }), h('span', { class: 'num', text: fmtEuro(p.v) })]);
      }))
    ]);
  }
  function todoItem(tone, title, text, goto) {
    return h('li', { class: 'nm nm-sm item' }, [
      chip(tone, tone === 'ok' ? 'Erledigt' : tone === 'warn' ? 'Prüfen' : 'Hinweis'),
      h('div', { class: 'item-main' }, [h('div', { class: 'item-title', text: title }), h('div', { class: 'item-meta', text: text })]),
      goto ? h('button', { type: 'button', class: 'btn btn-sm', 'data-goto': goto, text: 'Öffnen' }) : h('span')
    ]);
  }
  function renderTodo(m, offen) {
    var items = [], tage = tageImMonat(S.doku, S.ym);
    var ohneZeit = entriesIn(S.doku, 'massnahme', S.ym).filter(function (e) { return !S.doku.tage[e.datum] || !shiftDauer(S.doku.tage[e.datum]); });
    var tageOhne = Object.keys(ohneZeit.reduce(function (a, e) { a[e.datum] = 1; return a; }, {})).length;
    if (tageOhne) items.push(todoItem('warn', tageOhne + ' Tag(e) mit Maßnahmen ohne Schichtzeit', 'Ohne von/bis fehlen diese Stunden auf der Rechnung — in AERIS Doku ergänzen.', 'einnahmen'));
    if (m.budget.summe > 0 && !rechnungsnr('budget', S.ym) && S.ym < currentYm()) items.push(todoItem('warn', 'Rechnung noch nicht erstellt', 'In AERIS Doku unter Abrechnung → Rechnung „Rechnung erstellen“ tippen — erst dann sind Nummer, Datum und Beträge festgeschrieben.', null));
    offen.slice(0, 3).forEach(function (o) { items.push(todoItem('warn', 'Zahlungseingang ' + (o.art === 'budget' ? 'Budget' : 'Privat') + ' ' + ymLabel(o.ym), fmtEuro(o.betrag) + ' offen — bei Eingang „Bezahlt am“ setzen.', 'einnahmen')); });
    var fahrtLuecken = m.fahrt.list.filter(function (f) { return !(parseFloat(f.km) > 0) || !f.zweck; }).length;
    if (fahrtLuecken) items.push(todoItem('warn', fahrtLuecken + ' Fahrt(en) unvollständig', 'Km oder Zweck fehlen — für ein ordnungsgemäßes Fahrtenbuch ergänzen.', 'ausgaben'));
    if (!m.belege.length && tage.length) items.push(todoItem('info', 'Noch keine Belege im Monat', 'Rechnungen für Versicherung, Telefon oder Material erfassen.', 'ausgaben'));
    if (!items.length) items.push(todoItem('ok', 'Monat vollständig', 'Alle Daten liegen vor — Export unter „Berichte & Export“.', 'berichte'));
    mount('todo', items);
  }
  function renderDeadlines(id, n) {
    mount(id, steuertermine(n).map(function (t) {
      var d = tageBis(t.datum), tone = d <= 14 ? 'warn' : 'info';
      return h('li', { class: 'nm nm-sm deadline' }, [
        h('div', { class: 'deadline-date nm-inset' }, [h('b', { text: t.datum.slice(8, 10) }), h('span', { text: MONATE_KURZ[parseInt(t.datum.slice(5, 7), 10) - 1] })]),
        h('div', null, [h('div', { class: 'item-title', text: t.art + ' ' + t.quartal }), h('div', { class: 'item-meta', text: fmtDate(t.datum) + ' · Betrag laut Vorauszahlungsbescheid' })]),
        chip(tone, d === 0 ? 'heute' : 'in ' + d + ' Tagen')
      ]);
    }));
  }

  // ---------------- Einnahmen ----------------
  function kontoCell(k) { return h('span', { class: 'konto', text: skrLabel() + ' ' + kontoNr(k) }); }
  function renderEinnahmen(m) {
    var b = m.budget, rows = [[h('div', null, ['Pflegestunden Basis', h('div', { class: 'xs muted', text: fmtNum(b.std, 2) + ' Std. × ' + fmtEuro(b.satz) })]), kontoCell(KONTEN.basis), { v: fmtEuro(b.raw.basis), r: true }]];
    [['nacht', 'Nachtzuschlag (19–06 Uhr)', b.nachtStd], ['samstag', 'Samstagszuschlag', b.zStd.samstag], ['sonntag', 'Sonntagszuschlag', b.zStd.sonntag],
      ['feiertag', 'Feiertagszuschlag (Hessen)', b.zStd.feiertag], ['weihnachten', 'Weihnachtszuschlag (24.–26.12.)', b.zStd.weihnachten]].forEach(function (z) {
      if (b.raw[z[0]] > 0) rows.push([h('div', null, [z[1], h('div', { class: 'xs muted', text: fmtNum(z[2], 2) + ' Std. × ' + fmtNum(ZUSCHLAG[z[0]] * 100, 0) + ' %' })]), kontoCell(KONTEN.zuschlag), { v: fmtEuro(b.raw[z[0]]), r: true }]);
    });
    mount('t-budget', table([{ t: 'Position' }, { t: 'Konto' }, { t: 'Betrag', r: true }], rows, [{ v: 'Summe', span: 2 }, { v: fmtEuro(b.summe), r: true }]));
    var nr = rechnungsnr('budget', S.ym);
    $('re-budget-sub').textContent = (nr ? nr + ' · festgeschrieben' : 'Entwurf — Rechnung in AERIS Doku noch nicht erstellt') + ' · ' + ymLabel(S.ym);
    mount('re-budget-status', statusChip('budget', b.summe));
    renderPayment('pay-budget', 'budget', b.summe);
    renderPrivat(m);
    renderSchichten();
  }
  function statusChip(art, betrag) {
    if (!(betrag > 0)) return chip('info', 'Keine Leistung');
    var z = zahlung(art, S.ym);
    if (z) return chip('ok', 'Bezahlt ' + fmtDate(z.bezahltAm));
    return S.ym < currentYm() ? chip('warn', 'Offen') : chip('info', 'Monat läuft');
  }
  function renderPrivat(m) {
    var rows = m.privat.list.map(function (e) { return [fmtDate(e.datum), 'Aufnahme-/Anamnese-Pauschale', kontoCell(KONTEN.privat), { v: fmtEuro(parseFloat(e.betrag) || 0), r: true }]; });
    if (!rows.length) rows.push([{ v: emptyState('Keine Privatleistungen', 'In diesem Monat wurde keine Pauschale erfasst.'), span: 4 }]);
    mount('t-privat', table([{ t: 'Datum' }, { t: 'Leistung' }, { t: 'Konto' }, { t: 'Betrag', r: true }], rows, [{ v: 'Summe', span: 3 }, { v: fmtEuro(m.privat.summe), r: true }]));
    $('re-privat-sub').textContent = (rechnungsnr('privat', S.ym) || 'Aufnahme-/Anamnese-Pauschalen') + ' · ' + ymLabel(S.ym);
    mount('re-privat-status', statusChip('privat', m.privat.summe));
    renderPayment('pay-privat', 'privat', m.privat.summe);
  }
  function renderPayment(id, art, betrag) {
    if (!(betrag > 0)) return mount(id, null);
    var z = zahlung(art, S.ym);
    if (z) {
      return mount(id, h('div', { class: 'callout' }, [icon('i-check', ''), h('div', { style: 'flex:1' }, [h('strong', { text: 'Zahlungseingang ' + fmtDate(z.bezahltAm) + ': ' + fmtCent(z.betragCent) }),
        z.betragCent !== toCent(betrag) ? h('div', { class: 'xs', text: 'Abweichung zur Rechnung: ' + fmtCent(z.betragCent - toCent(betrag)) }) : null]),
        h('button', { type: 'button', class: 'btn btn-sm btn-ghost', text: 'Zurücksetzen', onclick: function () { delete S.fin.zahlungen[art + ':' + S.ym]; afterChange('Zahlungseingang entfernt.'); } })]));
    }
    var idD = id + '-d', idB = id + '-b', idN = id + '-n';
    mount(id, h('form', { class: 'nm-inset', style: 'padding:1rem;', novalidate: '', onsubmit: function (e) { e.preventDefault(); savePayment(art, idD, idB, idN); } }, [
      h('div', { class: 'small', style: 'font-weight:700;margin-bottom:.6rem;', text: 'Zahlungseingang erfassen' }),
      h('div', { class: 'form-grid' }, [
        h('label', { class: 'field' }, [h('span', { text: 'Bezahlt am' }), h('input', { class: 'input', type: 'date', id: idD, value: todayIso(), required: '' })]),
        h('label', { class: 'field' }, [h('span', { text: 'Betrag (€)' }), h('input', { class: 'input num', type: 'text', inputmode: 'decimal', id: idB, value: decimalDe(betrag), required: '' })])
      ]),
      h('button', { type: 'submit', class: 'btn btn-sm btn-copper', style: 'margin-top:.8rem;' }, [icon('i-check'), 'Als bezahlt markieren']),
      h('p', { class: 'form-note', id: idN, role: 'alert' })
    ]));
  }
  function savePayment(art, idD, idB, idN) {
    var datum = $(idD).value, cent = parseEuroToCent($(idB).value);
    if (!isIso(datum)) return note(idN, 'Bitte ein gültiges Datum wählen.', 'crit');
    if (cent === null) return note(idN, 'Bitte einen Betrag > 0 eingeben (z. B. 25.410,00).', 'crit');
    S.fin.zahlungen[art + ':' + S.ym] = { bezahltAm: datum, betragCent: cent };
    afterChange('Zahlungseingang gespeichert.');
  }
  function renderSchichten() {
    var fei = feiertagSet(parseInt(S.ym.slice(0, 4), 10));
    var rows = tageImMonat(S.doku, S.ym).map(function (iso) {
      var tag = S.doku.tage[iso], std = shiftStunden(tag, iso), typ = zuschlagTyp(iso, fei);
      var wd = WOCHENTAGE[new Date(iso + 'T00:00:00').getDay()];
      return [wd + ', ' + fmtDate(iso), shiftDauer(tag) ? tag.von + '–' + tag.bis : h('span', { class: 'muted', text: 'keine Zeiten' }),
        { v: fmtNum(std, 2), r: true }, { v: fmtNum(nachtMinuten(tag, iso) / 60, 2), r: true },
        typ ? h('span', { class: 'chip', 'data-tone': 'info', text: typ.charAt(0).toUpperCase() + typ.slice(1) }) : '—'];
    });
    if (!rows.length) rows.push([{ v: emptyState('Keine Schichten', 'Für diesen Monat sind in AERIS Doku keine Schichttage erfasst.'), span: 5 }]);
    var b = budgetZahlen(S.doku, S.ym);
    mount('t-schichten', table([{ t: 'Tag' }, { t: 'Schicht' }, { t: 'Std.', r: true }, { t: 'davon Nacht', r: true }, { t: 'Zuschlag' }], rows,
      [{ v: 'Summe', span: 2 }, { v: fmtNum(b.std, 2), r: true }, { v: fmtNum(b.nachtStd, 2), r: true }, '']));
  }

  // ---------------- Ausgaben ----------------
  function renderAusgaben(m) {
    $('belege-sub').textContent = m.belege.length + ' Beleg(e) · ' + fmtCent(centSum(m.belege)) + ' · Zahlungsdatum im ' + ymLabel(S.ym);
    var items = m.belege.map(function (b) {
      var k = KAT[b.kat];
      return h('li', { class: 'nm nm-sm item' }, [
        h('div', { class: 'item-ico' }, icon(k.icon, '')),
        h('div', { class: 'item-main' }, [h('div', { class: 'item-title', text: b.text }),
          h('div', { class: 'item-meta', text: fmtDate(b.datum) + ' · ' + k.label + ' · ' + skrLabel() + ' ' + kontoNr(k) + (b.belegnr ? ' · Nr. ' + b.belegnr : '') })]),
        h('div', null, [h('div', { class: 'item-amount', text: fmtCent(b.betragCent) }), h('div', { class: 'item-actions no-print' }, [
          b.datei ? h('a', { href: b.datei.dataUrl, download: b.datei.name, class: 'btn btn-sm btn-round btn-ghost', 'aria-label': 'Angehängte Datei öffnen: ' + b.datei.name }, icon('i-download')) : null,
          h('button', { type: 'button', class: 'btn btn-sm btn-round btn-ghost', 'aria-label': 'Beleg bearbeiten: ' + b.text, onclick: function () { openBelegDialog(b.id); } }, icon('i-edit')),
          h('button', { type: 'button', class: 'btn btn-sm btn-round btn-ghost btn-danger', 'aria-label': 'Beleg löschen: ' + b.text, onclick: function () { deleteBeleg(b.id); } }, icon('i-trash'))
        ])])
      ]);
    });
    if (!items.length) items.push(h('li', null, emptyState('Noch keine Belege', 'Tippe auf „Beleg erfassen“, um eine Rechnung mit Zahlungsdatum hinzuzufügen.')));
    mount('belege-liste', items);
    renderFahrten(m);
  }
  function renderFahrten(m) {
    var f = m.fahrt;
    mount('fahrt-summary', [
      h('div', { class: 'kpi-value', text: fmtEuro(f.betrag) }),
      h('p', { class: 'small muted', text: f.list.length + ' Fahrten · ' + fmtNum(f.km, 1) + ' km' }),
      h('ul', { class: 'mix-list' }, [
        h('li', null, [h('i', { style: 'background:var(--data-1)' }), 'Säule 1 — Pflege', h('span', { class: 'num muted', text: fmtNum(f.km - f.kmBeratung, 1) + ' km' }), h('span', { class: 'num', text: fmtEuro((f.km - f.kmBeratung) * KM_SATZ) })]),
        h('li', null, [h('i', { style: 'background:var(--data-2)' }), 'Säule 2 — Beratung', h('span', { class: 'num muted', text: fmtNum(f.kmBeratung, 1) + ' km' }), h('span', { class: 'num', text: fmtEuro(f.kmBeratung * KM_SATZ) })])
      ])
    ]);
    var rows = f.list.map(function (t) {
      var km = parseFloat(t.km) || 0;
      return [fmtDate(t.datum), str(t.von, 80) + ' → ' + str(t.nach, 80), str(t.zweck, 120) || h('span', { class: 'muted', text: 'Zweck fehlt' }),
        t.sparte === 'beratung' ? 'Beratung' : 'Pflege', { v: fmtNum(km, 1), r: true }, { v: fmtEuro(km * KM_SATZ), r: true }];
    });
    if (!rows.length) rows.push([{ v: emptyState('Keine Fahrten', 'Im Fahrtenbuch der AERIS Doku sind für diesen Monat keine Fahrten erfasst.'), span: 6 }]);
    mount('t-fahrten', table([{ t: 'Datum' }, { t: 'Strecke' }, { t: 'Zweck' }, { t: 'Sparte' }, { t: 'km', r: true }, { t: 'Betrag', r: true }], rows,
      [{ v: 'Summe', span: 4 }, { v: fmtNum(f.km, 1), r: true }, { v: fmtEuro(f.betrag), r: true }]));
  }
  function renderKontoHint() {
    var k = KAT[$('beleg-form').kat.value];
    $('beleg-konto').textContent = k ? 'Kontenvorschlag: SKR03 ' + k.skr03 + ' · SKR04 ' + k.skr04 + ' — vor Übergabe mit dem Steuerbüro abstimmen.' : '';
  }
  function openBelegDialog(id) {
    var form = $('beleg-form'), b = id ? S.fin.belege.filter(function (x) { return x.id === id; })[0] : null;
    if (!form.kat.options.length) BELEG_KATEGORIEN.forEach(function (k) { form.kat.appendChild(h('option', { value: k.key, text: k.label })); });
    form.reset();
    form.setAttribute('data-id', b ? b.id : '');
    form._bestehendeDatei = b && b.datei ? b.datei : null; // bleibt erhalten, wenn kein neuer Upload erfolgt
    $('beleg-title').textContent = b ? 'Beleg bearbeiten' : 'Beleg erfassen';
    form.datum.value = b ? b.datum : (S.ym === currentYm() ? todayIso() : lastDayIso(S.ym));
    form.betrag.value = b ? decimalDe(b.betragCent / 100) : '';
    form.kat.value = b ? b.kat : 'versicherung';
    form.text.value = b ? b.text : '';
    form.belegnr.value = b ? b.belegnr : '';
    form.zahlart.value = b ? b.zahlart : 'bank';
    renderBelegDateiInfo(form);
    note('beleg-note', '');
    renderKontoHint();
    $('beleg-dialog').showModal();
    form.datum.focus();
  }
  function renderBelegDateiInfo(form) {
    var datei = form._bestehendeDatei;
    if (!datei) { mount('beleg-datei-info', []); return; }
    mount('beleg-datei-info', [
      h('span', { text: 'Angehängt: ' + datei.name + ' — ' }),
      h('button', { type: 'button', class: 'btn btn-sm btn-ghost', style: 'padding:.1rem .5rem;', text: 'Anhang entfernen', onclick: function () {
        form._bestehendeDatei = null; renderBelegDateiInfo(form);
      } })
    ]);
  }
  function liesDateiAlsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }
  function onBelegSubmit(e) {
    e.preventDefault();
    var form = e.currentTarget, res = validateBelegForm(form);
    if (!res.ok) return note('beleg-note', res.errors.join(' '), 'crit');
    var fileInput = form.belegDatei, file = fileInput && fileInput.files && fileInput.files[0];
    var speichern = function (datei) {
      var id = form.getAttribute('data-id'), clean = sanitizeBeleg(Object.assign({ id: id || uid(), createdAt: Date.now(), datei: datei }, res.value));
      if (!clean) return note('beleg-note', 'Beleg konnte nicht geprüft werden.', 'crit');
      S.fin.belege = S.fin.belege.filter(function (b) { return b.id !== clean.id; }).concat(clean);
      $('beleg-dialog').close();
      if (clean.datum.slice(0, 7) !== S.ym) S.ym = clean.datum.slice(0, 7);
      afterChange(id ? 'Beleg aktualisiert.' : 'Beleg gespeichert.');
    };
    if (!file) return speichern(form._bestehendeDatei || null);
    if (file.size > BELEG_DATEI_MAX_BYTES) return note('beleg-note', 'Datei zu groß (max. 8 MB). Bitte verkleinern oder als PDF statt Foto anhängen.', 'crit');
    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    liesDateiAlsDataUrl(file).then(function (dataUrl) {
      if (submitBtn) submitBtn.disabled = false;
      speichern({ name: file.name, dataUrl: dataUrl });
    }).catch(function () {
      if (submitBtn) submitBtn.disabled = false;
      note('beleg-note', 'Datei konnte nicht gelesen werden.', 'crit');
    });
  }
  function deleteBeleg(id) {
    var b = S.fin.belege.filter(function (x) { return x.id === id; })[0];
    if (!b || !window.confirm('Beleg „' + b.text + '“ (' + fmtCent(b.betragCent) + ') wirklich löschen?')) return;
    S.fin.belege = S.fin.belege.filter(function (x) { return x.id !== id; });
    afterChange('Beleg gelöscht.');
  }
  function afterChange(msg) {
    persistFin();
    renderAll();
    toast(S.demo ? msg + ' (Demo — nicht gespeichert)' : msg);
  }

  // ---------------- Steuer ----------------
  function renderSteuer() {
    var year = S.ym.slice(0, 4), rows = zahlungsuebersicht(year), heute = currentYm();
    var bisMonat = year === heute.slice(0, 4) ? parseInt(heute.slice(5, 7), 10) : 12;
    var sum = rows.reduce(function (a, r) { a.z += r.zufluss; a.a += r.abfluss; return a; }, { z: 0, a: 0 });
    var gewinn = r2(sum.z - sum.a), quote = S.fin.settings.quote, ruecklage = Math.max(0, r2(gewinn * quote / 100));
    $('zahlungsuebersicht-title').textContent = 'Zahlungsübersicht ' + year;
    mount('tax-kpis', [
      kpi({ icon: 'i-in', label: 'Zufluss ' + year, value: fmtEuro(sum.z), foot: 'Bezahlte Rechnungen nach Eingangsdatum' }),
      kpi({ icon: 'i-out', label: 'Abfluss ' + year, value: fmtEuro(sum.a), foot: 'Belege und Fahrtkosten' }),
      kpi({ icon: 'i-wallet', label: 'Zahlungssaldo ' + year, value: fmtEuro(gewinn), color: gewinn < 0 ? 'var(--crit)' : null, foot: 'Vorläufig — vor Abschreibungen/Privatanteilen' }),
      kpi({ icon: 'i-shield', label: 'Empfohlene Rücklage', value: fmtEuro(ruecklage), foot: quote + ' % vom Saldo für KSt/GewSt (Einstellungen)', bar: quote * 2 })
    ]);
    mount('t-zahlungsuebersicht', table([{ t: 'Monat' }, { t: 'Zufluss', r: true }, { t: 'Abfluss', r: true }, { t: 'Saldo', r: true }],
      rows.map(function (r, i) { return [MONATE[i], { v: fmtEuro(r.zufluss), r: true }, { v: fmtEuro(r.abfluss), r: true }, { v: fmtEuro(r.ueberschuss), r: true }]; }),
      ['Summe', { v: fmtEuro(sum.z), r: true }, { v: fmtEuro(sum.a), r: true }, { v: fmtEuro(gewinn), r: true }]));
    mount('ruecklage', [
      h('div', { class: 'kpi-value', text: fmtEuro(ruecklage / Math.max(1, bisMonat)) }),
      h('p', { class: 'small muted', text: 'pro Monat zurücklegen (Ø über ' + bisMonat + ' Monat' + (bisMonat === 1 ? '' : 'e') + ')' }),
      h('button', { type: 'button', class: 'btn btn-sm', 'data-goto': 'einstellungen', text: 'Quote anpassen' })
    ]);
    renderDeadlines('deadlines', 4);
  }

  // ---------------- Berichte & Export ----------------
  function exportTile(ic, title, text, btn, fn) {
    return h('article', { class: 'nm kpi tilt', 'data-tilt': '' }, [
      h('div', { class: 'kpi-label' }, [h('span', { class: 'kpi-orb' }, icon(ic, '')), title]),
      h('p', { class: 'small muted', style: 'margin:.6rem 0 1rem;', text: text }),
      h('button', { type: 'button', class: 'btn btn-sm btn-copper', onclick: fn }, [icon('i-download'), btn])
    ]);
  }
  // ---------------- Steuerberater-Bericht (read-only HTML-Snapshot, kein Login, keine Eingabe) ----------------
  function steuerberaterZeile(label, wert) {
    return '<tr><td>' + label + '</td><td class="r">' + wert + '</td></tr>';
  }
  function steuerberaterBelegeTabelle(belege, year) {
    var rows = belege.map(function (b) {
      return '<tr><td>' + fmtDate(b.datum) + '</td><td>' + b.text + '</td><td>' + b.kat + '</td><td>' + b.konto + '</td><td class="r">' + fmtCent(b.betragCent) + '</td></tr>';
    });
    return rows.length ? rows.join('') : '<tr><td colspan="5" class="muted">Keine Belege im Jahr ' + year + '.</td></tr>';
  }
  function steuerberaterSnapshotDaten() {
    var year = S.ym.slice(0, 4), g = S.fin.settings.gmbh, seit = gmbhSeitStart(), moGmbh = monatGmbh(S.ym);
    var belege = S.fin.belege.filter(function (b) { return b.datum.indexOf(year) === 0; })
      .sort(function (a, b) { return a.datum.localeCompare(b.datum); })
      .map(function (b) { var k = KAT[b.kat]; return { datum: b.datum, text: b.text, kat: k.label, konto: skrLabel() + ' ' + kontoNr(k), betragCent: b.betragCent }; });
    return {
      erstelltAm: Date.now(), ym: S.ym, year: year,
      gmbh: g, moGmbh: { ebt: moGmbh.ebt, steuer: moGmbh.steuer, eigenkapital: moGmbh.eigenkapital, steuersatz: moGmbh.steuersatz },
      seit: { monate: seit.monate, eigenkapital: seit.eigenkapital },
      zahlungsuebersicht: zahlungsuebersicht(year),
      fahrt: fahrtZahlen(S.doku, year),
      belege: belege
    };
  }
  function steuerberaterBerichtAus(snap) {
    var year = snap.year, zu = snap.zahlungsuebersicht, g = snap.gmbh, seit = snap.seit, moGmbh = snap.moGmbh, fahrt = snap.fahrt;
    var sumZu = zu.reduce(function (a, r) { return a + r.zufluss; }, 0), sumAb = zu.reduce(function (a, r) { return a + r.abfluss; }, 0);
    var zuRows = zu.map(function (r, i) { return '<tr><td>' + MONATE[i] + '</td><td class="r">' + fmtEuro(r.zufluss) + '</td><td class="r">' + fmtEuro(r.abfluss) + '</td><td class="r">' + fmtEuro(r.ueberschuss) + '</td></tr>'; }).join('');
    var gmbhBlock = g.startYm ? [
      '<h2>GmbH-Ebene</h2>',
      '<table class="t"><tbody>',
      steuerberaterZeile('GmbH-Start', ymLabel(g.startYm)),
      steuerberaterZeile('GF-Grundgehalt/Monat', fmtCent(g.grundgehaltCent)),
      steuerberaterZeile('bAV/Monat', fmtCent(g.bavCent)),
      steuerberaterZeile('Firmenwagen+Ladestrom/Monat', fmtCent(g.firmenwagenCent + g.ladestromCent)),
      steuerberaterZeile('Gewerbesteuer-Hebesatz', g.hebesatz + ' %'),
      steuerberaterZeile('GmbH-Ertragsteuersatz (KSt+SolZ+GewSt)', fmtNum(gmbhSteuersatz(g.hebesatz), 3) + ' %'),
      steuerberaterZeile('EBT ' + ymLabel(snap.ym), fmtEuro(moGmbh.ebt)),
      steuerberaterZeile('Ertragsteuern ' + ymLabel(snap.ym), fmtEuro(moGmbh.steuer)),
      steuerberaterZeile('Netto-Eigenkapitalbildung ' + ymLabel(snap.ym), fmtEuro(moGmbh.eigenkapital)),
      steuerberaterZeile('Kumuliert seit GmbH-Start (' + seit.monate + ' Monate)', fmtEuro(seit.eigenkapital)),
      '</tbody></table>'
    ].join('') : '<h2>GmbH-Ebene</h2><p class="muted">Noch kein GmbH-Start hinterlegt.</p>';
    var html = '<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>AERIS Steuerberater-Bericht ' + year + '</title><style>' +
      'body{font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;color:#1A2536;background:#fff;margin:0;font-size:13px;line-height:1.5;}' +
      '.head{background:#131B27;color:#E7E2D6;padding:22px 26px;}' +
      '.head b{color:#E8C39E;font-size:20px;}' +
      '.wrap{max-width:900px;margin:0 auto;padding:24px 26px 60px;}' +
      'h2{color:#8B5A2B;border-bottom:1px solid rgba(139,90,43,.3);padding-bottom:6px;margin:28px 0 10px;font-size:16px;}' +
      'table{width:100%;border-collapse:collapse;margin:8px 0 18px;font-size:12.5px;}' +
      'td,th{padding:6px 10px 6px 0;border-bottom:1px solid #eee;text-align:left;}' +
      '.r{text-align:right;font-variant-numeric:tabular-nums;}' +
      '.muted{color:#777;}' +
      '.note{font-size:11px;color:#777;margin-top:30px;border-top:1px solid #eee;padding-top:10px;}' +
      '</style></head><body>' +
      '<div class="head"><b>AERIS</b> · Steuerberater-Bericht ' + year + '<div style="font-size:12px;color:#9CADC9;margin-top:4px;">Nur-Lese-Snapshot, erzeugt am ' + new Date(snap.erstelltAm).toLocaleString('de-DE') + ' · keine Eingabemöglichkeit, bei Bedarf neu erzeugen</div></div>' +
      '<div class="wrap">' +
      gmbhBlock +
      '<h2>Zahlungsübersicht ' + year + '</h2>' +
      '<table class="t"><thead><tr><th>Monat</th><th class="r">Zufluss</th><th class="r">Abfluss</th><th class="r">Saldo</th></tr></thead><tbody>' + zuRows +
      '<tr style="font-weight:700;border-top:2px solid #B87333;"><td>Summe</td><td class="r">' + fmtEuro(r2(sumZu)) + '</td><td class="r">' + fmtEuro(r2(sumAb)) + '</td><td class="r">' + fmtEuro(r2(sumZu - sumAb)) + '</td></tr>' +
      '</tbody></table>' +
      '<h2>Fahrtenbuch ' + year + '</h2>' +
      '<table class="t"><tbody>' + steuerberaterZeile('Kilometer gesamt', fmtNum(fahrt.km, 0) + ' km') + steuerberaterZeile('Erstattung (0,30 €/km)', fmtEuro(fahrt.betrag)) + '</tbody></table>' +
      '<h2>Belege ' + year + ' (' + skrLabel() + ')</h2>' +
      '<table class="t"><thead><tr><th>Datum</th><th>Beschreibung</th><th>Kategorie</th><th>Konto</th><th class="r">Betrag</th></tr></thead><tbody>' + steuerberaterBelegeTabelle(snap.belege, year) + '</tbody></table>' +
      '<p class="note">Dieser Bericht ist ein statischer Snapshot zum Erstellungszeitpunkt, keine Steuerberechnung und keine verbindliche Buchführung. Verbindliche Beträge ermittelt das Steuerbüro. Bei Änderungen in AERIS Buch bitte einen neuen Bericht erzeugen.</p>' +
      '</div></body></html>';
    return html;
  }

  function renderBerichte(m) {
    var ym = S.ym, year = ym.slice(0, 4);
    mount('exports', [
      exportTile('i-doc', 'Steuerbüro-Paket', 'Kontenmatrix, Buchungsliste und Fahrtenbuch ' + ymLabel(ym) + ' (' + skrLabel() + ').', 'CSV laden', function () { download('AERIS-Steuerbuero-' + ym + '.csv', csvPaket(ym)); }),
      exportTile('i-receipt', 'Buchungsliste', 'Alle Einnahmen und Ausgaben des Monats mit Konto und Belegnummer.', 'CSV laden', function () { download('AERIS-Buchungsliste-' + ym + '.csv', csvDoc(buchungen(ym), buchungKopf())); }),
      exportTile('i-tax', 'Zahlungsübersicht ' + year, 'Zufluss, Abfluss und Saldo je Monat — Vorbereitung für den Jahresabschluss.', 'CSV laden', function () { download('AERIS-Zahlungsuebersicht-' + year + '.csv', csvZahlungsuebersicht(year)); }),
      h('article', { class: 'nm kpi tilt', 'data-tilt': '' }, [
        h('div', { class: 'kpi-label' }, [h('span', { class: 'kpi-orb' }, icon('i-print', '')), 'Monatsbericht drucken']),
        h('p', { class: 'small muted', style: 'margin:.6rem 0 1rem;', text: 'Cockpit, Einnahmen und Ausgaben als PDF oder Papier.' }),
        h('button', { type: 'button', class: 'btn btn-sm', onclick: printReport }, [icon('i-print'), 'Drucken / PDF'])
      ]),
      h('article', { class: 'nm kpi tilt', 'data-tilt': '' }, [
        h('div', { class: 'kpi-label' }, [h('span', { class: 'kpi-orb' }, icon('i-shield', '')), 'Steuerberater-Bericht']),
        h('p', { class: 'small muted', style: 'margin:.6rem 0 1rem;', text: 'Nur-Lese-Snapshot: GmbH-Ebene, Zahlungsübersicht, Fahrtenbuch, Belege. Keine PIN nötig, keine Eingabe möglich — bei Bedarf neu erzeugen.' }),
        h('button', { type: 'button', class: 'btn btn-sm btn-copper', onclick: function () { download('AERIS-Steuerberater-Bericht-' + S.ym.slice(0, 4) + '.html', steuerberaterBerichtAus(steuerberaterSnapshotDaten()), 'text/html;charset=utf-8'); } }, [icon('i-doc'), 'Bericht herunterladen'])
      ])
    ]);
    mount('empfaenger', EMPFAENGER.map(function (e) { return empfaengerCard(e, ym); }));
  }
  function empfaengerCard(e, ym) {
    var rows = e.csv ? csvRowsFor(e.csv, ym) : null, n = rows ? rows.count : 0;
    var werte = S.fin.versand[e.key] || {}, idN = 'vs-note-' + e.key;
    return h('article', { class: 'nm card' }, [
      h('div', { class: 'card-head' }, [h('div', null, [h('h4', { class: 'card-title', text: e.label }), h('p', { class: 'card-sub', text: e.hinweis })]),
        e.csv ? chip(n ? 'info' : 'warn', n + (n === 1 ? ' Zeile' : ' Zeilen')) : chip('info', 'in AERIS Doku')]),
      e.csv ? h('button', { type: 'button', class: 'btn btn-sm btn-copper', disabled: n ? null : '', onclick: function () { download('AERIS-' + e.key + '-' + ym + '.csv', rows.text); } }, [icon('i-download'), 'Paket ' + ymLabel(ym)]) : null,
      e.felder.length ? h('details', { style: 'margin-top:1rem;' }, [h('summary', { class: 'small muted', style: 'cursor:pointer;min-height:32px;', text: 'Übermittlungs-Zugang hinterlegen' }),
        h('div', { class: 'form-grid', style: 'margin-top:.7rem;' }, e.felder.map(function (f) {
          return h('label', { class: 'field' }, [h('span', { text: f.label }), h('input', { class: 'input', type: 'text', maxlength: '200', 'data-vs': e.key + '.' + f.key, value: werte[f.key] || '' })]);
        })),
        h('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.8rem;' }, [
          h('button', { type: 'button', class: 'btn btn-sm', text: 'Speichern', onclick: function () { saveVersand(e, idN); } }),
          h('button', { type: 'button', class: 'btn btn-sm', text: 'Jetzt übermitteln', onclick: function () { versandVersuchen(e, idN); } })
        ]),
        h('p', { class: 'form-note', id: idN, role: 'status' })]) : null
    ]);
  }
  function saveVersand(e, idN) {
    var cfg = {};
    document.querySelectorAll('[data-vs^="' + e.key + '."]').forEach(function (inp) { cfg[inp.getAttribute('data-vs').split('.')[1]] = inp.value; });
    var tmp = {}; tmp[e.key] = cfg;
    S.fin.versand[e.key] = sanitizeVersand(tmp)[e.key];
    persistFin();
    note(idN, S.demo ? 'Demo — nicht gespeichert.' : '✓ Verschlüsselt auf diesem Gerät gespeichert.');
  }
  // Bewusst KEIN Netzwerkaufruf: Es existiert noch keine zertifizierte Anbindung an ELSTER, Kassen-Portale
  // oder TI/KIM. Sobald ein realer Zugang vorliegt, ist dies die einzige Stelle für den Sendeaufruf.
  function versandVersuchen(e, idN) {
    var werte = S.fin.versand[e.key] || {};
    var komplett = e.felder.every(function (f) { return (werte[f.key] || '').trim() !== ''; });
    note(idN, komplett
      ? '⚠ Zugang hinterlegt, aber eine zertifizierte Schnittstelle (ELSTER/Kassen-Portal/TI) ist noch nicht angebunden. Bitte die CSV-Datei manuell versenden.'
      : '⚠ Noch nicht konfiguriert — bitte zuerst alle Zugangsfelder ausfüllen und speichern.', 'crit');
  }
  function printReport() {
    var panels = ['cockpit', 'einnahmen', 'ausgaben'].map(function (n) { return $('panel-' + n); });
    panels.forEach(function (p) { p.classList.add('is-print'); });
    window.addEventListener('afterprint', function done() { panels.forEach(function (p) { p.classList.remove('is-print'); }); window.removeEventListener('afterprint', done); });
    window.print();
  }

  // ---------- CSV (Semikolon, UTF-8 mit BOM, Schutz vor Formel-Injektion) ----------
  function csvCell(v) {
    var t = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+(,\d+)?$/.test(t)) t = "'" + t;
    return '"' + t.replace(/"/g, '""') + '"';
  }
  function csvLine(arr) { return arr.map(csvCell).join(';'); }
  function csvDoc(lines, kopf) { return '﻿' + (kopf || []).concat(lines).map(csvLine).join('\r\n'); }
  function buchungKopf() { return [['Datum', 'Belegnr.', 'Konto ' + skrLabel(), 'Bezeichnung', 'Einnahme (EUR)', 'Ausgabe (EUR)']]; }
  function buchungen(ym) {
    var m = monat(ym), out = [], ende = lastDayIso(ym), nr = rechnungsnr('budget', ym);
    if (m.budget.basis > 0) out.push([fmtDate(ende), nr, kontoNr(KONTEN.basis), 'Pflegestunden ' + fmtNum(m.budget.std, 2) + ' Std. × ' + decimalDe(m.budget.satz) + ' €', decimalDe(m.budget.basis), '']);
    if (m.budget.zuschlaege > 0) out.push([fmtDate(ende), nr, kontoNr(KONTEN.zuschlag), 'Zuschläge Nacht/Sa/So/Feiertag/Weihnachten', decimalDe(m.budget.zuschlaege), '']);
    m.privat.list.forEach(function (e) { out.push([fmtDate(e.datum), rechnungsnr('privat', ym), kontoNr(KONTEN.privat), 'Aufnahme-/Anamnese-Pauschale', decimalDe(parseFloat(e.betrag) || 0), '']); });
    m.fahrt.list.forEach(function (t) { var km = parseFloat(t.km) || 0; out.push([fmtDate(t.datum), '', kontoNr(KONTEN.fahrt), 'Fahrt ' + str(t.von, 80) + ' → ' + str(t.nach, 80) + ' (' + fmtNum(km, 1) + ' km)', '', decimalDe(km * KM_SATZ)]); });
    m.belege.forEach(function (b) { out.push([fmtDate(b.datum), b.belegnr, kontoNr(KAT[b.kat]), b.text, '', decimalDe(b.betragCent / 100)]); });
    return out;
  }
  function kontenmatrix(ym) {
    var m = monat(ym), sum = {};
    m.belege.forEach(function (b) { sum[b.kat] = (sum[b.kat] || 0) + b.betragCent; });
    var rows = [[KONTEN.basis.label, KONTEN.basis.skr03, KONTEN.basis.skr04, decimalDe(m.budget.basis)],
      [KONTEN.zuschlag.label, KONTEN.zuschlag.skr03, KONTEN.zuschlag.skr04, decimalDe(m.budget.zuschlaege)],
      [KONTEN.privat.label, KONTEN.privat.skr03, KONTEN.privat.skr04, decimalDe(m.privat.summe)],
      [KONTEN.fahrt.label + ' (' + fmtNum(m.fahrt.km, 1) + ' km)', KONTEN.fahrt.skr03, KONTEN.fahrt.skr04, decimalDe(m.fahrt.betrag)]];
    Object.keys(sum).forEach(function (k) { rows.push([KAT[k].label, KAT[k].skr03, KAT[k].skr04, decimalDe(sum[k] / 100)]); });
    return { rows: rows, m: m };
  }
  function csvPaket(ym) {
    var km = kontenmatrix(ym), m = km.m, b = buchungen(ym);
    var lines = [['AERIS — Export für Steuerbüro'], [firma('name') + ', ' + firma('strasse') + ', ' + firma('plzOrt') + ' · Geschäftsführer/in: ' + firma('geschaeftsfuehrer') + ' · ' + firma('registergericht') + ' ' + firma('hrb')],
      ['Monat', ymLabel(ym)], ['Erzeugt am', new Date().toLocaleString('de-DE')], ['Kontenrahmen', skrLabel()], [],
      ['Kontenmatrix'], ['Kategorie', 'SKR03', 'SKR04', 'Betrag (EUR)']].concat(km.rows).concat([[],
      ['Summe Einnahmen', '', '', decimalDe(m.einnahmen)], ['Summe Ausgaben', '', '', decimalDe(m.ausgaben)], ['Ergebnis Leistungsmonat', '', '', decimalDe(m.ergebnis)], [],
      ['Buchungsliste']]).concat(buchungKopf()).concat(b).concat([[],
      ['Hinweis: Pflegeleistungen i. d. R. umsatzsteuerfrei (§ 4 Nr. 14 bzw. Nr. 16 UStG, Grundlage siehe Firmendaten AERIS Doku); Belege brutto. Fahrtenbuch mit Zielorten zur GoBD-konformen Nachweisführung. Weitergabe nur an Berufsgeheimnisträger (§ 57 StBerG).']]);
    return csvDoc(lines);
  }
  function leistungsnachweis(ym) {
    var b = budgetZahlen(S.doku, ym), rows = [['Datum', 'Von', 'Bis', 'Stunden', 'davon Nacht', 'Maßnahmen']];
    tageImMonat(S.doku, ym).forEach(function (iso) {
      var tag = S.doku.tage[iso], labels = {};
      entriesIn(S.doku, 'massnahme', ym).forEach(function (e) { if (e.datum === iso && e.label) labels[str(e.label, 80)] = 1; });
      rows.push([fmtDate(iso), str(tag.von, 5), str(tag.bis, 5), decimalDe(shiftStunden(tag, iso)), decimalDe(nachtMinuten(tag, iso) / 60), Object.keys(labels).join(', ')]);
    });
    rows.push([], ['Summe Stunden', '', '', decimalDe(b.std), decimalDe(b.nachtStd), '']);
    return rows;
  }
  function positionen(ym) {
    var b = budgetZahlen(S.doku, ym), p = privatZahlen(S.doku, ym);
    var rows = [['Rechnung', 'Position', 'Menge', 'Betrag (EUR)'], [rechnungsnr('budget', ym), 'Pflegestunden Basis', decimalDe(b.std) + ' Std.', decimalDe(b.basis)]];
    ['nacht', 'samstag', 'sonntag', 'feiertag', 'weihnachten'].forEach(function (k) { if (b.raw[k] > 0) rows.push([rechnungsnr('budget', ym), 'Zuschlag ' + k, '', decimalDe(b.raw[k])]); });
    rows.push([rechnungsnr('budget', ym), 'Summe Budget', '', decimalDe(b.summe)]);
    if (p.summe > 0) rows.push([rechnungsnr('privat', ym), 'Aufnahme-/Anamnese-Pauschalen', String(p.list.length), decimalDe(p.summe)]);
    return rows;
  }
  function csvRowsFor(kind, ym) {
    if (kind === 'paket') return { count: buchungen(ym).length, text: csvPaket(ym) };
    if (kind === 'buchungen') { var b = buchungen(ym); return { count: b.length, text: csvDoc(b, buchungKopf()) }; }
    if (kind === 'leistung') { var l = leistungsnachweis(ym); return { count: tageImMonat(S.doku, ym).length, text: csvDoc(l) }; }
    if (kind === 'positionen') { var p = positionen(ym); return { count: budgetZahlen(S.doku, ym).summe > 0 ? p.length - 1 : 0, text: csvDoc(p) }; }
    var all = csvPaket(ym) + '\r\n\r\n' + csvDoc([['Leistungsnachweis']].concat(leistungsnachweis(ym))).slice(1);
    return { count: buchungen(ym).length + tageImMonat(S.doku, ym).length, text: all };
  }
  function csvZahlungsuebersicht(year) {
    var rows = zahlungsuebersicht(year), z = 0, a = 0;
    var lines = [['AERIS — Zahlungsübersicht ' + year + ' (vorläufig, Vorbereitung Jahresabschluss GmbH i.G.)'], [firma('name') + ', ' + firma('plzOrt')], ['Erzeugt am', new Date().toLocaleString('de-DE')], [], ['Monat', 'Zufluss (EUR)', 'Abfluss (EUR)', 'Überschuss (EUR)']];
    rows.forEach(function (r, i) { z += r.zufluss; a += r.abfluss; lines.push([MONATE[i], decimalDe(r.zufluss), decimalDe(r.abfluss), decimalDe(r.ueberschuss)]); });
    lines.push(['Summe', decimalDe(z), decimalDe(a), decimalDe(z - a)]);
    return csvDoc(lines);
  }
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob), a = h('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    toast('„' + filename + '“ wird heruntergeladen.');
  }

  // ---------- Sicherung ----------
  function downloadBackup() {
    if (S.demo) return toast('Im Demo-Modus nicht verfügbar.');
    persistQueue.then(function () {
      var env = parseEnvelope(readStorage(KEY_FIN));
      if (!env) return note('backup-note', 'Noch keine Finanzdaten gespeichert.', 'crit');
      var file = { app: 'aeris-finanz', v: 1, erstellt: new Date().toISOString(), payload: env };
      download('AERIS-Buch-Sicherung-' + todayIso() + '.json', JSON.stringify(file), 'application/json');
      note('backup-note', '✓ Verschlüsselte Sicherung erstellt.');
    });
  }
  function onRestoreFile(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return note('backup-note', 'Datei zu groß für eine AERIS-Buch-Sicherung.', 'crit');
    file.text().then(function (txt) {
      var parsed = null;
      try { parsed = JSON.parse(txt); } catch (err) { parsed = null; }
      var env = isObj(parsed) && parsed.app === 'aeris-finanz' ? parseEnvelope(JSON.stringify(parsed.payload)) : null;
      if (!env) return note('backup-note', 'Keine gültige AERIS-Buch-Sicherung.', 'crit');
      askRestorePin(env);
    });
  }
  function askRestorePin(env) {
    var idP = 'restore-pin';
    var form = h('form', { class: 'nm-inset', style: 'padding:1rem;margin-top:.8rem;', novalidate: '', onsubmit: function (ev) { ev.preventDefault(); restoreWithPin(env, $(idP).value.trim()); } }, [
      h('label', { class: 'field' }, [h('span', { text: 'PIN, mit der die Sicherung erstellt wurde' }), h('input', { class: 'input', id: idP, type: 'password', inputmode: 'numeric', maxlength: '6', autocomplete: 'off' })]),
      h('button', { type: 'submit', class: 'btn btn-sm btn-copper', style: 'margin-top:.7rem;', text: 'Sicherung einspielen' })
    ]);
    mount('restore-area', form);
    note('backup-note', '');
    $(idP).focus();
  }
  function restoreWithPin(env, pin) {
    if (!/^\d{4,6}$/.test(pin)) return note('backup-note', 'Bitte eine PIN aus 4–6 Ziffern eingeben.', 'crit');
    deriveKey(pin, env.salt, env.iterations).then(function (k) { return decryptJson(k, env.iv, env.ct); }).then(function (data) {
      var clean = sanitizeFin(data);
      if (!window.confirm('Sicherung mit ' + clean.belege.length + ' Beleg(en) einspielen? Die aktuellen Finanzdaten auf diesem Gerät werden ersetzt.')) return;
      S.fin = clean;
      $('restore-area').replaceChildren();
      initSettings();
      afterChange('Sicherung eingespielt.');
      note('backup-note', '✓ Sicherung eingespielt und mit deiner aktuellen PIN verschlüsselt.');
    }).catch(function () { note('backup-note', 'PIN passt nicht zu dieser Sicherung.', 'crit'); });
  }

  // ---------- Einstellungen ----------
  function setRadio(groupId, attr, value) {
    $(groupId).querySelectorAll('[' + attr + ']').forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute(attr) === value ? 'true' : 'false'); b.tabIndex = b.getAttribute(attr) === value ? 0 : -1; });
  }
  function radioKeys(groupId, attr, apply) {
    var btns = Array.prototype.slice.call($(groupId).querySelectorAll('[' + attr + ']'));
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { apply(b.getAttribute(attr)); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = btns[(i + d + btns.length) % btns.length];
        apply(n.getAttribute(attr)); n.focus();
      });
    });
  }
  var settingsBound = false;
  function initSettings() {
    setRadio('seg-skr', 'data-skr', S.fin.settings.skr);
    setRadio('seg-fx', 'data-fx', document.documentElement.getAttribute('data-fx'));
    $('quote').value = S.fin.settings.quote;
    $('quote-out').textContent = S.fin.settings.quote + ' %';
    if (settingsBound) return;
    settingsBound = true;
    radioKeys('seg-skr', 'data-skr', function (v) { S.fin.settings.skr = v === 'skr04' ? 'skr04' : 'skr03'; setRadio('seg-skr', 'data-skr', S.fin.settings.skr); afterChange('Kontenrahmen: ' + skrLabel()); });
    radioKeys('seg-fx', 'data-fx', function (v) { applyFx(v); setRadio('seg-fx', 'data-fx', v); note('settings-note', 'Effekte: ' + { voll: 'Voll', reduziert: 'Ruhig', aus: 'Aus' }[v]); });
    $('quote').addEventListener('input', function () { $('quote-out').textContent = $('quote').value + ' %'; });
    $('quote').addEventListener('change', function () { S.fin.settings.quote = Math.max(0, Math.min(50, parseInt($('quote').value, 10) || 0)); afterChange('Rücklagequote: ' + S.fin.settings.quote + ' %'); });
    initGmbhSettings();
    initSteuerberaterZugang();
  }
  var STB_VERALTET_MS = 30 * 24 * 60 * 60 * 1000;
  function renderStbStatus() {
    var st = steuerberaterZugangStatus();
    if (!st) { $('stb-status').textContent = 'Noch nicht eingerichtet.'; $('stb-loeschen').classList.add('hidden'); return; }
    var alt = Date.now() - st.erstelltAm > STB_VERALTET_MS;
    $('stb-status').textContent = (alt ? '⚠️ Veraltet — ' : 'Aktiv · ') + 'zuletzt aktualisiert ' + new Date(st.erstelltAm).toLocaleString('de-DE') + (alt ? '. Bitte über „Zugang einrichten/aktualisieren“ neu erzeugen.' : '.');
    $('stb-loeschen').classList.remove('hidden');
  }
  function stbUebergabeMailtoHref(email) {
    var betreff = 'AERIS GmbH — Zugang zu AERIS Buch (verschlüsselte Übergabe-Datei)';
    var text = 'Guten Tag,\n\nanbei die verschlüsselte PIN-Übergabe-Datei für Ihren Lesezugang zu AERIS Buch — bitte hier im Mail-Entwurf noch anhängen (gerade heruntergeladen).\n\n' +
      'Zum Öffnen bitte das separat mitgeteilte Mandats-Aktenzeichen verwenden.\n\nMit freundlichen Grüßen\nAERIS GmbH i.G.';
    return 'mailto:' + email + '?subject=' + encodeURIComponent(betreff) + '&body=' + encodeURIComponent(text);
  }
  function initSteuerberaterZugang() {
    renderStbStatus();
    $('stb-kanzlei-email').value = S.fin.settings.stbEmail || '';
    $('stb-kanzlei-email').addEventListener('change', function () {
      S.fin.settings.stbEmail = $('stb-kanzlei-email').value.trim();
      afterChange('Kanzlei-E-Mail gespeichert.');
    });
    $('stb-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var p1 = $('stb-pin1').value.trim(), p2 = $('stb-pin2').value.trim(), az = $('stb-aktenzeichen').value.trim();
      var kanzleiEmail = $('stb-kanzlei-email').value.trim();
      note('stb-note', '');
      if (!/^\d{6}$/.test(p1)) return note('stb-note', 'PIN muss genau 6 Ziffern haben.', 'crit');
      if (p1 !== p2) return note('stb-note', 'Die beiden PINs stimmen nicht überein.', 'crit');
      if (p1 === S.dokuKeyPin) return note('stb-note', 'Bitte eine andere PIN als deine eigene wählen.', 'crit');
      if (az.length < 4) return note('stb-note', 'Mandats-Aktenzeichen mit mindestens 4 Zeichen angeben.', 'crit');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kanzleiEmail)) return note('stb-note', 'Bitte eine gültige E-Mail-Adresse der Kanzlei angeben.', 'crit');
      note('stb-note', 'Zugang wird verschlüsselt gespeichert …');
      steuerberaterZugangSpeichern(p1).then(function () {
        return erzeugePinUebergabeDatei(p1, az);
      }).then(function (html) {
        download('AERIS-Steuerberater-PIN-Uebergabe.html', html, 'text/html;charset=utf-8');
        S.fin.settings.stbEmail = kanzleiEmail;
        persistFin();
        $('stb-pin1').type = 'password'; $('stb-pin2').type = 'password';
        $('stb-pin1').value = ''; $('stb-pin2').value = ''; $('stb-aktenzeichen').value = '';
        note('stb-note', 'Zugang eingerichtet, Datei heruntergeladen, Mail-Entwurf wird geöffnet …', 'ok');
        renderStbStatus();
        setTimeout(function () { window.location.href = stbUebergabeMailtoHref(kanzleiEmail); }, 400);
      });
    });
    $('stb-pin-generate').addEventListener('click', function () {
      var pin = randomSechsstelligePin();
      $('stb-pin1').type = 'text'; $('stb-pin2').type = 'text';
      $('stb-pin1').value = pin; $('stb-pin2').value = pin;
      note('stb-note', 'PIN automatisch generiert: ' + pin + ' — wird beim Absenden im System hinterlegt und in die Übergabe-Datei verschlüsselt.', 'ok');
    });
    $('stb-loeschen').addEventListener('click', function () {
      steuerberaterZugangLoeschen();
      note('stb-note', 'Steuerberater-Zugang deaktiviert.', 'ok');
      renderStbStatus();
    });
  }
  function gmbhEuroField(id, key) {
    var g = S.fin.settings.gmbh;
    $(id).value = decimalDe((g[key] || 0) / 100);
    $(id).addEventListener('change', function () {
      var cent = parseEuroToCent($(id).value);
      g[key] = cent === null ? 0 : cent;
      $(id).value = decimalDe(g[key] / 100);
      afterChange('GmbH-Einstellung gespeichert.');
    });
  }
  function initGmbhSettings() {
    var g = S.fin.settings.gmbh;
    gmbhEuroField('gmbh-grundgehalt', 'grundgehaltCent');
    gmbhEuroField('gmbh-bav', 'bavCent');
    gmbhEuroField('gmbh-firmenwagen', 'firmenwagenCent');
    gmbhEuroField('gmbh-ladestrom', 'ladestromCent');
    gmbhEuroField('gmbh-rentenziel', 'rentenzielCent');
    $('gmbh-hebesatz').value = g.hebesatz;
    $('gmbh-hebesatz').addEventListener('change', function () {
      var v = parseInt($('gmbh-hebesatz').value, 10);
      g.hebesatz = (v >= 200 && v <= 900) ? v : 400;
      $('gmbh-hebesatz').value = g.hebesatz;
      afterChange('Gewerbesteuer-Hebesatz: ' + g.hebesatz + ' %');
    });
    $('gmbh-start').value = g.startYm;
    $('gmbh-start').addEventListener('change', function () {
      var v = $('gmbh-start').value;
      g.startYm = isYm(v) ? v : '';
      afterChange(g.startYm ? 'GmbH-Start: ' + ymLabel(g.startYm) : 'GmbH-Start entfernt.');
    });
    $('gmbh-renteneintritt').value = g.renteneintrittJahr || '';
    $('gmbh-renteneintritt').addEventListener('change', function () {
      var v = parseInt($('gmbh-renteneintritt').value, 10);
      g.renteneintrittJahr = (v >= 2026 && v <= 2100) ? v : 0;
      $('gmbh-renteneintritt').value = g.renteneintrittJahr || '';
      afterChange('GmbH-Einstellung gespeichert.');
    });
  }
  function applyFx(v) {
    var fx = FX_STUFEN.indexOf(v) !== -1 ? v : 'voll';
    document.documentElement.setAttribute('data-fx', fx);
    try { localStorage.setItem(KEY_FX, fx); } catch (e) { return; }
    if (fx !== 'voll') Light.reset();
  }

  // =====================================================================================
  // Licht- & 3D-Motor
  // Eine globale Lichtquelle (--lx/--ly) steuert ALLE neumorphen Schatten, Glanzlichter und
  // den Umgebungs-Spot. Zeiger (Desktop) bzw. Geräteneigung (Android) bewegen das Licht sanft.
  // Karten mit [data-tilt] neigen sich in 3D zum Zeiger und tragen ein wanderndes Glanzlicht.
  // =====================================================================================
  var Light = (function () {
    var root = document.documentElement, BASE = { x: -0.6, y: -0.8 };
    var cur = { x: BASE.x, y: BASE.y }, target = { x: BASE.x, y: BASE.y }, raf = 0;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    function active() { return !reduce.matches && root.getAttribute('data-fx') === 'voll'; }
    function clamp(v) { return Math.max(-1, Math.min(1, v)); }
    function step() {
      cur.x += (target.x - cur.x) * 0.12; cur.y += (target.y - cur.y) * 0.12;
      root.style.setProperty('--lx', cur.x.toFixed(3)); root.style.setProperty('--ly', cur.y.toFixed(3));
      raf = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.004 ? requestAnimationFrame(step) : 0;
    }
    function aim(x, y) { target.x = clamp(x); target.y = clamp(y); if (!raf) raf = requestAnimationFrame(step); }
    function onPointer(e) {
      if (!active() || !fine.matches) return;
      aim(BASE.x * 0.4 + (e.clientX / window.innerWidth - 0.5) * 1.4, BASE.y * 0.4 + (e.clientY / window.innerHeight - 0.5) * 1.4);
    }
    function onTiltDevice(e) {
      if (!active() || fine.matches || e.gamma === null) return;
      aim(BASE.x * 0.5 - e.gamma / 60, BASE.y * 0.5 - (e.beta - 45) / 60);
    }
    function reset() { target.x = BASE.x; target.y = BASE.y; if (!raf) raf = requestAnimationFrame(step); }
    function init() {
      window.addEventListener('pointermove', onPointer, { passive: true });
      document.documentElement.addEventListener('pointerleave', reset);
      if ('DeviceOrientationEvent' in window && typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
        window.addEventListener('deviceorientation', onTiltDevice, { passive: true });
      }
    }
    return { init: init, reset: reset, active: active, fine: fine };
  })();

  function onTiltMove(e) {
    var el = e.currentTarget;
    if (!Light.active() || !Light.fine.matches) return;
    // Über Bedienelementen friert die Neigung ein, damit Ziele nicht unter dem Zeiger wandern.
    if (e.target.closest && e.target.closest('button,input,select,textarea,a,label,summary,.hit')) return;
    var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    var amp = el.offsetWidth > 520 ? 2.5 : 6;
    el.classList.add('is-tracking');
    el.style.setProperty('--ry', ((px - 0.5) * amp).toFixed(2) + 'deg');
    el.style.setProperty('--rx', ((0.5 - py) * amp).toFixed(2) + 'deg');
    el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    el.style.setProperty('--glow', '1');
  }
  function onTiltLeave(e) {
    var el = e.currentTarget;
    el.classList.remove('is-tracking');
    ['--rx', '--ry', '--mx', '--my', '--glow'].forEach(function (p) { el.style.removeProperty(p); });
  }
  function bindTilt() {
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      if (el.getAttribute('data-tilt-bound')) return;
      el.setAttribute('data-tilt-bound', '1');
      el.addEventListener('pointermove', onTiltMove);
      el.addEventListener('pointerleave', onTiltLeave);
    });
  }


  // =====================================================================================
  // Live-Verknüpfung mit AERIS Doku
  // Jede Speicherung in AERIS Doku ändert den verschlüsselten Datensatz 'ae-finanz-log-v1-enc'.
  // AERIS Buch erkennt das (storage-Ereignis aus anderem Fenster/Tab, Rückkehr in die App,
  // minütliche Prüfung) und entschlüsselt mit dem nach der PIN-Eingabe im Arbeitsspeicher
  // gehaltenen, nicht exportierbaren Schlüssel neu. Nur lesend; geänderte PIN → erneute Sperre.
  // =====================================================================================
  var syncBusy = false;
  function syncDoku(reason) {
    if (S.demo || !S.dokuKey || syncBusy) return;
    syncBusy = true;
    ladeDokuRaw().then(function (raw) {
      if (!raw || raw === S.dokuRaw) return null;
      var env = parseEnvelope(raw);
      if (!env) return null;
      if (env.salt !== S.dokuSalt) { toast('PIN in AERIS Doku geändert — bitte neu entsperren.'); setTimeout(lockApp, 1800); return null; }
      return decryptJson(S.dokuKey, env.iv, env.ct).then(function (data) {
        S.doku = sanitizeDoku(data); S.dokuRaw = raw; S.syncedAt = Date.now();
        renderAll();
        if (reason !== 'interval') toast('Aktualisiert aus AERIS Doku.');
      });
    }).catch(function () { return null; }).then(function () { syncBusy = false; });
  }
  function initSync() {
    window.addEventListener('storage', function (e) { if (e.key === KEY_DOKU) syncDoku('storage'); });
    try { new BroadcastChannel('aeris-sync').onmessage = function (e) { if (e.data && e.data.typ === 'doku-gespeichert') syncDoku('kanal'); }; } catch (e) { return; }
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') syncDoku('visible'); });
    window.addEventListener('focus', function () { syncDoku('focus'); });
    setInterval(function () { if (document.visibilityState === 'visible') syncDoku('interval'); }, 60000);
  }

  // =====================================================================================
  // Service Worker, Update-Erkennung, Auto-Sperre, Start
  // =====================================================================================
  // Erzwungenes Update: App-Caches leeren, Service Worker aktualisieren, Seite frisch laden.
  // Nutzerdaten liegen verschlüsselt im localStorage und werden dabei NICHT berührt.
  function hardUpdate() {
    var jobs = [];
    if (window.caches && caches.keys) jobs.push(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k.indexOf('aeris-buch') === 0 || /^aeris-finanz-v20\d\d-/.test(k); }).map(function (k) { return caches.delete(k); })); }));
    if ('serviceWorker' in navigator) jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) { return Promise.all(regs.map(function (r) { return r.update().catch(function () { return null; }); })); }));
    Promise.all(jobs).catch(function () { return null; }).then(function () { location.replace(location.pathname + '?neu=' + Date.now()); });
  }
  function checkUpdate() {
    if (!navigator.onLine || location.protocol.indexOf('http') !== 0) return;
    fetch(location.pathname + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (txt) {
      var m = txt.match(/APP-VERSION:\s*([\w-]+)/);
      if (m && m[1] !== APP_VERSION) $('update-banner').classList.add('is-on');
    }).catch(function () { return null; });
  }
  function boot() {
    if (/[?&]neu=/.test(location.search) && history.replaceState) history.replaceState(null, '', location.pathname + location.hash);
    // Update-Hinweis muss auch VOR dem Entsperren bedienbar sein (erscheint über dem PIN-Gate)
    document.querySelector('[data-action="update-now"]').addEventListener('click', function (e) { e.stopPropagation(); hardUpdate(); });
    document.querySelector('[data-action="update-later"]').addEventListener('click', function (e) { e.stopPropagation(); $('update-banner').classList.remove('is-on'); });
    var fx = null;
    try { fx = localStorage.getItem(KEY_FX); } catch (e) { fx = null; }
    if (FX_STUFEN.indexOf(fx) !== -1) document.documentElement.setAttribute('data-fx', fx);
    Light.init();
    bindTilt();
    initSync();
    gateInit();
    ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, function () { if (S.key || S.demo) resetLockTimer(); }, { passive: true }); });
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(function () { return null; });
    window.addEventListener('load', function () { checkUpdate(); setInterval(checkUpdate, 300000); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
