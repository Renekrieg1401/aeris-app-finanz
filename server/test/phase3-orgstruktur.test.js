// Organisationsstruktur Phase 3 (2026-10-24): Bezirke/Teams/Klienten-CRUD + Pro-Klient-DEK-
// Provisionierung + Login-Vertrag. Läuft gegen eine ECHTE server.js-Instanz (Blackbox über HTTP),
// identisches Muster wie server.test.js.
var test = require('node:test');
var assert = require('node:assert/strict');
var { starteServer, api } = require('./helpers');

var srv;
test.before(async function () { srv = await starteServer(); });
test.after(async function () { await srv.stoppen(); srv.aufraeumen(); });

function dummyWrappedDek() { return { salt: 'c2FsdA==', iv: 'aXZpdml2', ct: 'Y3Q=' }; }
function wrapFuer(userId, art) { return { userId: userId, wrapArt: art || 'pin', wrapSalt: 's', wrapIv: 'i', wrapCt: 'c-' + userId }; }

async function neuerTenant(username, tenantName) {
  await api(srv.basis, '/setup', {
    method: 'POST',
    body: JSON.stringify({ tenantName: tenantName, username: username, password: '123456', displayName: username, wrappedDek: dummyWrappedDek() })
  });
  var login = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: '123456' }) });
  assert.equal(login.status, 200, 'Login nach Setup muss erfolgreich sein');
  return login.body; // { token, user, tenantId, tenantName, wrappedDek, klienten }
}

async function neuerMa(adminToken, username, roles) {
  var r = await api(srv.basis, '/users', {
    method: 'POST', headers: { Authorization: 'Bearer ' + adminToken },
    body: JSON.stringify({ username: username, password: '111111', displayName: username, wrappedDek: dummyWrappedDek(), roles: roles || ['ma'] })
  });
  assert.equal(r.status, 200, 'Nutzer-Anlage muss funktionieren: ' + JSON.stringify(r.body));
  // mustChangePassword=1 -> erst eigene PIN setzen, sonst 403 auf allen Routen.
  var login = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: '111111' }) });
  var geaendert = await api(srv.basis, '/me/password', {
    method: 'POST', headers: { Authorization: 'Bearer ' + login.body.token }, body: JSON.stringify({ password: '222222', wrappedDek: dummyWrappedDek() })
  });
  assert.equal(geaendert.status, 200);
  var zweiteLogin = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: '222222' }) });
  return { userId: r.body.id, token: zweiteLogin.body.token, login: zweiteLogin.body };
}

test('Bezirke/Teams-CRUD: admin legt an, GET /api/bezirke und /api/teams liefern sie zurück', async function () {
  var admin = await neuerTenant('orgA_' + Date.now(), 'Org A GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Nord' }) });
  assert.equal(bez.status, 200);
  var team = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Team Nord 1', bezirkId: bez.body.id }) });
  assert.equal(team.status, 200);
  assert.equal(team.body.bezirkName, 'Nord');
  // 2 statt 1 (seit 2026-10-24): /api/setup legt im Alt-Format (neuerTenant()) bereits automatisch
  // einen Default-Bezirk/-Team an, "Nord"/"Team Nord 1" kommen zusätzlich dazu.
  var bezirkeListe = await api(srv.basis, '/bezirke', { headers: { Authorization: 'Bearer ' + admin.token } });
  assert.equal(bezirkeListe.body.length, 2);
  var teamsListe = await api(srv.basis, '/teams', { headers: { Authorization: 'Bearer ' + admin.token } });
  assert.equal(teamsListe.body.length, 2);
});

test('POST /api/teams mit fremdem Bezirk (anderer Mandant) wird abgelehnt (404)', async function () {
  var a = await neuerTenant('orgTeamA_' + Date.now(), 'Org TeamA GmbH');
  var b = await neuerTenant('orgTeamB_' + Date.now(), 'Org TeamB GmbH');
  var bezA = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + a.token }, body: JSON.stringify({ name: 'Bez A' }) });
  var r = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + b.token }, body: JSON.stringify({ name: 'Fremdteam', bezirkId: bezA.body.id }) });
  assert.equal(r.status, 404);
});

