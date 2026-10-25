// Organisationsstruktur Phase 5 (2026-10-24/25, software-architect-Konzept 1:1 umgesetzt):
// Eskalationsberechnung (meldungen) + serverseitige Report-Endpunkte. Laeuft gegen eine ECHTE
// server.js-Instanz (Blackbox ueber HTTP), identisches Muster wie die bestehenden Testdateien.
var test = require('node:test');
var assert = require('node:assert/strict');
var { starteServer, api } = require('./helpers');

var srv;
test.before(async function () { srv = await starteServer(); });
test.after(async function () { await srv.stoppen(); srv.aufraeumen(); });

function dummyWrappedDek() { return { salt: 'c2FsdA==', iv: 'aXZpdml2', ct: 'Y3Q=' }; }
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
// Lokale Maschinenzeit -- diese Testumgebung laeuft nachweislich in Europe/Berlin (gleiche TZ wie
// der Server-seitige Intl-Helper interpretiert), Tages-Offsets mit mehrtaegigem Sicherheitsabstand
// zu den 3-Tage-Eskalationsgrenzen machen Minuten-/TZ-Jitter irrelevant.
function isoOffset(nTage) {
  var d = new Date();
  d.setDate(d.getDate() + nTage);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function aktuellerMonatPrefix() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

async function neuerTenant(username, tenantName) {
  await api(srv.basis, '/setup', {
    method: 'POST',
    body: JSON.stringify({ tenantName: tenantName, username: username, password: '123456', displayName: username, wrappedDek: dummyWrappedDek() })
  });
  var login = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: '123456' }) });
  assert.equal(login.status, 200, 'Login nach Setup muss erfolgreich sein');
  return login.body;
}
async function neuesKonto(adminToken, username, roles, teamId) {
  var neu = await api(srv.basis, '/users', {
    method: 'POST', headers: { Authorization: 'Bearer ' + adminToken },
    body: JSON.stringify({ username: username, password: '111111', displayName: username, roles: roles || ['ma'], wrappedDek: dummyWrappedDek() })
  });
  assert.equal(neu.status, 200, 'Nutzer-Anlage muss funktionieren: ' + JSON.stringify(neu.body));
  if (teamId) {
    var patch = await api(srv.basis, '/users/' + neu.body.id, {
      method: 'PATCH', headers: { Authorization: 'Bearer ' + adminToken }, body: JSON.stringify({ teamId: teamId })
    });
    assert.equal(patch.status, 200, 'teamId-Zuordnung muss funktionieren: ' + JSON.stringify(patch.body));
  }
  var login1 = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: '111111' }) });
  await api(srv.basis, '/me/password', { method: 'POST', headers: { Authorization: 'Bearer ' + login1.body.token }, body: JSON.stringify({ password: '222222', wrappedDek: dummyWrappedDek() }) });
  var login2 = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: '222222' }) });
  return { id: neu.body.id, token: login2.body.token, user: login2.body.user };
}
async function neueMeldung(token, pfad, iso) {
  var m = await api(srv.basis, '/meldungen', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({ pfad: pfad, iso: iso, payload: { iv: 'iv', ct: 'ct' } })
  });
  assert.equal(m.status, 200, 'Meldung anlegen muss funktionieren: ' + JSON.stringify(m.body));
  return m.body;
}
async function dienstEintrag(adminToken, userId, datum, typ, von, bis, status) {
  var d = await api(srv.basis, '/dienst', {
    method: 'POST', headers: { Authorization: 'Bearer ' + adminToken },
    body: JSON.stringify({ userId: userId, datum: datum, typ: typ, von: von || '', bis: bis || '', status: status || 'aktiv' })
  });
  assert.equal(d.status, 200, 'Dienst-Eintrag anlegen muss funktionieren: ' + JSON.stringify(d.body));
  return d.body;
}
async function findeMeldung(token, id) {
  var liste = await api(srv.basis, '/meldungen', { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(liste.status, 200);
  return liste.body.find(function (m) { return m.id === id; });
}

test('Eskalation Stufe 1/2 MIT Dienstplan-Eintrag (Schichtende + 3 Tage), Fallback OHNE Dienstplan-Eintrag', async function () {
  var admin = await neuerTenant('esk1A_' + Date.now(), 'Eskalation GmbH');
  var ma1 = await neuesKonto(admin.token, 'esk1_ma1_' + Date.now(), ['ma']);
  var ma2 = await neuesKonto(admin.token, 'esk1_ma2_' + Date.now(), ['ma']);

  // (a) MIT Dienstplan-Eintrag: 2 Tage vor -> Schichtende (16:00) ist vergangen, +3 Tage (morgen
  // 16:00) liegt noch in der Zukunft -> Stufe 1.
  var isoStufe1 = isoOffset(-2);
  await dienstEintrag(admin.token, ma1.id, isoStufe1, 'frueh', '08:00', '16:00');
  var mStufe1 = await neueMeldung(ma1.token, '/doku/' + isoStufe1, isoStufe1);

  // 6 Tage vor -> Schichtende + 3 Tage (vor 3 Tagen) liegt bereits in der Vergangenheit -> Stufe 2.
  var isoStufe2 = isoOffset(-6);
  await dienstEintrag(admin.token, ma1.id, isoStufe2, 'spaet', '08:00', '16:00');
  var mStufe2 = await neueMeldung(ma1.token, '/doku/' + isoStufe2, isoStufe2);

  var gefunden1 = await findeMeldung(admin.token, mStufe1.id);
  var gefunden2 = await findeMeldung(admin.token, mStufe2.id);
  assert.equal(gefunden1.eskalationsStufe, 1, 'Schichtende vergangen, +3 Tage noch zukünftig -> Stufe 1');
  assert.equal(gefunden2.eskalationsStufe, 2, 'Schichtende + 3 Tage bereits vergangen -> Stufe 2');

  // (b) OHNE Dienstplan-Eintrag -> Fallback Ende des Kalendertags. Heute (23:59:59 liegt noch in
  // der Zukunft) -> Stufe 0. Vor 2 Tagen (23:59:59 vergangen, +3 Tage noch zukünftig) -> Stufe 1.
  var mFallbackHeute = await neueMeldung(ma2.token, '/doku/heute', isoOffset(0));
  var mFallbackStufe1 = await neueMeldung(ma2.token, '/doku/vor2tagen', isoOffset(-2));

  var gefundenHeute = await findeMeldung(admin.token, mFallbackHeute.id);
  var gefundenFallback1 = await findeMeldung(admin.token, mFallbackStufe1.id);
  assert.equal(gefundenHeute.eskalationsStufe, 0, 'Kalendertag-Fallback, heute noch nicht vorbei -> Stufe 0');
  assert.equal(gefundenFallback1.eskalationsStufe, 1, 'Kalendertag-Fallback vor 2 Tagen vorbei, +3 Tage noch zukünftig -> Stufe 1');
});

test('Sichtbarkeitserweiterung: Bezirksleitung sieht Stufe-1-Meldung des eigenen Bezirks (fremdes Team), NICHT eines fremden Bezirks', async function () {
  var admin = await neuerTenant('sichtA_' + Date.now(), 'Sichtbarkeit GmbH');
  var bezNord = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Nord' }) });
  var bezSued = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Süd' }) });
  var teamNordA = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Nord-A', bezirkId: bezNord.body.id }) });
  var teamSuedA = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Süd-A', bezirkId: bezSued.body.id }) });

  var ma3 = await neuesKonto(admin.token, 'sicht_ma3_' + Date.now(), ['ma'], teamNordA.body.id);
  var blNord = await neuesKonto(admin.token, 'sicht_blNord_' + Date.now(), ['bezirksleitung']);
  var blSued = await neuesKonto(admin.token, 'sicht_blSued_' + Date.now(), ['bezirksleitung']);
  await api(srv.basis, '/bezirke/' + bezNord.body.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ leiterUserId: blNord.id }) });
  await api(srv.basis, '/bezirke/' + bezSued.body.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ leiterUserId: blSued.id }) });

  var isoStufe1 = isoOffset(-2);
  await dienstEintrag(admin.token, ma3.id, isoStufe1, 'frueh', '08:00', '16:00');
  var m = await neueMeldung(ma3.token, '/doku/' + isoStufe1, isoStufe1);

  var gefundenAdmin = await findeMeldung(admin.token, m.id);
  assert.equal(gefundenAdmin.eskalationsStufe, 1, 'Vorbedingung: Meldung muss tatsächlich Stufe 1 sein');

  var sichtNord = await findeMeldung(blNord.token, m.id);
  assert.ok(sichtNord, 'Bezirksleitung Nord sieht die Stufe-1-Meldung eines fremden Teams IHRES Bezirks');

  var sichtSued = await findeMeldung(blSued.token, m.id);
  assert.equal(sichtSued, undefined, 'Bezirksleitung Süd sieht KEINE Meldung aus einem fremden Bezirk');

  var patchNord = await api(srv.basis, '/meldungen/' + m.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + blNord.token }, body: JSON.stringify({ status: 'angenommen' }) });
  assert.equal(patchNord.status, 200, 'Bezirksleitung Nord darf die Stufe-1-Meldung entscheiden');

  var patchSued = await api(srv.basis, '/meldungen/' + m.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + blSued.token }, body: JSON.stringify({ status: 'abgelehnt' }) });
  assert.equal(patchSued.status, 403, 'Bezirksleitung Süd darf die fremde Meldung NICHT entscheiden');
});

