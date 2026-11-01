// audit-arbeitsschutz-medizinprodukte KRITISCH 2 (2026-11-01): ArbZG-Nachweis-Gate -- prüft die
// 3 serverseitig berechneten Dienstplan-Hinweis-Flags (rechtsgrundlageUngeklaert,
// ruhezeitUnterschritten, pausenablosungFehlt) sowie den admin-only GET/PUT-Nachweis-Endpunkt.
// Läuft gegen eine echte server.js-Instanz (identisches Muster wie server.test.js).
var test = require('node:test');
var assert = require('node:assert/strict');
var { starteServer, api } = require('./helpers');

var srv;
test.before(async function () { srv = await starteServer(); });
test.after(async function () { await srv.stoppen(); srv.aufraeumen(); });

function dummyWrappedDek() { return { salt: 'c2FsdA==', iv: 'aXZpdml2', ct: 'Y3Q=' }; }

async function neuerTenant(username, tenantName) {
  await api(srv.basis, '/setup', {
    method: 'POST',
    body: JSON.stringify({ tenantName: tenantName, username: username, password: '123456', displayName: username, wrappedDek: dummyWrappedDek() })
  });
  var login = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: '123456' }) });
  assert.equal(login.status, 200, 'Login nach Setup muss erfolgreich sein');
  return login.body;
}

async function dienstEintrag(token, userId, datum, typ, von, bis, extra) {
  return api(srv.basis, '/dienst', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify(Object.assign({ userId: userId, datum: datum, typ: typ, von: von, bis: bis }, extra || {}))
  });
}
async function holeDienst(token, von, bis) {
  var r = await api(srv.basis, '/dienst?von=' + von + '&bis=' + bis, { headers: { Authorization: 'Bearer ' + token } });
  return r.body;
}
// GET /api/dienst liefert die volle Historie (append-only) -- "aktueller Stand" ist der JÜNGSTE
// Eintrag je Datum (letzter in der nach rowid aufsteigend sortierten Liste), identisches Prinzip
// wie der Client (aeris-server.js standJeTag/aktuell).
function eintragFuer(liste, datum) {
  var treffer = liste.filter(function (e) { return e.datum === datum; });
  return treffer[treffer.length - 1];
}

test('Schicht >10h ohne hinterlegte Rechtsgrundlage -> rechtsgrundlageUngeklaert=true; nach Nachweis-Eintrag false', async function () {
  var u = 'arbzg1_' + Date.now();
  var admin = await neuerTenant(u, 'ArbZG Nachweis GmbH');
  await dienstEintrag(admin.token, admin.user.id, '2026-12-10', 'frueh', '06:00', '18:00'); // 12h
  var liste1 = await holeDienst(admin.token, '2026-12-10', '2026-12-10');
  var e1 = eintragFuer(liste1, '2026-12-10');
  assert.equal(e1.rechtsgrundlageUngeklaert, true, 'ohne Nachweis muss die 12h-Schicht als ungeklärt markiert sein');

  var put = await api(srv.basis, '/tenant/arbzg-nachweis', {
    method: 'PUT', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ typ: 'ausnahmebewilligung', aktenzeichen: 'AZ-123', datum: '2026-01-01', behoerde: 'Regierungspräsidium' })
  });
  assert.equal(put.status, 200, 'Admin darf den Nachweis hinterlegen');

  var liste2 = await holeDienst(admin.token, '2026-12-10', '2026-12-10');
  var e2 = eintragFuer(liste2, '2026-12-10');
  assert.equal(e2.rechtsgrundlageUngeklaert, false, 'mit hinterlegtem Nachweis darf die Schicht nicht mehr als ungeklärt markiert sein');
});

test('PUT /api/tenant/arbzg-nachweis ist admin-only und validiert Pflichtfelder', async function () {
  var u = 'arbzg2_' + Date.now();
  var admin = await neuerTenant(u, 'ArbZG Validierung GmbH');
  var maUsername = u + '_ma';
  var ma = await api(srv.basis, '/users', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ username: maUsername, password: '111111', displayName: 'MA', wrappedDek: dummyWrappedDek() })
  });
  var maLogin = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: maUsername, password: '111111' }) });
  // mustChangePassword-Pflichtwechsel umgehen, damit der 403-Test wirklich die Rollenprüfung trifft.
  await api(srv.basis, '/me/password', { method: 'POST', headers: { Authorization: 'Bearer ' + maLogin.body.token }, body: JSON.stringify({ password: '222222', wrappedDek: dummyWrappedDek() }) });
  var maLogin2 = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: maUsername, password: '222222' }) });

  var versuchMa = await api(srv.basis, '/tenant/arbzg-nachweis', {
    method: 'PUT', headers: { Authorization: 'Bearer ' + maLogin2.body.token },
    body: JSON.stringify({ typ: 'ausnahmebewilligung', aktenzeichen: 'X', datum: '2026-01-01', behoerde: 'Y' })
  });
  assert.equal(versuchMa.status, 403, 'ma darf den Nachweis nicht setzen');

  var unvollstaendig = await api(srv.basis, '/tenant/arbzg-nachweis', {
    method: 'PUT', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ typ: 'tarifvertrag', referenz: 'TV-AKI 2026' }) // bereitschaftsanteil fehlt
  });
  assert.equal(unvollstaendig.status, 400, 'tarifvertrag ohne bereitschaftsanteil muss abgelehnt werden');
  void ma;
});

