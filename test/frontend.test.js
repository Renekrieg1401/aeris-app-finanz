// Automatisierte Frontend-Testsuite fuer AERIS Doku + AERIS Buch (business-consultant-Audit
// 2026-10-23, K6 "Null automatisierte Frontend-Tests bei 628 KB Businesslogik" -- s. CLAUDE.md
// Nachtrag 2026-10-23). Beide PWAs sind Vanilla-JS ohne Build-Step, jede Geschaeftslogik-Funktion
// sitzt in einer geschlossenen IIFE ohne window-Export (s. test/helpers/doku-flow.js) -- deshalb
// laeuft diese Suite ueber einen echten Browser (Playwright/Chromium) gegen einen echten statischen
// Server, der die ECHTE index.html/app.js laedt und ausschliesslich ueber die reale Oberflaeche
// interagiert. Kein Mock, keine Re-Implementierung der getesteten Logik -- das waere ein Alibi-Test.
//
// Bewusster Scope (kein Anspruch auf vollstaendige 628-KB-Abdeckung, s. Auftrag): die Funktionen,
// bei denen ein stiller Fehler am teuersten waere, priorisiert nach Risiko:
//  1) BTM-Bestandsschutz (Nachtrag 2026-10-10 (5), KRITISCH: Bestand durfte nie negativ werden)
//  2) BTM-Hash-Kette inkl. der am 2026-10-23 neu ergaenzten chargenNr/verfallsdatum-Felder (K7)
//  3) renderMp()/renderMedizinprodukte()-Namenskollisions-Regression (Nachtrag 2026-10-10 (16):
//     SIS-Maßnahmenplan war durch eine Funktionsnamens-Kollision mit dem Medizinproduktebuch
//     ueber mehrere Arbeitstage unbemerkt kaputtgehen)
//  4) Braden-/NRS-2002-Cutoff-Werte (pflege-assessment-Fix 2026-10-23: Braden <=9, NRS-2002 >=3)
//  5) AERIS Buch: Rechnungsnummern-Vergabe fortlaufend/nie doppelt + DATEV-Freeze-Override
//     (Nachtrag 2026-10-23 "DATEV-Freeze-Divergenz")
//
// Start: `npm test` im Projekt-Root, oder `node --test test/frontend.test.js` direkt.
// Benoetigt `npx playwright install chromium` einmalig (s. .github/workflows/frontend-test.yml).

var test = require('node:test');
var assert = require('node:assert/strict');
var path = require('node:path');
var fs = require('node:fs');
var { chromium } = require('playwright');
var { starteStaticServer } = require('./helpers/static-server');
var { resetLocalStorage, setupLocalPin, gotoView, openAssessSection } = require('./helpers/doku-flow');

var ROOT = path.join(__dirname, '..');
var server, browser;

test.before(async function () {
  server = await starteStaticServer(ROOT);
  browser = await chromium.launch();
});
test.after(async function () {
  await browser.close();
  await server.stoppen();
});

async function neueSeite() {
  var context = await browser.newContext();
  var page = await context.newPage();
  page.on('dialog', function (d) { d.dismiss(); });
  var consoleErrors = [];
  page.on('pageerror', function (e) { consoleErrors.push(e.message); });
  return { context: context, page: page, consoleErrors: consoleErrors, schliessen: function () { return context.close(); } };
}