test('Report-Endpunkte: korrekte Zahlen gegen bekannte Testdaten + Scope-403 für fremden Team/Bezirk', async function () {
  var admin = await neuerTenant('reportA_' + Date.now(), 'Report GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Report-Bezirk' }) });
  var team = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Report-Team', bezirkId: bez.body.id }) });
  var fremdesBez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Fremd-Bezirk' }) });
  var fremdesTeam = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Fremd-Team', bezirkId: fremdesBez.body.id }) });

  var ma = await neuesKonto(admin.token, 'report_ma_' + Date.now(), ['ma'], team.body.id);
  var tl = await neuesKonto(admin.token, 'report_tl_' + Date.now(), ['teamleiter'], team.body.id);
  var bl = await neuesKonto(admin.token, 'report_bl_' + Date.now(), ['bezirksleitung']);
  await api(srv.basis, '/bezirke/' + bez.body.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ leiterUserId: bl.id }) });
  var fremderBl = await neuesKonto(admin.token, 'report_fremdbl_' + Date.now(), ['bezirksleitung']);
  await api(srv.basis, '/bezirke/' + fremdesBez.body.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ leiterUserId: fremderBl.id }) });
  var fremderTl = await neuesKonto(admin.token, 'report_fremdtl_' + Date.now(), ['teamleiter'], fremdesTeam.body.id);

  // 2 Meldungen: 1 offen+nicht eskaliert (heute), 1 offen+eskaliert (Stufe 1, vor 2 Tagen).
  await neueMeldung(ma.token, '/doku/heute', isoOffset(0));
  var isoStufe1 = isoOffset(-2);
  await dienstEintrag(admin.token, ma.id, isoStufe1, 'frueh', '08:00', '16:00');
  await neueMeldung(ma.token, '/doku/vor2tagen', isoStufe1);

  // Dienstplan im aktuellen Monat: Tag 1+2 aktiv (besetzt), Tag 3 krank (Ausfall). Erwartete
  // Zahlen werden dynamisch (nicht hartkodiert "2"/"1") aus den tatsächlich im AKTUELLEN Monat
  // liegenden Eintragungen hergeleitet -- der isoStufe1-Eintrag von oben (heute-2 Tage) KANN je
  // nach Kalendertag ebenfalls in den aktuellen Monat fallen (dann zählt er zusätzlich als
  // besetzter Tag) bzw. bei einer Monatsgrenze auch mit Tag 3 kollidieren (dann gewinnt per
  // "letzte Zeile zählt" der zuletzt gesetzte Status) -- identisches Prinzip wie der Server.
  var monat = aktuellerMonatPrefix();
  var AKTIVE_TYPEN = ['frueh', 'spaet', 'nacht', 'bereitschaft'];
  var diensteFuerMonat = {};
  function merke(datum, typ, status) { if (datum.indexOf(monat) === 0) diensteFuerMonat[datum] = { typ: typ, status: status }; }
  merke(isoStufe1, 'frueh', 'aktiv');
  merke(monat + '-01', 'frueh', 'aktiv');
  await dienstEintrag(admin.token, ma.id, monat + '-01', 'frueh', '08:00', '16:00', 'aktiv');
  merke(monat + '-02', 'nacht', 'aktiv');
  await dienstEintrag(admin.token, ma.id, monat + '-02', 'nacht', '20:00', '06:00', 'aktiv');
  merke(monat + '-03', 'frueh', 'krank');
  await dienstEintrag(admin.token, ma.id, monat + '-03', 'frueh', '08:00', '16:00', 'krank');
  var erwarteteBesetzteTage = 0, erwarteteKrank = 0;
  Object.keys(diensteFuerMonat).forEach(function (d) {
    var e = diensteFuerMonat[d];
    if (e.status === 'krank') erwarteteKrank++;
    else if (AKTIVE_TYPEN.indexOf(e.typ) !== -1) erwarteteBesetzteTage++;
  });

  var reportTeam = await api(srv.basis, '/reports/team/' + team.body.id, { headers: { Authorization: 'Bearer ' + tl.token } });
  assert.equal(reportTeam.status, 200, 'Teamleiter darf den eigenen Team-Report abrufen');
  assert.equal(reportTeam.body.offeneMeldungen, 2, 'Beide Meldungen sind offen');
  assert.equal(reportTeam.body.eskalierteMeldungen, 1, 'Genau eine der beiden ist eskaliert (Stufe >=1)');
  assert.equal(reportTeam.body.dienstplanAuslastung.besetzteTage, erwarteteBesetzteTage, 'Besetzte Tage im aktuellen Monat korrekt');
  assert.equal(reportTeam.body.dienstplanAuslastung.ausfaelleKrankmeldungen, erwarteteKrank, 'Krankmeldungen im aktuellen Monat korrekt');
  var tageGesamt = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  assert.equal(reportTeam.body.dienstplanAuslastung.tageGesamt, tageGesamt, 'Gesamttage des aktuellen Monats korrekt');
  assert.equal(reportTeam.body.dienstplanAuslastung.besetzungsgrad, Math.round((erwarteteBesetzteTage / tageGesamt) * 1000) / 1000, 'Besetzungsgrad korrekt berechnet');

  var reportBezirk = await api(srv.basis, '/reports/bezirk/' + bez.body.id, { headers: { Authorization: 'Bearer ' + bl.token } });
  assert.equal(reportBezirk.status, 200, 'Bezirksleitung darf den eigenen Bezirk-Report abrufen');
  assert.equal(reportBezirk.body.offeneMeldungen, 2, 'Bezirk-Report aggregiert dieselben Meldungen (nur 1 Team im Bezirk)');
  assert.equal(reportBezirk.body.eskalierteMeldungen, 1);

  var fremderTeamZugriff = await api(srv.basis, '/reports/team/' + team.body.id, { headers: { Authorization: 'Bearer ' + fremderTl.token } });
  assert.equal(fremderTeamZugriff.status, 403, 'Teamleiter eines FREMDEN Teams bekommt 403 auf diesen Team-Report');

  var fremderBezirkZugriff = await api(srv.basis, '/reports/bezirk/' + bez.body.id, { headers: { Authorization: 'Bearer ' + fremderBl.token } });
  assert.equal(fremderBezirkZugriff.status, 403, 'Bezirksleitung eines FREMDEN Bezirks bekommt 403 auf diesen Bezirk-Report');

  var adminZugriffTeam = await api(srv.basis, '/reports/team/' + team.body.id, { headers: { Authorization: 'Bearer ' + admin.token } });
  assert.equal(adminZugriffTeam.status, 200, 'Admin darf jeden Team-Report abrufen');
  var adminZugriffBezirk = await api(srv.basis, '/reports/bezirk/' + bez.body.id, { headers: { Authorization: 'Bearer ' + admin.token } });
  assert.equal(adminZugriffBezirk.status, 200, 'Admin darf jeden Bezirk-Report abrufen');

  var unbekanntesTeam = await api(srv.basis, '/reports/team/nicht-vorhanden', { headers: { Authorization: 'Bearer ' + admin.token } });
  assert.equal(unbekanntesTeam.status, 404, 'Unbekannte teamId liefert 404');
  var unbekannterBezirk = await api(srv.basis, '/reports/bezirk/nicht-vorhanden', { headers: { Authorization: 'Bearer ' + admin.token } });
  assert.equal(unbekannterBezirk.status, 404, 'Unbekannte bezirkId liefert 404');

  var maZugriff = await api(srv.basis, '/reports/team/' + team.body.id, { headers: { Authorization: 'Bearer ' + ma.token } });
  assert.equal(maZugriff.status, 403, 'ma (ohne teamleiter/bezirksleitung/admin/hr) bekommt 403 auf den Team-Report');
});