test('PATCH /api/bezirke/:id lehnt leiterUserId ohne Rolle "bezirksleitung" ab (400)', async function () {
  var admin = await neuerTenant('orgBL_' + Date.now(), 'Org BL GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Süd' }) });
  var ma = await neuerMa(admin.token, 'blKandidat_' + Date.now(), ['ma']);
  var ohneRolle = await api(srv.basis, '/bezirke/' + bez.body.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ leiterUserId: ma.userId }) });
  assert.equal(ohneRolle.status, 400);
  await api(srv.basis, '/users/' + ma.userId, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ roles: ['bezirksleitung'] }) });
  var mitRolle = await api(srv.basis, '/bezirke/' + bez.body.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ leiterUserId: ma.userId }) });
  assert.equal(mitRolle.status, 200);
  assert.equal(mitRolle.body.leiterUserId, ma.userId);
});

test('PATCH /api/teams/:id lehnt leiterUserId ohne Rolle "teamleiter" ab (400)', async function () {
  var admin = await neuerTenant('orgTL_' + Date.now(), 'Org TL GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'West' }) });
  var team = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'T1', bezirkId: bez.body.id }) });
  var ma = await neuerMa(admin.token, 'tlKandidat_' + Date.now(), ['ma']);
  var ohneRolle = await api(srv.basis, '/teams/' + team.body.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ leiterUserId: ma.userId }) });
  assert.equal(ohneRolle.status, 400);
  await api(srv.basis, '/users/' + ma.userId, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ roles: ['teamleiter'] }) });
  var mitRolle = await api(srv.basis, '/teams/' + team.body.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ leiterUserId: ma.userId }) });
  assert.equal(mitRolle.status, 200);
});

test('ma darf weder Bezirk noch Team noch Klient anlegen (403)', async function () {
  var admin = await neuerTenant('orgMaDenied_' + Date.now(), 'Org MaDenied GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Ost' }) });
  var team = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'T-Ost', bezirkId: bez.body.id }) });
  var ma = await neuerMa(admin.token, 'maDenied_' + Date.now(), ['ma']);
  var rBez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + ma.token }, body: JSON.stringify({ name: 'Illegal' }) });
  assert.equal(rBez.status, 403);
  var rTeam = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + ma.token }, body: JSON.stringify({ name: 'Illegal', bezirkId: bez.body.id }) });
  assert.equal(rTeam.status, 403);
  var rKlient = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + ma.token },
    body: JSON.stringify({ teamId: team.body.id, label: 'Illegal', initialeWraps: [wrapFuer(ma.userId)] })
  });
  assert.equal(rKlient.status, 403);
});

test('Cross-Bezirk-Isolation: Bezirksleitung A darf keinen Klienten/Team in Bezirk B anlegen/ändern', async function () {
  var admin = await neuerTenant('orgCross_' + Date.now(), 'Org Cross GmbH');
  var bezA = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Bezirk A' }) });
  var bezB = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Bezirk B' }) });
  var teamA = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Team A', bezirkId: bezA.body.id }) });
  var teamB = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Team B', bezirkId: bezB.body.id }) });

  var blA = await neuerMa(admin.token, 'blA_' + Date.now(), ['bezirksleitung']);
  await api(srv.basis, '/bezirke/' + bezA.body.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ leiterUserId: blA.userId }) });

  // Bezirksleitung A darf in EIGENEM Bezirk/Team einen Klienten anlegen.
  var klientEigen = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + blA.token },
    body: JSON.stringify({ teamId: teamA.body.id, label: 'Klient A', initialeWraps: [wrapFuer(blA.userId)] })
  });
  assert.equal(klientEigen.status, 200, JSON.stringify(klientEigen.body));

  // Bezirksleitung A darf NICHT in Team B (anderer Bezirk) einen Klienten anlegen.
  var klientFremd = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + blA.token },
    body: JSON.stringify({ teamId: teamB.body.id, label: 'Klient B', initialeWraps: [wrapFuer(blA.userId)] })
  });
  assert.equal(klientFremd.status, 403);

  // Bezirksleitung A darf auch kein Team in Bezirk B anlegen.
  var teamFremd = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + blA.token }, body: JSON.stringify({ name: 'Illegal', bezirkId: bezB.body.id }) });
  assert.equal(teamFremd.status, 403);
});