test('BTM: Bestand darf nie negativ werden (KRITISCH, Nachtrag 2026-10-10 (5)) + Hash-Kette inkl. Charge/Verfall intakt', async function () {
  var s = await neueSeite();
  try {
    await setupLocalPin(s.page, server.basis, '482917');
    await gotoView(s.page, '#btm');
    await s.page.waitForSelector('#btm-praeparat-form');

    await s.page.fill('#btm-praeparat-bezeichnung', 'Morphin 10mg/ml TEST');
    await s.page.fill('#btm-praeparat-wirkstoff', 'Morphin');
    await s.page.click('#btm-praeparat-form button[type=submit]');
    await s.page.waitForFunction(function () {
      var sel = document.getElementById('btm-praeparat-auswahl');
      return sel.options.length > 0 && sel.value !== '';
    });

    var letzterAlert = null;
    s.page.on('dialog', function (d) { letzterAlert = d.message(); });

    async function eintrag(typ, menge, extra) {
      extra = extra || {};
      await s.page.selectOption('#btm-eintrag-typ', typ);
      await s.page.fill('#btm-eintrag-menge', String(menge));
      await s.page.fill('#btm-eintrag-einheit', 'ml');
      await s.page.fill('#btm-eintrag-datum', '2026-06-01');
      await s.page.fill('#btm-eintrag-uhrzeit', '08:00');
      await s.page.fill('#btm-eintrag-gegenpart', typ === 'zugang' ? 'Test-Apotheke' : 'Test-Klient');
      if (typ === 'zugang') {
        await s.page.fill('#btm-eintrag-verordner', 'Dr. Test');
        await s.page.fill('#btm-eintrag-rezeptnr', 'RZ-1');
        if (extra.chargenNr) await s.page.fill('#btm-eintrag-chargennr', extra.chargenNr);
        if (extra.verfallsdatum) await s.page.fill('#btm-eintrag-verfallsdatum', extra.verfallsdatum);
      }
      await s.page.fill('#btm-eintrag-pflegekraft', 'Test-PFK');
      letzterAlert = null;
      await s.page.click('#btm-eintrag-form button[type=submit]');
      await s.page.waitForTimeout(250);
    }

    await eintrag('zugang', 100, { chargenNr: 'CH-TEST-01', verfallsdatum: '2027-01-01' });
    var bestandText = await s.page.textContent('#btm-praeparate-liste');
    assert.match(bestandText, /100,00/, 'Bestand nach Zugang 100 ml muss 100,00 sein');

    // KRITISCHER Regressionsfall (Nachtrag 2026-10-10 (5)): Abgang > Bestand MUSS abgelehnt werden,
    // Bestand darf sich dabei NICHT veraendern (fruehere Lebenswirklichkeit: Bestand sprang auf -99.899,00).
    await eintrag('abgang', 99999);
    assert.ok(letzterAlert && /übersteigt den aktuellen Bestand/.test(letzterAlert),
      'Überzugang muss mit klarer Fehlermeldung abgelehnt werden, erhalten: ' + letzterAlert);
    bestandText = await s.page.textContent('#btm-praeparate-liste');
    assert.match(bestandText, /100,00/, 'Bestand bleibt nach abgelehntem Überzugang bei 100,00 -- NIE negativ');

    // Menge 0 ebenfalls abgelehnt.
    await eintrag('abgang', 0);
    assert.ok(letzterAlert && /größer als 0/.test(letzterAlert), 'Menge=0 muss abgelehnt werden');

    // Gueltiger Abgang 5 ml -> 95,00.
    await eintrag('abgang', 5);
    bestandText = await s.page.textContent('#btm-praeparate-liste');
    assert.match(bestandText, /95,00/, 'Bestand nach gültigem Abgang 5 ml muss 95,00 sein');

    // Hash-Kette inkl. der neuen chargenNr/verfallsdatum-Felder (K7, 2026-10-23) muss intakt bleiben.
    await s.page.click('#btm-pruefen-btn');
    await s.page.waitForTimeout(400);
    var ketteText = await s.page.textContent('#btm-pruefen-ergebnis');
    assert.match(ketteText, /intakt/, 'Kettenprüfung muss "intakt" melden: ' + ketteText);
    var eintraegeText = await s.page.textContent('#btm-eintraege-liste');
    assert.match(eintraegeText, /CH-TEST-01/, 'Chargennummer muss in der Eintragsliste sichtbar sein');

    assert.deepEqual(s.consoleErrors, [], 'Keine unerwarteten JS-Fehler während des BTM-Flows');
  } finally {
    await s.schliessen();
  }
});

