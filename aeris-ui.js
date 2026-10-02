/* =====================================================================================
   AERIS UI — Verhalten der neu aufgebauten Oberfläche (AERIS Dokumentation)
   - Kopfzeile: Datum + Tagesstatus, Tagesablauf (4 Schritte) mit Live-Status
   - Schichtakte: Modul-Navigator (15 Assessments in 5 Themengruppen) mit Befüllt-Anzeige
   - SIS: Fortschritt je Themenfeld
   - Mobil: „Mehr“-Tab öffnet die bestehende Seitenleiste
   Liest Status ausschließlich über die schreibgeschützte Schnittstelle window.AERIS_DOKU
   (app.js) bzw. aus dem DOM; speichert und verändert keine Pflegedaten.
   ===================================================================================== */
(function () {
  'use strict';

  var MODUL_GRUPPEN = [
    { label: 'Atmung & Vitalzeichen', module: [1, 2, 3] },
    { label: 'Neurologie & Schmerz', module: [4, 15] },
    { label: 'Haut, Wunde & Lagerung', module: [5, 8, 10, 12] },
    { label: 'Ernährung & Medikation', module: [6, 9, 13, 14] },
    { label: 'Sicherheit & Ereignisse', module: [7, 11] }
  ];
  var STATUS_TEXT = { offen: 'Offen', gz: 'Gegengezeichnet', versiegelt: 'Versiegelt' };

  function $(id) { return document.getElementById(id); }
  function api() { return window.AERIS_DOKU || null; }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // ---------- Kopfzeile & Tagesablauf ----------
  function renderHead() {
    var d = $('ui-head-date');
    if (d) d.textContent = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    var a = api(), st = $('ui-head-status');
    if (!a || !st) return;
    var s = a.tagStatus(a.heuteIso()), tone = s.versiegelt ? 'versiegelt' : s.gzDone ? 'gz' : 'offen';
    st.setAttribute('data-tone', tone);
    st.textContent = 'Heute: ' + STATUS_TEXT[tone];
  }
  function renderWorkflow() {
    var a = api(), list = $('ui-steps');
    if (!a || !list) return;
    var s = a.tagStatus(a.heuteIso());
    var done = { schicht: !!(s.von && s.bis), erfassen: s.massnahmen > 0, gz: s.gzDone, siegel: s.versiegelt };
    var current = null, count = 0;
    list.querySelectorAll('li[data-step]').forEach(function (li) {
      var key = li.getAttribute('data-step'), ok = !!done[key];
      if (ok) count++;
      li.classList.toggle('is-done', ok);
      li.classList.remove('is-current');
      if (!ok && !current) current = li;
    });
    if (current) current.classList.add('is-current');
    var c = $('ui-workflow-count');
    if (c) c.textContent = count === 4 ? 'Tag abgeschlossen' : count + ' von 4 erledigt';
  }
  function refresh() { renderHead(); renderWorkflow(); markModules(); markSis(); }

  // ---------- Modul-Navigator der Schichtakte ----------
  function moduleDetails() {
    var map = {};
    var host = $('verlauf-assessment');
    if (!host) return map;
    Array.prototype.forEach.call(host.children, function (d) {
      if (d.tagName !== 'DETAILS') return;
      var sum = d.querySelector('summary'), m = sum && sum.textContent.match(/^\s*(\d+)\s*·\s*([^—\n]+)/);
      if (m) map[parseInt(m[1], 10)] = { details: d, titel: m[2].trim().replace(/\s*&\s*/g, ' & ') };
    });
    return map;
  }
  function istBefuellt(details) {
    var felder = details.querySelectorAll('input:not([type=hidden]), textarea');
    for (var i = 0; i < felder.length; i++) {
      var f = felder[i];
      if (f.type === 'checkbox' || f.type === 'radio') { if (f.checked) return true; }
      else if (String(f.value).trim() !== '') return true;
    }
    return false;
  }
  function buildModNav() {
    var host = $('verlauf-assessment');
    if (!host || $('ui-modnav')) return;
    var mods = moduleDetails();
    if (!Object.keys(mods).length) return;
    var nav = el('div', { id: 'ui-modnav', class: 'ui-modnav', role: 'navigation', 'aria-label': 'Assessment-Module' });
    var top = el('div', { class: 'ui-modnav-top' });
    top.appendChild(el('b', null, 'Assessment-Module · Sprung zum Abschnitt'));
    var tools = el('div');
    var openAll = el('button', { type: 'button', class: 'ui-mod-mini' }, 'Alle öffnen');
    var closeAll = el('button', { type: 'button', class: 'ui-mod-mini' }, 'Alle schließen');
    openAll.addEventListener('click', function () { setAll(true); });
    closeAll.addEventListener('click', function () { setAll(false); });
    tools.appendChild(openAll); tools.appendChild(closeAll); top.appendChild(tools); nav.appendChild(top);
    var groups = el('div', { class: 'ui-modnav-groups' });
    MODUL_GRUPPEN.forEach(function (g) { groups.appendChild(buildGroup(g, mods)); });
    nav.appendChild(groups);
    host.insertBefore(nav, host.firstChild);
    Object.keys(mods).forEach(function (n) { mods[n].details.addEventListener('toggle', syncChips); });
    markModules();
  }
  function buildGroup(g, mods) {
    var wrap = el('div', { class: 'ui-modnav-group' });
    wrap.appendChild(el('span', null, g.label));
    var chips = el('div', { class: 'ui-modnav-chips' });
    g.module.forEach(function (n) {
      if (!mods[n]) return;
      var b = el('button', { type: 'button', class: 'ui-mod', 'data-mod': String(n), 'aria-expanded': 'false' });
      b.appendChild(el('i', { 'aria-hidden': 'true' }, String(n)));
      b.appendChild(document.createTextNode(mods[n].titel.split('/')[0].split(' — ')[0]));
      b.addEventListener('click', function () { jumpTo(n); });
      chips.appendChild(b);
    });
    wrap.appendChild(chips);
    return wrap;
  }
  function jumpTo(n) {
    var m = moduleDetails()[n];
    if (!m) return;
    m.details.open = true;
    m.details.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var s = m.details.querySelector('summary');
    if (s) s.focus({ preventScroll: true });
  }
  function setAll(open) {
    var mods = moduleDetails();
    Object.keys(mods).forEach(function (n) { mods[n].details.open = open; });
  }
  function syncChips() {
    var mods = moduleDetails();
    document.querySelectorAll('#ui-modnav .ui-mod').forEach(function (b) {
      var m = mods[b.getAttribute('data-mod')];
      b.setAttribute('aria-expanded', m && m.details.open ? 'true' : 'false');
    });
  }
  function markModules() {
    var mods = moduleDetails();
    document.querySelectorAll('#ui-modnav .ui-mod').forEach(function (b) {
      var m = mods[b.getAttribute('data-mod')], filled = !!(m && istBefuellt(m.details));
      b.classList.toggle('is-filled', filled);
      b.setAttribute('title', filled ? 'Einträge vorhanden' : 'Noch keine Einträge');
    });
    syncChips();
  }

  // ---------- SIS: Fortschritt je Themenfeld ----------
  function markSis() {
    var form = $('sis-tf-form');
    if (!form) return;
    Array.prototype.forEach.call(form.children, function (d) {
      if (d.tagName !== 'DETAILS') return;
      var felder = d.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select');
      if (!felder.length) return;
      var voll = 0;
      felder.forEach(function (f) { if (String(f.value).trim() !== '') voll++; });
      var sum = d.querySelector('summary'), badge = sum && sum.querySelector('.ui-mod-state');
      if (!sum) return;
      if (!badge) { badge = el('span', { class: 'ui-mod-state' }); sum.appendChild(badge); }
      badge.textContent = voll + '/' + felder.length + ' ausgefüllt';
    });
  }

  // ---------- Bedienung ----------
  function onClick(e) {
    var t = e.target.closest('[data-ui-open-today], #ui-tab-mehr');
    if (!t) return;
    if (t.id === 'ui-tab-mehr') {
      var toggle = $('ae-menu-toggle');
      if (toggle) toggle.click();
      t.setAttribute('aria-expanded', toggle ? toggle.getAttribute('aria-expanded') || 'true' : 'false');
      return;
    }
    var a = api();
    if (a) a.tagOeffnen(a.heuteIso());
  }
  // Erzwungenes Update (Update-Hinweis): Caches leeren, Service Worker aktualisieren, frisch laden.
  // Die Pflegedaten liegen verschlüsselt im localStorage und bleiben unberührt.
  window.aerisHardUpdate = function () {
    var jobs = [];
    if (window.caches && caches.keys) jobs.push(caches.keys().then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); }));
    if ('serviceWorker' in navigator) jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) { return Promise.all(regs.map(function (r) { return r.update().catch(function () { return null; }); })); }));
    Promise.all(jobs).catch(function () { return null; }).then(function () { location.replace(location.pathname + '?neu=' + Date.now()); });
  };
  function debounce(fn, ms) { var h = 0; return function () { clearTimeout(h); h = setTimeout(fn, ms); }; }

  function boot() {
    if (/[?&]neu=/.test(location.search) && history.replaceState) history.replaceState(null, '', location.pathname + location.hash);
    document.addEventListener('click', onClick);
    document.addEventListener('aeris:heute-gerendert', refresh);
    document.addEventListener('aeris:gespeichert', refresh);
    var lazy = debounce(function () { markModules(); markSis(); }, 250);
    ['verlauf', 'sis'].forEach(function (id) {
      var sec = $(id);
      if (sec) { sec.addEventListener('input', lazy); sec.addEventListener('change', lazy); }
    });
    var panel = $('verlauf-day-panel');
    if (panel) new MutationObserver(lazy).observe(panel, { attributes: true, attributeFilter: ['class'] });
    buildModNav();
    renderHead();
    setInterval(renderHead, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