test('GET /api/bezirke und /api/teams sind rollenbasiert scope-gefiltert', async function () {
  var admin = await neuerTenant('orgScope_' + Date.now(), 'Org Scope GmbH');
  var bezA = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Scope A' }) });
  var bezB = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Scope B' }) });
  var teamA = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Team ScA', bezirkId: bezA.body.id }) });
  await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Team ScB', bezirkId: bezB.body.id }) });

  var blA = await neuerMa(admin.token, 'blScope_' + Date.now(), ['bezirksleitung']);
  await api(srv.basis, '/bezirke/' + bezA.body.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ leiterUserId: blA.userId }) });
  var blBezirke = await api(srv.basis, '/bezirke', { headers: { Authorization: 'Bearer ' + blA.token } });
  assert.equal(blBezirke.body.length, 1);
  assert.equal(blBezirke.body[0].id, bezA.body.id);
  var blTeams = await api(srv.basis, '/teams', { headers: { Authorization: 'Bearer ' + blA.token } });
  assert.equal(blTeams.body.length, 1);
  assert.equal(blTeams.body[0].id, teamA.body.id);

  var maInA = await neuerMa(admin.token, 'maScope_' + Date.now(), ['ma']);
  await api(srv.basis, '/users/' + maInA.userId, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ teamId: teamA.body.id }) });
  var maTeams = await api(srv.basis, '/teams', { headers: { Authorization: 'Bearer ' + maInA.token } });
  assert.equal(maTeams.body.length, 1);
  assert.equal(maTeams.body[0].id, teamA.body.id);
  var maBezirke = await api(srv.basis, '/bezirke', { headers: { Authorization: 'Bearer ' + maInA.token } });
  assert.equal(maBezirke.body.length, 1);
  assert.equal(maBezirke.body[0].id, bezA.body.id);

  // admin sieht weiterhin alles: 2 selbst angelegte Bezirke PLUS den Default-Bezirk, den /api/setup
  // seit dem 4-Rollen-Umbau (2026-10-24) auch im hier verwendeten Alt-Format automatisch anlegt
  // (neuerTenant() ruft /setup ohne "accounts" auf -- Rückwärtskompatibilitäts-Pfad).
  var adminBezirke = await api(srv.basis, '/bezirke', { headers: { Authorization: 'Bearer ' + admin.token } });
  assert.equal(adminBezirke.body.length, 3);
});

test('POST /api/klienten verlangt mindestens einen Wrap für den anfragenden Account', async function () {
  var admin = await neuerTenant('orgSelbst_' + Date.now(), 'Org Selbst GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'B' }) });
  var team = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'T', bezirkId: bez.body.id }) });
  var ma = await neuerMa(admin.token, 'ohneSelbst_' + Date.now(), ['ma']);
  var r = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ teamId: team.body.id, label: 'Klient X', initialeWraps: [wrapFuer(ma.userId)] })
  });
  assert.equal(r.status, 400, 'Ohne Wrap für den anfragenden admin-Account muss der Server ablehnen');
});

test('POST /api/klienten/:id/wraps lehnt ab, wenn der Aufrufer selbst keinen Wrap für diesen Klienten hat', async function () {
  var admin = await neuerTenant('orgPlausi_' + Date.now(), 'Org Plausi GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'B' }) });
  var team = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'T', bezirkId: bez.body.id }) });
  var klient = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ teamId: team.body.id, label: 'Klient Plausi', initialeWraps: [wrapFuer(admin.user.id)] })
  });
  assert.equal(klient.status, 200);
  var maOhneZugriff = await neuerMa(admin.token, 'maOhneZugriff_' + Date.now(), ['ma']);
  var r = await api(srv.basis, '/klienten/' + klient.body.klientId + '/wraps', {
    method: 'POST', headers: { Authorization: 'Bearer ' + maOhneZugriff.token },
    body: JSON.stringify(wrapFuer(maOhneZugriff.userId))
  });
  assert.equal(r.status, 403, 'Wer selbst keinen Wrap für den Klienten hat, darf keinen weitergeben');
});