test('SIS-Maßnahmenplan/Medizinproduktebuch: keine Namenskollision wie in Nachtrag 2026-10-10 (16)', async function () {
  var src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  var anzahlRenderMp = (src.match(/function\s+renderMp\s*\(/g) || []).length;
  assert.equal(anzahlRenderMp, 1, 'Es darf genau EINE Definition von function renderMp( geben (gefunden: ' + anzahlRenderMp + ') -- zwei Definitionen desselben Namens im selben Scope ließen 2026-10-10 den SIS-Maßnahmenplan unbemerkt kaputtgehen');
  assert.match(src, /function\s+renderMedizinprodukte\s*\(/, 'function renderMedizinprodukte( muss als eigene, getrennte Funktion existieren');

  var s = await neueSeite();
  try {
    await setupLocalPin(s.page, server.basis, '482917');

    await gotoView(s.page, '#medizinprodukte');
    await s.page.waitForSelector('#mp-geraet-form');
    await s.page.fill('#mp-geraet-bezeichnung', 'Beatmungsgeraet TEST');
    await s.page.click('#mp-geraet-form button[type=submit]');
    await s.page.waitForFunction(function () { return document.getElementById('mp-geraet-auswahl').options.length > 0; });
    var mpListeNachAnlegen = await s.page.textContent('#mp-geraete-liste');
    assert.match(mpListeNachAnlegen, /Beatmungsgeraet TEST/, 'Medizinprodukt muss in #mp-geraete-liste erscheinen');

    await gotoView(s.page, '#sis');
    await s.page.click('[data-sis-tab="mp"]');
    await s.page.waitForFunction(function () { return !document.getElementById('sis-mp-panel').classList.contains('ae-hidden'); });
    var sisMpListVorher = await s.page.textContent('#sis-mp-list');
    assert.match(sisMpListVorher, /Neue Maßnahme/, 'SIS-Maßnahmenplan muss eigene "+ Neue Maßnahme"-Buttons rendern');
    assert.doesNotMatch(sisMpListVorher, /Beatmungsgeraet TEST/, 'SIS-Maßnahmenplan darf das Medizinprodukt NICHT zeigen (kein Daten-Crossover)');

    await s.page.click('#sis-mp-list [data-mp-add]');
    await s.page.waitForTimeout(150);
    var sisMpListNachher = await s.page.textContent('#sis-mp-list');
    assert.notEqual(sisMpListNachher, sisMpListVorher, 'addMpEntry() muss #sis-mp-list sichtbar veraendern (neue Maßnahme)');

    await gotoView(s.page, '#medizinprodukte');
    var mpListeDanach = await s.page.textContent('#mp-geraete-liste');
    assert.equal(mpListeDanach, mpListeNachAnlegen, '#mp-geraete-liste darf durch die SIS-Nutzung NICHT veraendert worden sein');
  } finally {
    await s.schliessen();
  }
});

test('Braden-Skala: Cutoff <=9 "sehr hohes Risiko" / Grenzwert 10 "hohes Risiko" (pflege-assessment-Fix 2026-10-23)', async function () {
  var s = await neueSeite();
  try {
    await setupLocalPin(s.page, server.basis, '482917');
    await gotoView(s.page, '#heute');
    await s.page.waitForSelector('#heute-assessment', { state: 'attached' });
    await openAssessSection(s.page, 'Dekubitusrisiko-Screening (Braden-Skala)');

    async function setBraden(sensorik, feucht, akt, mob, ernaehr, reibung) {
      await s.page.selectOption('#heute-assessment [data-af="dekubitus.sensorik"]', String(sensorik));
      await s.page.selectOption('#heute-assessment [data-af="dekubitus.feuchtigkeit"]', String(feucht));
      await s.page.selectOption('#heute-assessment [data-af="dekubitus.aktivitaet"]', String(akt));
      await s.page.selectOption('#heute-assessment [data-af="dekubitus.mobilitaet"]', String(mob));
      await s.page.selectOption('#heute-assessment [data-af="dekubitus.ernaehrungBraden"]', String(ernaehr));
      await s.page.selectOption('#heute-assessment [data-af="dekubitus.reibung"]', String(reibung));
      await s.page.waitForTimeout(150);
    }

    await setBraden(2, 2, 2, 1, 1, 1); // Summe 9
    assert.match(await s.page.textContent('#heute-braden-summe'), /^9 \//, 'Braden-Summe=9 muss "9 / 23" anzeigen');
    assert.match(await s.page.textContent('#heute-braden-hinweis'), /sehr hohes Risiko/, 'Summe=9 (<=9) muss "sehr hohes Risiko" ergeben');

    await setBraden(3, 2, 2, 1, 1, 1); // Summe 10
    var hinweis10 = await s.page.textContent('#heute-braden-hinweis');
    assert.match(hinweis10, /hohes Risiko/, 'Summe=10 muss "hohes Risiko" ergeben');
    assert.doesNotMatch(hinweis10, /sehr hohes Risiko/, 'Summe=10 darf NICHT mehr "sehr hohes Risiko" sein (Regressionsschutz für den exakten Grenzfall)');
  } finally {
    await s.schliessen();
  }
});

test('NRS-2002: Cutoff >=3 Ernährungsrisiko (pflege-assessment-Fix 2026-10-23)', async function () {
  var s = await neueSeite();
  try {
    await setupLocalPin(s.page, server.basis, '482917');
    await gotoView(s.page, '#heute');
    await s.page.waitForSelector('#heute-assessment', { state: 'attached' });
    await openAssessSection(s.page, 'Ernährungsscreening (NRS-2002)');

    await s.page.check('#heute-assessment [data-af="ernaehrung.schwerErkrankt"]');
    await s.page.selectOption('#heute-assessment [data-af="ernaehrung.beeintraechtigung"]', '1');
    await s.page.selectOption('#heute-assessment [data-af="ernaehrung.schwereErkrankung"]', '1');
    await s.page.waitForTimeout(150);
    assert.match(await s.page.textContent('#heute-nrs-summe'), /^2 \//, 'NRS-Summe=2 muss "2 / 7" anzeigen');
    assert.doesNotMatch(await s.page.getAttribute('#heute-nrs-summe', 'class'), /ae-assess-score--alert/, 'Summe=2 (<3) darf KEINE Alert-Klasse haben');

    await s.page.selectOption('#heute-assessment [data-af="ernaehrung.beeintraechtigung"]', '2');
    await s.page.waitForTimeout(150);
    assert.match(await s.page.textContent('#heute-nrs-summe'), /^3 \//, 'NRS-Summe=3 muss "3 / 7" anzeigen');
    assert.match(await s.page.getAttribute('#heute-nrs-summe', 'class'), /ae-assess-score--alert/, 'Summe=3 (Cutoff >=3) muss die Alert-Klasse haben');
  } finally {
    await s.schliessen();
  }
});

test('Medikationsplan: Pflichtfeld-Validierung, Eintrag anlegen, Dosierschema nie leer, Abgesetzt-Toggle (W-neu-3, 2026-10-23)', async function () {
  var s = await neueSeite();
  try {
    await setupLocalPin(s.page, server.basis, '482917');
    await gotoView(s.page, '#medikationsplan');
    await s.page.waitForSelector('#medplan-eintrag-form');

    // Pflichtfeld-Validierung: Wirkstoff/Darreichungsform/Dosiereinheit leer -> HTML5 "required" muss
    // das submit-Event blockieren, kein Eintrag darf entstehen.
    await s.page.click('#medplan-eintrag-form button[type=submit]');
    await s.page.waitForTimeout(150);
    assert.match(await s.page.textContent('#medplan-eintraege-liste'), /Noch kein Eintrag erfasst/, 'Ohne Pflichtfelder darf kein Eintrag entstehen');

    // Dosierschema darf nie leer bleiben (Blur-Zwangsregel) -- direkt an der DOM-Logik geprüft.
    await s.page.fill('#medplan-eintrag-morgens', '');
    await s.page.locator('#medplan-eintrag-morgens').blur();
    assert.equal(await s.page.inputValue('#medplan-eintrag-morgens'), '0', 'Leeres Dosierschema-Feld muss bei Blur auf "0" zurückfallen');

    // Gültigen Eintrag anlegen.
    await s.page.fill('#medplan-eintrag-wirkstoff', 'Metoprolol TEST');
    await s.page.fill('#medplan-eintrag-darreichungsform', 'Tablette');
    await s.page.fill('#medplan-eintrag-dosiereinheit', 'Stück');
    await s.page.fill('#medplan-eintrag-morgens', '1');
    await s.page.fill('#medplan-eintrag-abends', '1');
    await s.page.click('#medplan-eintrag-form button[type=submit]');
    await s.page.waitForFunction(function () {
      return document.getElementById('medplan-eintraege-liste').textContent.indexOf('Metoprolol TEST') !== -1;
    });
    var listeText = await s.page.textContent('#medplan-eintraege-liste');
    assert.match(listeText, /1-0-1-0 Stück/, 'Dosierschema-Anzeige muss 1-0-1-0 Stück zeigen');
    assert.doesNotMatch(listeText, /Abgesetzt/, 'Neuer Eintrag darf noch nicht als abgesetzt markiert sein');

    // Abgesetzt-Toggle statt Löschen: Eintrag bleibt sichtbar, nur als abgesetzt markiert, mit Audit-Grund+PFK.
    await s.page.click('#medplan-eintraege-liste [data-medplan-absetzen]');
    await s.page.waitForFunction(function () {
      return !document.getElementById('ae-medplan-korrektur-overlay').classList.contains('ae-legal-hidden');
    });
    await s.page.fill('#medplan-korrektur-pfk', 'TST');
    await s.page.fill('#medplan-korrektur-grund', 'Testlauf — Medikament vom Arzt abgesetzt');
    await s.page.click('#medplan-korrektur-speichern');
    await s.page.waitForFunction(function () {
      return document.getElementById('medplan-eintraege-liste').textContent.indexOf('Abgesetzt') !== -1;
    });
    listeText = await s.page.textContent('#medplan-eintraege-liste');
    assert.match(listeText, /Metoprolol TEST/, 'Abgesetzter Eintrag bleibt in der Liste sichtbar (kein Löschen)');
    assert.match(listeText, /Wieder aktivieren/, 'Button muss nach Abgesetzt-Toggle auf "Wieder aktivieren" wechseln');

    assert.deepEqual(s.consoleErrors, [], 'Keine unerwarteten JS-Fehler während des Medikationsplan-Flows');
  } finally {
    await s.schliessen();
  }
});

test('AERIS Buch: Privatrechnungs-Nummern fortlaufend/nie doppelt + DATEV bucht bei eingefrorener Rechnung nur den fest vergebenen Betrag', async function () {
  var s = await neueSeite();
  try {
    await s.page.clock.install({ time: new Date('2026-06-15T10:00:00') }); // fixiertes "Heute" -- macht die seed-basierten Demo-Daten tagesunabhaengig reproduzierbar
    await s.page.goto(server.basis + '/buchhaltung/index.html');
    await resetLocalStorage(s.page);
    await s.page.reload();
    await s.page.waitForSelector('[data-action="demo"]');
    await s.page.click('[data-action="demo"]');
    await s.page.waitForSelector('#tab-einnahmen', { state: 'visible' });
    await s.page.click('#tab-einnahmen');
    await s.page.waitForSelector('#re-privat-sub');

    // Zum ersten bereits eingefrorenen Monat zurückblättern -- hier läuft sowohl der
    // Freeze-Override-Test als auch der Startpunkt der Fortlaufend-Prüfung.
    var gefunden = false;
    var ersteNr = null;
    for (var i = 0; i < 12; i++) {
      var sub = await s.page.textContent('#re-privat-sub');
      var treffer = sub.match(/RE-\d{4}-BERATUNG-(\d+)\s*·\s*festgeschrieben/);
      if (treffer) { gefunden = true; ersteNr = parseInt(treffer[1], 10); break; }
      await s.page.click('[data-action="month-prev"]');
      await s.page.waitForTimeout(80);
    }
    assert.ok(gefunden, 'Demo-Daten müssen mindestens einen bereits eingefrorenen Privatrechnungs-Monat enthalten');

    // ---- Freeze-Override: neue Privatleistung im selben (bereits eingefrorenen) Monat darf die
    // DATEV-Buchung NICHT verändern (Nachtrag 2026-10-23 "DATEV-Freeze-Divergenz"). ----
    var summeVorText = await s.page.textContent('#t-privat');
    var summeVorMatch = summeVorText.match(/Summe[^0-9]*([\d.,]+)\s*€/);
    assert.ok(summeVorMatch, 'Summe-Zeile in #t-privat muss lesbar sein');
    var summeVorher = summeVorMatch[1];

    await s.page.click('[data-action="privat-neu"]');
    await s.page.waitForSelector('#privat-dialog[open]');
    await s.page.fill('#privat-form [name=betrag]', '999,00');
    await s.page.fill('#privat-form [name=pfk]', 'TEST');
    await s.page.click('#privat-form button[type=submit]');
    await s.page.waitForFunction(function () { return !document.getElementById('privat-dialog').open; });
    await s.page.waitForTimeout(150);

    var summeNachText = await s.page.textContent('#t-privat');
    var summeNachMatch = summeNachText.match(/Summe[^0-9]*([\d.,]+)\s*€/);
    assert.notEqual(summeNachMatch[1], summeVorher, 'Live-Summe in #t-privat muss nach der neuen Erfassung gestiegen sein');

    await s.page.click('#tab-berichte');
    await s.page.waitForSelector('#exports article:has-text("DATEV-Buchungsstapel")');
    var downloadPromise = s.page.waitForEvent('download');
    await s.page.click('#exports article:has-text("DATEV-Buchungsstapel") button');
    var download = await downloadPromise;
    var dlPath = await download.path();
    var csvText = fs.readFileSync(dlPath).toString('latin1');
    var privatZeile = csvText.split('\r\n').find(function (l) { return l.indexOf('Aufnahme-/Anamnese-Pauschale') !== -1; });
    assert.ok(privatZeile, 'DATEV-Buchungsstapel muss eine Zeile für die Privatleistung enthalten');
    var betragInZeile = privatZeile.split(';')[0];
    assert.equal(betragInZeile, summeVorher.replace(/\./g, ''), 'DATEV muss den EINGEFRORENEN Betrag (' + summeVorher + ') buchen, nicht den neuen Live-Betrag (' + summeNachMatch[1] + ') -- gebucht: ' + betragInZeile);

    // ---- Fortlaufend/nie doppelt über mehrere weitere Monate zurück (ab dem oben gefundenen Monat). ----
    var nummern = [ersteNr];
    for (var j = 0; j < 12; j++) {
      await s.page.click('[data-action="month-prev"]');
      await s.page.waitForTimeout(80);
      var m = (await s.page.textContent('#re-privat-sub')).match(/RE-\d{4}-BERATUNG-(\d+)/);
      if (m) nummern.push(parseInt(m[1], 10));
    }
    assert.equal(new Set(nummern).size, nummern.length, 'Rechnungsnummern dürfen nie doppelt vergeben werden: ' + nummern.join(','));
    for (var k = 1; k < nummern.length; k++) {
      assert.ok(nummern[k] < nummern[k - 1], 'Nummern müssen fortlaufend mit der Zeit steigen (rückwärts blättern = sinkende Nummer): ' + nummern.join(','));
    }
  } finally {
    await s.schliessen();
  }
});
