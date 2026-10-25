// Organisationsstruktur-Umbau 2026-10-24: POST /api/setup verlangt jetzt die Besetzung aller 4
// Pflichtrollen (admin/hr/bezirksleitung/teamleiter) -- entweder verteilt auf bis zu 4 Accounts
// oder gebuendelt auf 1 Account (Mehrfachrollen, René-Entscheidung). Altes Singular-Format bleibt
// als Abkuerzung ohne 4-Rollen-Pflicht funktionsfaehig. Blackbox gegen echte server.js-Instanz,
// identisches Muster wie server.test.js/phase3-orgstruktur.test.js.
var test = require('node:test');
var assert = require('node:assert/strict');
var { starteServer, api } = require('./helpers');

var srv;
test.before(async function () { srv = await starteServer(); });
test.after(async function () { await srv.stoppen(); srv.aufraeumen(); });

function dummyWrappedDek() { return { salt: 'c2FsdA==', iv: 'aXZpdml2', ct: 'Y3Q=' }; }
function acc(username, roles) {
  return { username: username, password: '123456', displayName: username, wrappedDek: dummyWrappedDek(), roles: roles };
}

test('4-Rollen-Registrierung mit 4 getrennten Accounts gelingt, Leiter-Referenzen + team_id korrekt gesetzt', async function () {
  var p = 'k4a_' + Date.now();
  var r = await api(srv.basis, '/setup', {
    method: 'POST',
    body: JSON.stringify({
      tenantName: 'Vier GmbH', bezirkName: 'Nord', teamName: 'Team A',
      accounts: [
        acc(p + '_admin', ['admin']), acc(p + '_hr', ['hr']),
        acc(p + '_bl', ['bezirksleitung']), acc(p + '_tl', ['teamleiter'])
      ]
    })
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.users.length, 4);
  var adminLogin = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: p + '_admin', password: '123456' }) });
  assert.equal(adminLogin.status, 200);
  var token = adminLogin.body.token;
  var bezirke = await api(srv.basis, '/bezirke', { headers: { Authorization: 'Bearer ' + token } });
  var teams = await api(srv.basis, '/teams', { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(bezirke.body[0].leiterUserId, r.body.users.filter(function (u) { return u.roles.indexOf('bezirksleitung') !== -1; })[0].id);
  assert.equal(teams.body[0].leiterUserId, r.body.users.filter(function (u) { return u.roles.indexOf('teamleiter') !== -1; })[0].id);
  var tlUsers = await api(srv.basis, '/users', { headers: { Authorization: 'Bearer ' + token } });
  var tlUser = tlUsers.body.filter(function (u) { return u.username === p + '_tl'; })[0];
  assert.equal(tlUser.teamId, teams.body[0].id, 'teamleiter-Account muss team_id = neues Team haben');
  var adminUser = tlUsers.body.filter(function (u) { return u.username === p + '_admin'; })[0];
  assert.equal(adminUser.teamId, null, 'reiner admin-Account ohne teamleiter-Rolle bleibt ohne team_id');
});

test('4-Rollen-Registrierung mit 1 Account + 4 Rollen (Mehrfachrollen) gelingt, team_id gesetzt trotz admin-Kombination', async function () {
  var u = 'k4b_' + Date.now();
  var r = await api(srv.basis, '/setup', {
    method: 'POST',
    body: JSON.stringify({ tenantName: 'Klein GmbH', accounts: [acc(u, ['admin', 'hr', 'bezirksleitung', 'teamleiter'])] })
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.users.length, 1);
  assert.deepEqual(r.body.users[0].roles.slice().sort(), ['admin', 'bezirksleitung', 'hr', 'teamleiter']);
  var login = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: u, password: '123456' }) });
  assert.equal(login.status, 200);
  var teams = await api(srv.basis, '/teams', { headers: { Authorization: 'Bearer ' + login.body.token } });
  assert.equal(teams.body[0].leiterUserId, r.body.users[0].id, 'bei Kombi-Account mit teamleiter muss Team-Leiter gesetzt sein');
  var bezirke = await api(srv.basis, '/bezirke', { headers: { Authorization: 'Bearer ' + login.body.token } });
  assert.equal(bezirke.body[0].leiterUserId, r.body.users[0].id);
  var users = await api(srv.basis, '/users', { headers: { Authorization: 'Bearer ' + login.body.token } });
  assert.equal(users.body[0].teamId, teams.body[0].id, 'admin+teamleiter-Kombi muss trotz admin-Rolle team_id haben (explizite Vorgabe "egal welche anderen Rollen")');
});

test('Fehlende Pflichtrolle wird mit 400 und klarer Meldung abgelehnt', async function () {
  var p = 'k4c_' + Date.now();
  var r = await api(srv.basis, '/setup', {
    method: 'POST',
    body: JSON.stringify({ tenantName: 'Luecke GmbH', accounts: [acc(p + '_a', ['admin']), acc(p + '_h', ['hr'])] })
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /bezirksleitung/);
  assert.match(r.body.error, /teamleiter/);
});

test('Doppelt vergebene Pflichtrolle (zwei Accounts mit "admin") wird mit 400 abgelehnt', async function () {
  var p = 'k4d_' + Date.now();
  var r = await api(srv.basis, '/setup', {
    method: 'POST',
    body: JSON.stringify({
      tenantName: 'Doppel GmbH',
      accounts: [acc(p + '_a1', ['admin']), acc(p + '_a2', ['admin', 'hr', 'bezirksleitung', 'teamleiter'])]
    })
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /admin/);
});

test('Altes Singular-Format ohne "accounts" bleibt funktionsfähig, 4-Rollen-Pflicht greift NICHT, Default-Bezirk/-Team werden trotzdem angelegt', async function () {
  var u = 'k4e_' + Date.now();
  var r = await api(srv.basis, '/setup', {
    method: 'POST',
    body: JSON.stringify({ tenantName: 'Alt GmbH', username: u, password: '654321', displayName: u, wrappedDek: dummyWrappedDek() })
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  var login = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: u, password: '654321' }) });
  assert.equal(login.status, 200, 'Login nach Alt-Format-Setup muss weiterhin funktionieren');
  var teams = await api(srv.basis, '/teams', { headers: { Authorization: 'Bearer ' + login.body.token } });
  assert.equal(teams.body.length, 1, 'auch im Alt-Format wird ein Default-Team angelegt');
  var bezirke = await api(srv.basis, '/bezirke', { headers: { Authorization: 'Bearer ' + login.body.token } });
  assert.equal(bezirke.body.length, 1, 'auch im Alt-Format wird ein Default-Bezirk angelegt');
});