test('Admin kann via POST /api/klienten/:id/wraps einem MA Zugriff gewähren, danach Login-Vertrag liefert den Klienten', async function () {
  var admin = await neuerTenant('orgGrant_' + Date.now(), 'Org Grant GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'B' }) });
  var team = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'T', bezirkId: bez.body.id }) });
  var klient = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ teamId: team.body.id, label: 'Klient Grant', initialeWraps: [wrapFuer(admin.user.id)] })
  });
  assert.equal(klient.status, 200);
  var ma = await neuerMa(admin.token, 'maGrant_' + Date.now(), ['ma']);
  var vorher = ma.login.klienten;
  assert.equal(vorher.length, 0, 'Vor der Freigabe darf der Login-Vertrag keinen Klienten liefern');
  var grant = await api(srv.basis, '/klienten/' + klient.body.klientId + '/wraps', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify(wrapFuer(ma.userId))
  });
  assert.equal(grant.status, 200, JSON.stringify(grant.body));
  var relogin = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: ma.login.user.username, password: '222222' }) });
  assert.equal(relogin.status, 200);
  assert.equal(relogin.body.klienten.length, 1, 'Nach der Freigabe muss der Login-Vertrag genau einen Klienten liefern');
  assert.equal(relogin.body.klienten[0].id, klient.body.klientId);
  assert.equal(relogin.body.klienten[0].label, 'Klient Grant');
  assert.equal(relogin.body.klienten[0].teamName, 'T');
  assert.ok(relogin.body.wrappedDek, 'Legacy-wrappedDek-Feld bleibt zusätzlich erhalten');
});

test('Pro-Klient-Blob (GET/PUT /api/klient-blob/:klientId): Roundtrip + 404 ohne eigenen Wrap', async function () {
  var admin = await neuerTenant('orgBlob_' + Date.now(), 'Org Blob GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'B' }) });
  var team = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'T', bezirkId: bez.body.id }) });
  var klient = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ teamId: team.body.id, label: 'Klient Blob', initialeWraps: [wrapFuer(admin.user.id)] })
  });
  var leer = await api(srv.basis, '/klient-blob/' + klient.body.klientId, { headers: { Authorization: 'Bearer ' + admin.token } });
  assert.equal(leer.status, 404);
  var put = await api(srv.basis, '/klient-blob/' + klient.body.klientId, {
    method: 'PUT', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ iv: 'x', ct: 'KLIENT_GEHEIMNIS' })
  });
  assert.equal(put.status, 200);
  var get = await api(srv.basis, '/klient-blob/' + klient.body.klientId, { headers: { Authorization: 'Bearer ' + admin.token } });
  assert.equal(get.body.ct, 'KLIENT_GEHEIMNIS');

  var maOhneZugriff = await neuerMa(admin.token, 'maBlobOhne_' + Date.now(), ['ma']);
  var fremd = await api(srv.basis, '/klient-blob/' + klient.body.klientId, { headers: { Authorization: 'Bearer ' + maOhneZugriff.token } });
  assert.equal(fremd.status, 404, 'Ohne eigenen Wrap darf der Klient-Blob nicht sichtbar sein (kein Leak der Existenz)');
});

test('PATCH /api/users/:id mit teamId: gültige Zuordnung + Ablehnung bei fremdem/ungültigem Team', async function () {
  var a = await neuerTenant('orgUserTeamA_' + Date.now(), 'Org UserTeamA GmbH');
  var b = await neuerTenant('orgUserTeamB_' + Date.now(), 'Org UserTeamB GmbH');
  var bezA = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + a.token }, body: JSON.stringify({ name: 'BezA' }) });
  var teamA = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + a.token }, body: JSON.stringify({ name: 'TeamA', bezirkId: bezA.body.id }) });
  var bezB = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + b.token }, body: JSON.stringify({ name: 'BezB' }) });
  var teamB = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + b.token }, body: JSON.stringify({ name: 'TeamB', bezirkId: bezB.body.id }) });

  var ma = await neuerMa(a.token, 'userTeamMa_' + Date.now(), ['ma']);
  var fremdesTeam = await api(srv.basis, '/users/' + ma.userId, { method: 'PATCH', headers: { Authorization: 'Bearer ' + a.token }, body: JSON.stringify({ teamId: teamB.body.id }) });
  assert.equal(fremdesTeam.status, 400, 'Team aus anderem Mandanten muss abgelehnt werden');
  var eigenesTeam = await api(srv.basis, '/users/' + ma.userId, { method: 'PATCH', headers: { Authorization: 'Bearer ' + a.token }, body: JSON.stringify({ teamId: teamA.body.id }) });
  assert.equal(eigenesTeam.status, 200);
  assert.equal(eigenesTeam.body.teamId, teamA.body.id);
});

