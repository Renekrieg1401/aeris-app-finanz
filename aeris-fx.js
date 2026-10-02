/* =====================================================================================
   AERIS FX — Licht- & 3D-Motor für AERIS Dokumentation (reine Darstellung)
   Greift NICHT in Daten, Speicherung oder Logik von app.js ein. Gleiche Lichtquelle
   und gleiche Effekt-Einstellung ('ae-finanz-fx') wie AERIS Buch.
   ===================================================================================== */
(function () {
  'use strict';

  var KEY_FX = 'ae-finanz-fx';
  var FX_STUFEN = ['voll', 'reduziert', 'aus'];
  var FX_LABEL = { voll: 'Voll', reduziert: 'Ruhig', aus: 'Aus' };
  var root = document.documentElement;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function readFx() {
    var v = null;
    try { v = localStorage.getItem(KEY_FX); } catch (e) { v = null; }
    return FX_STUFEN.indexOf(v) !== -1 ? v : 'voll';
  }
  function applyFx(v) {
    var fx = FX_STUFEN.indexOf(v) !== -1 ? v : 'voll';
    root.setAttribute('data-fx', fx);
    try { localStorage.setItem(KEY_FX, fx); } catch (e) { return; }
    if (fx !== 'voll') Light.reset();
  }
  function active() { return !reduce.matches && root.getAttribute('data-fx') === 'voll'; }

  // ---------- Lichtquelle ----------
  var Light = (function () {
    var BASE = { x: -0.6, y: -0.8 }, cur = { x: BASE.x, y: BASE.y }, target = { x: BASE.x, y: BASE.y }, raf = 0;
    function clamp(v) { return Math.max(-1, Math.min(1, v)); }
    function step() {
      cur.x += (target.x - cur.x) * 0.12; cur.y += (target.y - cur.y) * 0.12;
      root.style.setProperty('--lx', cur.x.toFixed(3)); root.style.setProperty('--ly', cur.y.toFixed(3));
      raf = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.004 ? requestAnimationFrame(step) : 0;
    }
    function aim(x, y) { target.x = clamp(x); target.y = clamp(y); if (!raf) raf = requestAnimationFrame(step); }
    function reset() { aim(BASE.x, BASE.y); }
    function init() {
      window.addEventListener('pointermove', function (e) {
        if (!active() || !fine.matches) return;
        aim(BASE.x * 0.4 + (e.clientX / window.innerWidth - 0.5) * 1.4, BASE.y * 0.4 + (e.clientY / window.innerHeight - 0.5) * 1.4);
      }, { passive: true });
      root.addEventListener('pointerleave', reset);
      if ('DeviceOrientationEvent' in window && typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
        window.addEventListener('deviceorientation', function (e) {
          if (!active() || fine.matches || e.gamma === null) return;
          aim(BASE.x * 0.5 - e.gamma / 60, BASE.y * 0.5 - (e.beta - 45) / 60);
        }, { passive: true });
      }
    }
    return { init: init, reset: reset };
  })();

  // ---------- Glanzlicht & 3D-Neigung je Karte ----------
  var CONTROLS = 'button,input,select,textarea,a,label,summary,canvas';
  function onMove(e) {
    var el = e.currentTarget;
    if (!active() || !fine.matches) return;
    var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    el.style.setProperty('--glow', '1');
    if (!el.classList.contains('fx-tilt') || (e.target.closest && e.target.closest(CONTROLS))) return;
    var amp = el.offsetWidth > 560 ? 2 : 5;
    el.classList.add('is-tracking');
    el.style.setProperty('--ry', ((px - 0.5) * amp).toFixed(2) + 'deg');
    el.style.setProperty('--rx', ((0.5 - py) * amp).toFixed(2) + 'deg');
  }
  function onLeave(e) {
    var el = e.currentTarget;
    el.classList.remove('is-tracking');
    ['--rx', '--ry', '--mx', '--my', '--glow'].forEach(function (p) { el.style.removeProperty(p); });
  }
  function bindCard(el) {
    if (el.hasAttribute('data-fx-bound')) return;
    el.setAttribute('data-fx-bound', '');
    if (!el.querySelector('input,select,textarea,canvas') && !el.closest('.ae-card .ae-card')) el.classList.add('fx-tilt');
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
  }
  function bindAll() { document.querySelectorAll('.ae-card').forEach(bindCard); }
  function observe() {
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; bindAll(); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ---------- Effekt-Einstellung in „Einstellungen“ ----------
  function buildSettingsCard() {
    var section = document.getElementById('einstellungen');
    if (!section || document.getElementById('fx-settings')) return;
    var card = document.createElement('div');
    card.id = 'fx-settings';
    card.className = 'ae-card p-5 md:p-6 max-w-2xl mx-auto mb-8';
    var h3 = document.createElement('h3');
    h3.className = 'font-bold text-base mb-2 text-white';
    h3.id = 'fx-settings-title';
    h3.textContent = 'Licht- & 3D-Effekte';
    var p = document.createElement('p');
    p.className = 'text-[#9CADC9] text-sm mb-3';
    p.textContent = 'Gilt für AERIS Doku und AERIS Buch auf diesem Gerät. „Ruhig“ behält das Design, ohne Bewegung.';
    var seg = document.createElement('div');
    seg.className = 'fx-segment';
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-labelledby', 'fx-settings-title');
    FX_STUFEN.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('data-fx-val', v); b.textContent = FX_LABEL[v];
      seg.appendChild(b);
    });
    card.appendChild(h3); card.appendChild(p); card.appendChild(seg);
    var anchor = document.getElementById('ae-storage-indicator');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling); else section.appendChild(card);
    bindSegment(seg);
  }
  function syncSegment(seg) {
    var cur = root.getAttribute('data-fx');
    seg.querySelectorAll('[data-fx-val]').forEach(function (b) {
      var on = b.getAttribute('data-fx-val') === cur;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
  }
  function bindSegment(seg) {
    var btns = Array.prototype.slice.call(seg.querySelectorAll('[data-fx-val]'));
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { applyFx(b.getAttribute('data-fx-val')); syncSegment(seg); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = btns[(i + d + btns.length) % btns.length];
        applyFx(n.getAttribute('data-fx-val')); syncSegment(seg); n.focus();
      });
    });
    syncSegment(seg);
  }

  function boot() {
    root.setAttribute('data-fx', readFx());
    Light.init();
    bindAll();
    observe();
    buildSettingsCard();
    window.addEventListener('storage', function (e) {
      if (e.key !== KEY_FX) return;
      root.setAttribute('data-fx', readFx());
      var seg = document.querySelector('#fx-settings .fx-segment');
      if (seg) syncSegment(seg);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