test('Ruhezeit <11h zwischen zwei Diensten derselben Person -> ruhezeitUnterschritten=true, sonst false', async function () {
  var u = 'arbzg3_' + Date.now();
  var admin = await neuerTenant(u, 'ArbZG Ruhezeit GmbH');
  // Schicht 1 endet 20:00, Schicht 2 beginnt am Folgetag 06:00 -> nur 10h Ruhezeit.
  await dienstEintrag(admin.token, admin.user.id, '2026-12-11', 'spaet', '08:00', '20:00');
  await dienstEintrag(admin.token, admin.user.id, '2026-12-12', 'frueh', '06:00', '14:00');
  var liste = await holeDienst(admin.token, '2026-12-11', '2026-12-12');
  assert.equal(eintragFuer(liste, '2026-12-12').ruhezeitUnterschritten, true, '10h Ruhezeit muss als unterschritten markiert werden');
  assert.equal(eintragFuer(liste, '2026-12-11').ruhezeitUnterschritten, false, 'der erste Dienst selbst hat keine zu kurze Ruhezeit davor');

  // Ausreichende Ruhezeit zu einem dritten Tag (endet 14:00, nächster beginnt übernächsten Tag 08:00 -> >11h).
  await dienstEintrag(admin.token, admin.user.id, '2026-12-14', 'frueh', '08:00', '16:00');
  var liste2 = await holeDienst(admin.token, '2026-12-14', '2026-12-14');
  assert.equal(eintragFuer(liste2, '2026-12-14').ruhezeitUnterschritten, false, 'ausreichende Ruhezeit darf nicht markiert werden');
});

test('Pausenablösung fehlt bei Schicht >6h -> pausenablosungFehlt=true, bei dokumentierter Ablösung false, bei <=6h nie gesetzt', async function () {
  var u = 'arbzg4_' + Date.now();
  var admin = await neuerTenant(u, 'ArbZG Pause GmbH');
  await dienstEintrag(admin.token, admin.user.id, '2026-12-15', 'frueh', '08:00', '20:00'); // 12h, keine Ablösung
  await dienstEintrag(admin.token, admin.user.id, '2026-12-16', 'frueh', '08:00', '20:00', { pausenabloesung: 'Springer Max Muster, 13:00-13:30' });
  await dienstEintrag(admin.token, admin.user.id, '2026-12-17', 'frueh', '08:00', '13:00'); // 5h, Pausenregel greift nicht
  var liste = await holeDienst(admin.token, '2026-12-15', '2026-12-17');
  assert.equal(eintragFuer(liste, '2026-12-15').pausenablosungFehlt, true, '12h ohne dokumentierte Ablösung muss markiert werden');
  assert.equal(eintragFuer(liste, '2026-12-16').pausenablosungFehlt, false, 'dokumentierte Ablösung darf nicht markiert werden');
  assert.equal(eintragFuer(liste, '2026-12-17').pausenablosungFehlt, false, '5h-Schicht fällt nicht unter die § 4 ArbZG-Pausenpflicht >6h');
});

test('Krankmeldung/Urlaub/Frei zählen nicht als Arbeitszeit -> keine Flags, keine Verzerrung der Ruhezeit-Kette', async function () {
  var u = 'arbzg5_' + Date.now();
  var admin = await neuerTenant(u, 'ArbZG Ausnahmen GmbH');
  await dienstEintrag(admin.token, admin.user.id, '2026-12-18', 'frueh', '08:00', '20:00');
  // Krankmeldung für denselben Tag (append-only "aktueller Stand") -- wird zur neuesten Zeile für
  // diesen Tag und darf daher selbst nicht als 12h-Arbeitszeit gezählt werden.
  await dienstEintrag(admin.token, admin.user.id, '2026-12-18', 'frueh', '08:00', '20:00', { status: 'krank' });
  var liste = await holeDienst(admin.token, '2026-12-18', '2026-12-18');
  var e = eintragFuer(liste, '2026-12-18');
  assert.equal(e.status, 'krank', '"aktueller Stand" muss die Krankmeldung sein');
  assert.equal(e.rechtsgrundlageUngeklaert, false, 'eine Krankmeldung darf nicht als ungeklärte 12h-Schicht markiert werden');
  assert.equal(e.pausenablosungFehlt, false, 'eine Krankmeldung braucht keine Pausenablösung');
});