test('DELETE /api/tenant löscht auch Bezirke/Teams/Klienten/Wraps/Klient-Blob vollständig (FK-Regressionsschutz)', async function () {
  var admin = await neuerTenant('orgDelete_' + Date.now(), 'Org Delete GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'B' }) });
  var team = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'T', bezirkId: bez.body.id }) });
  var klient = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ teamId: team.body.id, label: 'Klient Delete', initialeWraps: [wrapFuer(admin.user.id)] })
  });
  await api(srv.basis, '/klient-blob/' + klient.body.klientId, { method: 'PUT', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ iv: 'x', ct: 'y' }) });
  var del = await api(srv.basis, '/tenant', { method: 'DELETE', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ password: '123456' }) });
  assert.equal(del.status, 200, 'Löschung mit Bezirk/Team/Klient/Wrap/Blob darf NICHT an einem FOREIGN KEY-Fehler scheitern: ' + JSON.stringify(del.body));
});

// Nachtrag 2026-10-24 (2): Teamleiter darf via POST /api/klienten/:id/wraps Zugriff für Klienten
// des EIGENEN Teams an Ziel-Nutzer desselben Teams gewähren (René-Direktive, Alltagstauglichkeit).
test('Teamleiter kann für einen Klienten des eigenen Teams einem Team-Mitglied Zugriff gewähren (vorher 403, jetzt 200)', async function () {
  var admin = await neuerTenant('orgTlGrant_' + Date.now(), 'Org TlGrant GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'B' }) });
  var team = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'T1', bezirkId: bez.body.id }) });
  var tl = await neuerMa(admin.token, 'tlGrant_' + Date.now(), ['teamleiter']);
  await api(srv.basis, '/users/' + tl.userId, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ teamId: team.body.id }) });
  var ma2 = await neuerMa(admin.token, 'ma2Grant_' + Date.now(), ['ma']);
  await api(srv.basis, '/users/' + ma2.userId, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ teamId: team.body.id }) });

  var klient = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ teamId: team.body.id, label: 'Klient TL', initialeWraps: [wrapFuer(admin.user.id)] })
  });
  assert.equal(klient.status, 200);
  // Vorbedingung: tl braucht selbst einen Wrap (sonst greift die Plausibilitätsprüfung, nicht die
  // Rollenprüfung) -- Admin gewährt tl Zugriff, analog echtem Ablauf (Admin richtet Teamleiter ein).
  var tlErhaelt = await api(srv.basis, '/klienten/' + klient.body.klientId + '/wraps', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify(wrapFuer(tl.userId))
  });
  assert.equal(tlErhaelt.status, 200);

  var vorher403 = await api(srv.basis, '/klienten/' + klient.body.klientId + '/wraps', {
    method: 'POST', headers: { Authorization: 'Bearer ' + tl.token }, body: JSON.stringify(wrapFuer(ma2.userId))
  });
  // Diese Anfrage IST der zu testende Fall selbst (vorher wäre sie 403 gewesen) -- direkt prüfen.
  assert.equal(vorher403.status, 200, 'Teamleiter muss für Klienten des eigenen Teams Zugriff gewähren dürfen: ' + JSON.stringify(vorher403.body));

  var relogin = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: ma2.login.user.username, password: '222222' }) });
  assert.equal(relogin.body.klienten.length, 1, 'ma2 muss nach der Teamleiter-Freigabe den Klienten im Login-Vertrag sehen');
});

