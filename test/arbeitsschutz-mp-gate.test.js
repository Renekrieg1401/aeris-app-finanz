// audit-arbeitsschutz-medizinprodukte (2026-11-01): Playwright-Regressionstests für die neuen
// UI-Elemente aus KRITISCH 1 (STK/MTK-Plausibilität + Fälligkeits-Warnhinweis), WICHTIG 3
// (Gefährdungsbeurteilung), WICHTIG 4 (generische Einweisungsprüfung) und WICHTIG 5
// (Nadelstich-/Expositionsvorfall). Läuft gegen die echte, unveränderte Oberfläche (kein Mock),
// identisches Infrastruktur-Muster wie test/frontend.test.js.
var test = require('node:test');
var assert = require('node:assert/strict');
var path = require('node:path');
var { chromium } = require('playwright');
var { starteStaticServer } = require('./helpers/static-server');
var { setupLocalPin, gotoView } = require('./helpers/doku-flow');

var ROOT = path.join(__dirname, '..');
var server, browser;

test.before(async function () { server = await starteStaticServer(ROOT); browser = await chromium.launch(); });
test.after(async function () { await browser.close(); await server.stoppen(); });

async function neueSeite() {
  var context = await browser.newContext();
  var page = await context.newPage();
  var consoleErrors = [];
  page.on('pageerror', function (e) { consoleErrors.push(e.message); });
  return { context: context, page: page, consoleErrors: consoleErrors, schliessen: function () { return context.close(); } };
}

async function mpGeraetAnlegen(page, bezeichnung) {
  await gotoView(page, '#medizinprodukte');
  await page.waitForSelector('#mp-geraet-form');
  await page.fill('#mp-geraet-bezeichnung', bezeichnung);
  await page.click('#mp-geraet-form button[type=submit]');
  await page.waitForFunction(function () {
    return document.getElementById('mp-geraet-auswahl').options.length > 0;
  });
}

test('KRITISCH 1a: STK-Fälligkeit >2 Jahre löst Plausibilitäts-confirm() aus, Speichern erst nach Bestätigung', async function () {
  var s = await neueSeite();
  try {
    await setupLocalPin(s.page, server.basis, '491823');
    await mpGeraetAnlegen(s.page, 'Beatmungsgerät Trilogy TEST');

    var dialogMessages = [];
    s.page.on('dialog', function (d) { dialogMessages.push(d.message()); d.accept(); });

    await s.page.selectOption('#mp-eintrag-typ', 'stk');
    await s.page.fill('#mp-eintrag-datum', '2026-01-01');
    await s.page.fill('#mp-eintrag-person', 'Prüffirma Test');
    await s.page.fill('#mp-eintrag-detail', 'bestanden');
    await s.page.fill('#mp-eintrag-faelligkeit', '2030-01-01'); // 4 Jahre, über der STK-2-Jahres-Obergrenze
    await s.page.click('#mp-eintrag-form button[type=submit]');
    await s.page.waitForTimeout(300);

    assert.equal(dialogMessages.length, 1, 'genau ein Plausibilitäts-confirm() muss ausgelöst worden sein');
    assert.match(dialogMessages[0], /STK.*2 Jahre|gesetzliche Obergrenze/i, 'Hinweistext muss die STK-Obergrenze benennen');

    var eintragGespeichert = await s.page.evaluate(function () {
      return document.getElementById('mp-eintraege-liste').textContent.indexOf('2030-01-01') !== -1;
    });
    assert.equal(eintragGespeichert, true, 'nach Bestätigung muss der Eintrag trotzdem gespeichert werden (kein Hard-Block)');
    assert.deepEqual(s.consoleErrors, [], 'keine Konsolenfehler');
  } finally { await s.schliessen(); }
});

test('KRITISCH 1a: plausible STK-Fälligkeit (<=2 Jahre) löst KEIN confirm() aus', async function () {
  var s = await neueSeite();
  try {
    await setupLocalPin(s.page, server.basis, '582917');
    await mpGeraetAnlegen(s.page, 'Perfusor TEST');

    var dialogCount = 0;
    s.page.on('dialog', function (d) { dialogCount++; d.accept(); });

    await s.page.selectOption('#mp-eintrag-typ', 'stk');
    await s.page.fill('#mp-eintrag-datum', '2026-01-01');
    await s.page.fill('#mp-eintrag-person', 'Prüffirma Test');
    await s.page.fill('#mp-eintrag-detail', 'bestanden');
    await s.page.fill('#mp-eintrag-faelligkeit', '2027-06-01'); // ~1,4 Jahre, plausibel
    await s.page.click('#mp-eintrag-form button[type=submit]');
    await s.page.waitForTimeout(300);

    assert.equal(dialogCount, 0, 'eine plausible Frist darf kein confirm() auslösen');
    var eintragGespeichert = await s.page.evaluate(function () {
      return document.getElementById('mp-eintraege-liste').textContent.indexOf('2027-06-01') !== -1;
    });
    assert.equal(eintragGespeichert, true, 'plausibler Eintrag muss direkt gespeichert werden');
  } finally { await s.schliessen(); }
});

