// Wiederverwendbare UI-Flows fuer AERIS Dokumentation (Root-App, app.js) -- alle Geschaeftslogik-
// Funktionen (aeBtmEintragHinzufuegen, updateAssessComputed, renderMp, ...) sitzen in einer
// geschlossenen IIFE ohne window-Export (s. Projekte/aeris/CLAUDE.md "Formular-Submit-Handler fuer
// neue Module ... sitzen jeweils in einer Closure, NICHT global erreichbar"). Deshalb treibt diese
// Suite ausschliesslich die ECHTE, bereits live verifizierte Oberflaeche an -- keine Mocks, keine
// Re-Implementierung der getesteten Logik.

async function resetLocalStorage(page) {
  await page.evaluate(async function () {
    localStorage.clear();
    var dbs = await indexedDB.databases();
    await Promise.all(dbs.map(function (d) {
      return new Promise(function (res) {
        var r = indexedDB.deleteDatabase(d.name);
        r.onsuccess = res; r.onerror = res; r.onblocked = res;
      });
    }));
  });
}

// Lokaler Erststart + PIN-Vergabe (kein Server-/Team-Modus -- der ist seit 2026-10-18 nicht mehr
// Default, s. app.js aePinGateStart()-Kommentar). pin: 6 Ziffern, nicht trivial (aePinIstTrivial()).
async function setupLocalPin(page, basisUrl, pin) {
  await page.goto(basisUrl + '/index.html');
  await resetLocalStorage(page);
  await page.reload();
  await page.waitForSelector('#ae-pin-input');
  await page.fill('#ae-pin-input', pin);
  var confirmVisible = await page.evaluate(function () {
    return !document.getElementById('ae-pin-confirm-wrap').classList.contains('ae-hidden');
  });
  if (confirmVisible) await page.fill('#ae-pin-confirm', pin);
  await page.click('#ae-pin-submit');
  // K5 2026-10-23: Ersteinrichtung zeigt jetzt zwingend das Recovery-Key-Einmal-Overlay, BEVOR
  // finishUnlock() das Pin-Gate ausblendet (s. app.js aeRecoveryKeyOverlayZeigen()) -- Checkbox
  // bestaetigen + "Weiter" klicken, sonst haengt der Testlauf hier fest.
  await page.waitForFunction(function () {
    return !document.getElementById('ae-recovery-overlay').classList.contains('ae-legal-hidden');
  }, { timeout: 10000 });
  await page.check('#ae-recovery-confirm-checkbox');
  await page.click('#ae-recovery-overlay-continue');
  await page.waitForFunction(function () {
    return document.getElementById('ae-pin-gate').classList.contains('ae-legal-hidden');
  }, { timeout: 10000 });
}

// SPA-Navigation ueber showView() -- direkter In-Page-Click statt page.click(selector), weil
// `a[href="#xyz"]` in dieser App an mehreren Stellen (Desktop-Sidebar + Mobile-Navigation) doppelt
// vorkommt (Playwright-Strict-Mode-Falle, s. testing-qa-Memory "AERIS Server-Modus -- Playwright-
// Fallstricke bei Multi-Instance-Nav-Links").
async function gotoView(page, hash) {
  await page.evaluate(function (h) {
    var a = document.querySelector('a[href="' + h + '"]');
    if (!a) throw new Error('Navlink nicht gefunden: ' + h);
    a.click();
  }, hash);
}

// Oeffnet den zweistufigen Maßnahme-/Assessment-Overlay-Flow (Schritt 1 -> Schritt 2) fuer ein
// Katalog-Label aus AE_ASSESS_MAPPING (app.js) -- einziger Weg, #heute-assessment ueberhaupt
// sichtbar zu machen (liegt hinter #ae-assess-overlay, ae-legal-hidden by default).
async function openAssessSection(page, massnahmeLabel) {
  await page.click('#qc-m-katalog-trigger');
  await page.waitForSelector('#ae-massnahme-overlay-list button');
  await page.evaluate(function (lbl) {
    var btn = Array.from(document.querySelectorAll('#ae-massnahme-overlay-list button'))
      .find(function (b) { return b.textContent.trim() === lbl; });
    if (!btn) throw new Error('Maßnahme-Button nicht gefunden: ' + lbl);
    btn.click();
  }, massnahmeLabel);
  await page.waitForFunction(function () {
    return !document.getElementById('ae-assess-overlay').classList.contains('ae-legal-hidden');
  });
}

module.exports = { resetLocalStorage, setupLocalPin, gotoView, openAssessSection };