test('Teamleiter bekommt weiterhin 403 für einen teamfremden Klienten (eigener Wrap vorhanden)', async function () {
  var admin = await neuerTenant('orgTlFremd_' + Date.now(), 'Org TlFremd GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'B' }) });
  var teamEigen = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'TEigen', bezirkId: bez.body.id }) });
  var teamFremd = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'TFremd', bezirkId: bez.body.id }) });
  var tl = await neuerMa(admin.token, 'tlFremd_' + Date.now(), ['teamleiter']);
  await api(srv.basis, '/users/' + tl.userId, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ teamId: teamEigen.body.id }) });

  var klientFremd = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ teamId: teamFremd.body.id, label: 'Klient Fremdteam', initialeWraps: [wrapFuer(admin.user.id)] })
  });
  // tl bekommt (von Admin) ausnahmsweise einen eigenen Wrap für den teamfremden Klienten -- isoliert
  // den Rollen-/Team-Scope-Check von der reinen Plausibilitätsprüfung ("hat Aufrufer überhaupt einen
  // eigenen Wrap").
  await api(srv.basis, '/klienten/' + klientFremd.body.klientId + '/wraps', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify(wrapFuer(tl.userId))
  });
  var maFremd = await neuerMa(admin.token, 'maFremdZiel_' + Date.now(), ['ma']);
  await api(srv.basis, '/users/' + maFremd.userId, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ teamId: teamFremd.body.id }) });
  var r1 = await api(srv.basis, '/klienten/' + klientFremd.body.klientId + '/wraps', {
    method: 'POST', headers: { Authorization: 'Bearer ' + tl.token }, body: JSON.stringify(wrapFuer(maFremd.userId))
  });
  assert.equal(r1.status, 403, 'Klient gehört nicht zum Team des Teamleiters -- muss abgelehnt werden');

  // Umgekehrter Fall: Klient gehört zum EIGENEN Team des Teamleiters, Ziel-Nutzer aber zu einem
  // fremden Team -- muss ebenfalls abgelehnt werden.
  var klientEigen = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ teamId: teamEigen.body.id, label: 'Klient Eigenteam', initialeWraps: [wrapFuer(admin.user.id)] })
  });
  await api(srv.basis, '/klienten/' + klientEigen.body.klientId + '/wraps', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify(wrapFuer(tl.userId))
  });
  var r2 = await api(srv.basis, '/klienten/' + klientEigen.body.klientId + '/wraps', {
    method: 'POST', headers: { Authorization: 'Bearer ' + tl.token }, body: JSON.stringify(wrapFuer(maFremd.userId))
  });
  assert.equal(r2.status, 403, 'Ziel-Nutzer gehört nicht zum Team des Teamleiters -- muss abgelehnt werden');
});

// Nachtrag 2026-10-24 (2): GET /api/klienten (bislang fehlender Endpunkt) -- rollenbasiert
// scope-gefiltert, identisches Muster wie GET /api/teams/GET /api/bezirke.
test('GET /api/klienten ist rollenbasiert scope-gefiltert (admin/bezirksleitung/teamleiter/ma)', async function () {
  var admin = await neuerTenant('orgKlListe_' + Date.now(), 'Org KlListe GmbH');
  var bezA = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'KlA' }) });
  var bezB = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'KlB' }) });
  var teamA = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'TeamKlA', bezirkId: bezA.body.id }) });
  var teamB = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'TeamKlB', bezirkId: bezB.body.id }) });

  var klientA = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ teamId: teamA.body.id, label: 'Klient Liste A', initialeWraps: [wrapFuer(admin.user.id)] })
  });
  assert.equal(klientA.status, 200);
  var klientB = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ teamId: teamB.body.id, label: 'Klient Liste B', initialeWraps: [wrapFuer(admin.user.id)] })
  });
  assert.equal(klientB.status, 200);

  var bl = await neuerMa(admin.token, 'blKlListe_' + Date.now(), ['bezirksleitung']);
  await api(srv.basis, '/bezirke/' + bezA.body.id, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ leiterUserId: bl.userId }) });

  var tl = await neuerMa(admin.token, 'tlKlListe_' + Date.now(), ['teamleiter']);
  await api(srv.basis, '/users/' + tl.userId, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ teamId: teamA.body.id }) });

  var ma = await neuerMa(admin.token, 'maKlListe_' + Date.now(), ['ma']);
  await api(srv.basis, '/users/' + ma.userId, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ teamId: teamA.body.id }) });

  var alsAdmin = await api(srv.basis, '/klienten', { headers: { Authorization: 'Bearer ' + admin.token } });
  assert.equal(alsAdmin.body.length, 2, 'admin muss alle Klienten des Tenants sehen');

  var alsBl = await api(srv.basis, '/klienten', { headers: { Authorization: 'Bearer ' + bl.token } });
  assert.equal(alsBl.body.length, 1, 'bezirksleitung darf nur Klienten des eigenen Bezirks sehen');
  assert.equal(alsBl.body[0].id, klientA.body.klientId);

  var alsTl = await api(srv.basis, '/klienten', { headers: { Authorization: 'Bearer ' + tl.token } });
  assert.equal(alsTl.body.length, 1, 'teamleiter darf nur Klienten des eigenen Teams sehen');
  assert.equal(alsTl.body[0].id, klientA.body.klientId);
  assert.equal(alsTl.body[0].teamName, 'TeamKlA');
  assert.equal(alsTl.body[0].status, 'aktiv');

  var alsMa = await api(srv.basis, '/klienten', { headers: { Authorization: 'Bearer ' + ma.token } });
  assert.equal(alsMa.body.length, 1, 'ma darf nur Klienten des eigenen Teams sehen');
  assert.equal(alsMa.body[0].id, klientA.body.klientId);
});