test('KRITISCH 1b: überfällige STK/MTK erzeugt nicht-blockierenden Warnhinweis in der Heute-Beatmungsdokumentation', async function () {
  var s = await neueSeite();
  try {
    await setupLocalPin(s.page, server.basis, '673920');
    await mpGeraetAnlegen(s.page, 'Beatmungsgerät Astral TEST');

    s.page.on('dialog', function (d) { d.accept(); });
    await s.page.selectOption('#mp-eintrag-typ', 'stk');
    await s.page.fill('#mp-eintrag-datum', '2020-01-01');
    await s.page.fill('#mp-eintrag-person', 'Prüffirma Test');
    await s.page.fill('#mp-eintrag-detail', 'bestanden');
    await s.page.fill('#mp-eintrag-faelligkeit', '2022-01-01'); // liegt in der Vergangenheit -> überfällig
    await s.page.click('#mp-eintrag-form button[type=submit]');
    await s.page.waitForTimeout(300);

    // Heute-Assessment öffnen (Beatmung ist Abschnitt 1, direkt sichtbar ohne Maßnahme-Overlay in "Heute").
    await gotoView(s.page, '#heute');
    await s.page.waitForSelector('#heute-geraete-faelligkeit-warnung', { state: 'attached' });
    await s.page.waitForFunction(function () {
      var el = document.getElementById('heute-geraete-faelligkeit-warnung');
      return el && !el.classList.contains('ae-hidden');
    }, { timeout: 5000 });
    var text = await s.page.textContent('#heute-geraete-faelligkeit-warnung');
    assert.match(text, /überfällige STK\/MTK/i);
    assert.match(text, /Beatmungsgerät Astral TEST/);
    assert.match(text, /kein Block/i, 'Hinweis muss explizit als nicht-blockierend formuliert sein');
  } finally { await s.schliessen(); }
});

test('WICHTIG 4: generische Einweisungsprüfung erfasst JEDES Gerätetyp, nicht nur "Beatmungsgerät"', async function () {
  var s = await neueSeite();
  try {
    await setupLocalPin(s.page, server.basis, '759312');
    await mpGeraetAnlegen(s.page, 'Pulsoxymeter TEST'); // bewusst KEIN Beatmungsgerät/Respirator im Namen

    await gotoView(s.page, '#verlauf');
    await s.page.waitForSelector('#verlauf-cal-grid button');
    var heute = new Date().toISOString().slice(0, 10);
    await s.page.evaluate(function (iso) {
      var cal = document.querySelector('[data-date="' + iso + '"]');
      if (cal) cal.click();
    }, heute);
    // openVerlaufDay() setzt die PFK automatisch auf AE.settings.pfks[0] ('RK') und ruft
    // renderAssessmentForm() -> aePrüfeGeraeteEinweisung() bereits beim Öffnen auf.
    await s.page.waitForSelector('#verlauf-day-panel:not(.ae-hidden)');
    await s.page.waitForFunction(function () {
      var el = document.getElementById('verlauf-geraete-einweisung-warnung');
      return el && !el.classList.contains('ae-hidden');
    }, { timeout: 5000 });
    var text = await s.page.textContent('#verlauf-geraete-einweisung-warnung');
    assert.match(text, /Pulsoxymeter TEST/, 'Warnhinweis muss ein NICHT-Beatmungsgerät generisch erfassen');
  } finally { await s.schliessen(); }
});

test('WICHTIG 3: Gefährdungsbeurteilung — Eintrag mit Unterschrift-Hash wird gespeichert', async function () {
  var s = await neueSeite();
  try {
    await setupLocalPin(s.page, server.basis, '814627');
    await gotoView(s.page, '#arbeitsschutz');
    await s.page.waitForSelector('#gb-form');

    await s.page.click('#gb-sig-btn');
    await s.page.waitForSelector('#ae-sig-canvas');
    var box = await s.page.locator('#ae-sig-canvas').boundingBox();
    await s.page.mouse.move(box.x + 10, box.y + 10);
    await s.page.mouse.down();
    await s.page.mouse.move(box.x + 120, box.y + 90, { steps: 15 });
    await s.page.mouse.up();
    await s.page.click('#ae-sig-add');
    await s.page.waitForFunction(function () {
      return document.getElementById('gb-sig-status').textContent.indexOf('✓') !== -1;
    });

    await s.page.fill('#gb-einsatzort', 'Wohnung Klient Test, Beatmungszimmer');
    await s.page.fill('#gb-pruefdatum', '2026-11-01');
    await s.page.fill('#gb-person', 'Test-PFK');
    await s.page.click('#gb-form button[type=submit]');
    await s.page.waitForTimeout(200);

    var listeText = await s.page.textContent('#gb-liste');
    assert.match(listeText, /Wohnung Klient Test/);
    assert.match(listeText, /✓ /, 'Unterschrift-Hash muss als "✓ <hash-kürzel>" sichtbar sein');
  } finally { await s.schliessen(); }
});

