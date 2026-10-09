/* =====================================================================================
   AERIS Login — gleiches Entsperr-Erlebnis wie AERIS Buch (3D-Münze, Ziffernblock, Punkte)
   Reine Bedienoberfläche über der bestehenden PIN-Sperre aus app.js (aePinGateStart):
   Modi 'unlock' / 'relock' / 'setup' / 'migrate', Krypto und Speicherung bleiben unverändert.
   Die Ziffern werden in die vorhandenen Felder #ae-pin-input bzw. #ae-pin-confirm geschrieben;
   abgeschickt wird über das vorhandene Formular. Bei Ersteinrichtung/Migration führt der
   Ziffernblock in zwei Schritten (PIN festlegen → PIN wiederholen).
   ===================================================================================== */
(function () {
  'use strict';

  var gate, form, pin, confirm, confirmWrap, note, submit, dots, stepLabel, target;

  function $(id) { return document.getElementById(id); }
  function needsConfirm() { return confirmWrap && !confirmWrap.classList.contains('ae-hidden'); }
  // René-Direktive 2026-10-09: neue PINs müssen genau 6 Ziffern haben (kein 4-5-stelliges Wahlrecht
  // mehr) -- diese Funktion gilt nur für den 2-Schritt-Einrichtungs-/Migrations-Guard (needsConfirm()),
  // nicht für das Entsperren einer bereits bestehenden, evtl. kürzeren PIN (s. app.js Submit-Handler).
  function valid(v) { return /^\d{6}$/.test(v); }

  function renderDots() {
    var len = target.value.length;
    dots.replaceChildren();
    for (var i = 0; i < 6; i++) {
      var d = document.createElement('span');
      d.className = 'ui-pin-dot' + (i < len ? ' is-filled' : '');
      dots.appendChild(d);
    }
    if (!needsConfirm()) { stepLabel.textContent = 'PIN eingeben'; return; }
    stepLabel.textContent = target === pin ? 'Schritt 1 von 2 · neue PIN festlegen' : 'Schritt 2 von 2 · PIN wiederholen';
  }
  function setTarget(el) {
    target = el;
    gate.classList.toggle('is-confirm-step', el === confirm);
    renderDots();
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }
  function reset() {
    pin.value = '';
    if (confirm) confirm.value = '';
    setTarget(pin);
  }
  function shake() {
    var card = gate.querySelector('.ae-card');
    if (!card) return;
    card.classList.remove('ui-shake'); void card.offsetWidth; card.classList.add('ui-shake');
  }

  function onKey(e) {
    var k = e.currentTarget.getAttribute('data-key');
    if (k === 'ok') return;
    if (k === 'del') target.value = target.value.slice(0, -1);
    else if (target.value.length < 6) target.value += k;
    renderDots();
  }
  function buildKeypad() {
    var pad = document.createElement('div');
    pad.className = 'ui-keypad';
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', 'Ziffernblock');
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].forEach(function (k) {
      var b = document.createElement('button');
      b.type = k === 'ok' ? 'submit' : 'button';
      b.className = 'ui-key';
      b.setAttribute('data-key', k);
      b.setAttribute('aria-label', k === 'del' ? 'Letzte Ziffer löschen' : k === 'ok' ? 'Weiter' : 'Ziffer ' + k);
      b.textContent = k === 'del' ? '⌫' : k === 'ok' ? '→' : k;
      b.addEventListener('click', onKey);
      pad.appendChild(b);
    });
    return pad;
  }

  // Zwei-Schritt-Führung: Abschicken mit leerer Bestätigung wechselt zu Schritt 2, statt
  // in app.js als "stimmt nicht überein" zu scheitern. Läuft in der Capture-Phase vor app.js.
  function onSubmitCapture(e) {
    if (e.target !== form) return;
    if (needsConfirm() && target === pin) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!valid(pin.value)) { showLocal('Bitte eine PIN aus genau 6 Ziffern eingeben.'); return; }
      showLocal('');
      setTarget(confirm);
    }
  }
  function showLocal(msg) {
    note.textContent = msg;
    note.classList.toggle('ae-inline-note--visible', !!msg);
    if (msg) shake();
  }

  function watch() {
    // Fehlermeldungen aus app.js → schütteln, Eingabe zurücksetzen
    new MutationObserver(function () {
      var msg = note.textContent.trim();
      if (!msg || submit.disabled) return;
      if (/Falsche PIN|stimmen nicht überein|4–6 Ziffern|genau 6 Ziffern/.test(msg)) { shake(); reset(); }
    }).observe(note, { childList: true, characterData: true, subtree: true });
    // Gate erneut sichtbar (Sperre beim Verlassen) → frischer Start
    new MutationObserver(function () {
      if (!gate.classList.contains('ae-legal-hidden')) reset();
    }).observe(gate, { attributes: true, attributeFilter: ['class'] });
    // Moduswechsel (Bestätigungsfeld ein/aus) → Anzeige aktualisieren
    new MutationObserver(function () { setTarget(pin); }).observe(confirmWrap, { attributes: true, attributeFilter: ['class'] });
    [pin, confirm].forEach(function (f) {
      f.addEventListener('input', function () { f.value = f.value.replace(/\D/g, '').slice(0, 6); renderDots(); });
      // Echter UX-Fund (2026-10-09, im Rahmen der 6-Ziffern-Pflicht entdeckt): der Schritt-1→2-
      // Wechsel läuft NICHT über das 'submit'-Event (das Pflichtfeld "confirm" ist bei leerem Wert
      // immer ungültig, native Validierung verhindert 'submit' dadurch komplett) -- stattdessen
      // fokussiert der Browser bei blockierter Submission automatisch das erste ungültige Pflichtfeld
      // (hier: confirm), und DIESER Fokus-Handler entscheidet, ob er den Fokus akzeptiert (PIN gültig
      // -> Schritt 2) oder stumm zu PIN zurückspringt (PIN ungültig). Bisher ganz ohne Hinweistext --
      // bei der alten 4-6-stelligen Bandbreite kaum relevant, bei der neuen Pflicht-6 (z.B. jemand
      // tippt gewohnheitsmäßig 4 Ziffern) jetzt spürbar: Nutzer tippt weiter, nichts passiert, kein
      // Hinweis warum. Jetzt mit sichtbarer Fehlermeldung beim Zurückspringen.
      f.addEventListener('focus', function () {
        if (f === confirm && !valid(pin.value)) { showLocal('Bitte eine PIN aus genau 6 Ziffern eingeben.'); setTarget(pin); return; }
        target = f; renderDots();
      });
    });
  }

  function boot() {
    gate = $('ae-pin-gate'); form = $('ae-pin-form'); pin = $('ae-pin-input'); confirm = $('ae-pin-confirm');
    confirmWrap = $('ae-pin-confirm-wrap'); note = $('ae-pin-note'); submit = $('ae-pin-submit');
    if (!gate || !form || !pin || !confirm || !confirmWrap || !note || !submit) return;
    gate.classList.add('ui-login');
    stepLabel = document.createElement('p');
    stepLabel.className = 'ui-pin-step';
    stepLabel.setAttribute('aria-live', 'polite');
    dots = document.createElement('div');
    dots.className = 'ui-pin-dots';
    dots.setAttribute('aria-hidden', 'true');
    form.insertBefore(dots, form.firstChild);
    form.insertBefore(stepLabel, dots);
    form.insertBefore(buildKeypad(), note);
    document.addEventListener('submit', onSubmitCapture, true);
    watch();
    target = pin;
    renderDots();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