test('WICHTIG-3-Gegenprüfung: Hygieneplan je Einsatzort — Checkliste + Unterschrift werden gespeichert', async function () {
  var s = await neueSeite();
  try {
    await setupLocalPin(s.page, server.basis, '539817');
    await gotoView(s.page, '#arbeitsschutz');
    await s.page.waitForSelector('#hyg-form');

    await s.page.check('#hyg-chk-haende');
    await s.page.check('#hyg-chk-flaeche');
    await s.page.check('#hyg-chk-abwurf');
    // #hyg-chk-psa bewusst NICHT gesetzt -- prüft, dass die Zähler-Anzeige (3/4) tatsächlich
    // nur die angekreuzten Punkte zählt, nicht pauschal "vollständig" meldet.

    await s.page.click('#hyg-sig-btn');
    await s.page.waitForSelector('#ae-sig-canvas');
    var box = await s.page.locator('#ae-sig-canvas').boundingBox();
    await s.page.mouse.move(box.x + 10, box.y + 10);
    await s.page.mouse.down();
    await s.page.mouse.move(box.x + 120, box.y + 90, { steps: 15 });
    await s.page.mouse.up();
    await s.page.click('#ae-sig-add');
    await s.page.waitForFunction(function () {
      return document.getElementById('hyg-sig-status').textContent.indexOf('✓') !== -1;
    });

    await s.page.fill('#hyg-einsatzort', 'Wohnung Klient Test, Hygieneplan');
    await s.page.fill('#hyg-erstellung', '2026-11-01');
    await s.page.fill('#hyg-person', 'Test-PFK Hygiene');
    await s.page.click('#hyg-form button[type=submit]');
    await s.page.waitForTimeout(200);

    var listeText = await s.page.textContent('#hyg-liste');
    assert.match(listeText, /Wohnung Klient Test, Hygieneplan/);
    assert.match(listeText, /3\/4/, 'Checkliste muss exakt die 3 angekreuzten von 4 Punkten zeigen');
    assert.match(listeText, /✓ /, 'Unterschrift-Hash muss als "✓ <hash-kürzel>" sichtbar sein');

    // Reload + Re-Login beweist echte Verschlüsselungs-Persistenz (nicht nur In-Memory-Render).
    await s.page.reload();
    await s.page.waitForSelector('#ae-pin-input');
    await s.page.fill('#ae-pin-input', '539817');
    await s.page.click('#ae-pin-submit');
    await s.page.waitForFunction(function () {
      return document.getElementById('ae-pin-gate').classList.contains('ae-legal-hidden');
    }, { timeout: 10000 });
    await gotoView(s.page, '#arbeitsschutz');
    await s.page.waitForSelector('#hyg-liste');
    var nachReload = await s.page.textContent('#hyg-liste');
    assert.match(nachReload, /Wohnung Klient Test, Hygieneplan/, 'Eintrag muss verschlüsselt persistiert worden sein und nach Reload+Re-Login weiterhin sichtbar sein');
  } finally { await s.schliessen(); }
});

test('WICHTIG 5: Nadelstich-/Expositionsvorfall wird erfasst', async function () {
  var s = await neueSeite();
  try {
    await setupLocalPin(s.page, server.basis, '926318');
    await gotoView(s.page, '#arbeitsschutz');
    await s.page.waitForSelector('#nsv-form');

    await s.page.fill('#nsv-wer', 'Test-PFK Nadelstich');
    await s.page.fill('#nsv-datum', '2026-11-01');
    await s.page.fill('#nsv-uhrzeit', '14:30');
    await s.page.fill('#nsv-instrument', 'Injektionsnadel');
    await s.page.fill('#nsv-erstversorgung', 'Wunde ausbluten lassen, desinfiziert');
    await s.page.check('#nsv-darzt');
    await s.page.click('#nsv-form button[type=submit]');
    await s.page.waitForTimeout(200);

    var listeText = await s.page.textContent('#nsv-liste');
    assert.match(listeText, /Test-PFK Nadelstich/);
    assert.match(listeText, /Injektionsnadel/);
    assert.match(listeText, /Ja/, 'D-Arzt-Meldung muss als "Ja" angezeigt werden');
    assert.deepEqual(s.consoleErrors, [], 'keine Konsolenfehler');
  } finally { await s.schliessen(); }
});
