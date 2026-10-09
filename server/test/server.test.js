// Automatisierte Testsuite (Korrektur-Potenzial-Fund 2026-10-09: "keine automatisierten Tests/CI,
// die die Tenant-Isolation dauerhaft absichern" -- bisher nur manuelle Playwright-Läufe in einem
// Scratchpad, nie committed, nie automatisch nachgeprüft). Läuft gegen eine ECHTE server.js-Instanz
// (Blackbox über HTTP), mit node:test (Node-eingebaut, kein neues npm-Package). Start: `npm test`
// im Verzeichnis server/, oder node --test test/ direkt. CI: s. .github/workflows/test.yml.
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
  return login.body; // { token, user, tenantId, tenantName, wrappedDek }
}

test('Setup + Login roundtrip liefert gültiges Token', async function () {
  var a = await neuerTenant('rt_' + Date.now(), 'RT GmbH');
  assert.ok(a.token && a.token.length > 20);
  assert.equal(a.user.role, 'admin');
});

test('Auth: geschützte Route ohne Token lehnt ab (401)', async function () {
  var r = await api(srv.basis, '/blob');
  assert.equal(r.status, 401);
});

test('Auth: geschützte Route mit Fantasie-Token lehnt ab (401)', async function () {
  var r = await api(srv.basis, '/blob', { headers: { Authorization: 'Bearer nicht.wirklich.gueltig' } });
  assert.equal(r.status, 401);
});

test('Tenant-Isolation: Blob von Mandant A ist für Mandant B unsichtbar', async function () {
  var a = await neuerTenant('isoA_' + Date.now(), 'Isolation A GmbH');
  var b = await neuerTenant('isoB_' + Date.now(), 'Isolation B GmbH');
  await api(srv.basis, '/blob', { method: 'PUT', headers: { Authorization: 'Bearer ' + a.token }, body: JSON.stringify({ iv: 'x', ct: 'GEHEIMNIS_VON_A' }) });
  var blobB = await api(srv.basis, '/blob', { headers: { Authorization: 'Bearer ' + b.token } });
  assert.ok(!blobB.body.ct || blobB.body.ct !== 'GEHEIMNIS_VON_A', 'Mandant B darf Mandant As Blob nie sehen');
});

test('Tenant-Isolation: /api/users liefert nur eigene Mandant-Nutzer', async function () {
  var a = await neuerTenant('isoUA_' + Date.now(), 'Isolation UA GmbH');
  var b = await neuerTenant('isoUB_' + Date.now(), 'Isolation UB GmbH');
  var usersA = await api(srv.basis, '/users', { headers: { Authorization: 'Bearer ' + a.token } });
  assert.equal(usersA.body.length, 1);
  assert.equal(usersA.body[0].id, a.user.id);
});

test('Tenant-Isolation: Dienst-Eintrag für fremden Mandant-Nutzer wird abgelehnt (404)', async function () {
  var a = await neuerTenant('isoDA_' + Date.now(), 'Isolation DA GmbH');
  var b = await neuerTenant('isoDB_' + Date.now(), 'Isolation DB GmbH');
  var r = await api(srv.basis, '/dienst', {
    method: 'POST', headers: { Authorization: 'Bearer ' + a.token },
    body: JSON.stringify({ userId: b.user.id, datum: '2026-12-01', typ: 'frueh' })
  });
  assert.equal(r.status, 404);
});

test('Tenant-Isolation: Passwort-Reset für fremden Mandant-Nutzer wird abgelehnt (404)', async function () {
  var a = await neuerTenant('isoPA_' + Date.now(), 'Isolation PA GmbH');
  var b = await neuerTenant('isoPB_' + Date.now(), 'Isolation PB GmbH');
  var r = await api(srv.basis, '/users/' + b.user.id + '/password-reset', {
    method: 'POST', headers: { Authorization: 'Bearer ' + a.token },
    body: JSON.stringify({ password: '999999', wrappedDek: dummyWrappedDek() })
  });
  assert.equal(r.status, 404);
});

test('Tenant-Isolation: PATCH für fremden Mandant-Nutzer wird abgelehnt (404)', async function () {
  var a = await neuerTenant('isoCA_' + Date.now(), 'Isolation CA GmbH');
  var b = await neuerTenant('isoCB_' + Date.now(), 'Isolation CB GmbH');
  var r = await api(srv.basis, '/users/' + b.user.id, {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + a.token }, body: JSON.stringify({ active: false })
  });
  assert.equal(r.status, 404);
  var check = await api(srv.basis, '/users', { headers: { Authorization: 'Bearer ' + b.token } });
  assert.equal(check.body[0].active, true, 'B darf von A nicht deaktiviert worden sein');
});

test('Dienstplan-Kette: intakt nach normalem Betrieb, Manipulation wird erkannt', async function () {
  var a = await neuerTenant('ketteA_' + Date.now(), 'Kette GmbH');
  await api(srv.basis, '/dienst', { method: 'POST', headers: { Authorization: 'Bearer ' + a.token }, body: JSON.stringify({ userId: a.user.id, datum: '2026-12-02', typ: 'frueh' }) });
  await api(srv.basis, '/dienst', { method: 'POST', headers: { Authorization: 'Bearer ' + a.token }, body: JSON.stringify({ userId: a.user.id, datum: '2026-12-03', typ: 'nacht' }) });
  var vorher = await api(srv.basis, '/dienst/kette-pruefen', { headers: { Authorization: 'Bearer ' + a.token } });
  assert.equal(vorher.body.intakt, true);
  // echte Manipulation direkt in der DB-Datei (nicht über die API -- die API erzwingt ja die Kette)
  var Database = require('better-sqlite3');
  var roheDb = new Database(srv.dbPath);
  roheDb.prepare("UPDATE dienst_eintraege SET kuerzel = 'MANIPULIERT' WHERE tenant_id = ?").run((await api(srv.basis, '/me', { headers: { Authorization: 'Bearer ' + a.token } })).body.tenantId);
  roheDb.close();
  var nachher = await api(srv.basis, '/dienst/kette-pruefen', { headers: { Authorization: 'Bearer ' + a.token } });
  assert.equal(nachher.body.intakt, false, 'Manipulation muss erkannt werden');
});

test('Rate-Limiting: 5 Fehlversuche sperren den Account für 15 Minuten', async function () {
  var username = 'rl_' + Date.now();
  await api(srv.basis, '/setup', { method: 'POST', body: JSON.stringify({ tenantName: 'RL GmbH', username: username, password: '555555', displayName: 'RL', wrappedDek: dummyWrappedDek() }) });
  for (var i = 0; i < 5; i++) {
    var r = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: 'falsch' + i }) });
    assert.equal(r.status, 401);
  }
  var gesperrt = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: '555555' }) });
  assert.equal(gesperrt.status, 429, 'Nach 5 Fehlversuchen muss auch die RICHTIGE PIN abgelehnt werden');
});

test('Rate-Limiting: Sperre übersteht einen Server-Neustart (persistent statt In-Memory)', async function () {
  var username = 'rlrestart_' + Date.now();
  await api(srv.basis, '/setup', { method: 'POST', body: JSON.stringify({ tenantName: 'RLR GmbH', username: username, password: '666666', displayName: 'RLR', wrappedDek: dummyWrappedDek() }) });
  for (var i = 0; i < 5; i++) await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: 'falsch' + i }) });
  var vorNeustart = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: '666666' }) });
  assert.equal(vorNeustart.status, 429);
  await srv.neuStarten();
  var nachNeustart = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: '666666' }) });
  assert.equal(nachNeustart.status, 429, 'Sperre muss einen Neustart überstehen (SQLite statt In-Memory-Map)');
});

test('Krypto-Grundlage: PBKDF2+AES-GCM-DEK-Wrapping-Roundtrip (Node Web Crypto, spiegelt aeris-server.js)', async function () {
  var enc = new TextEncoder();
  var dek = crypto.getRandomValues(new Uint8Array(32));
  var salt = crypto.getRandomValues(new Uint8Array(16));
  var pin = '123456';
  var keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
  var wrapKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 150000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, wrapKey, dek);
  // Richtige PIN entschlüsselt korrekt
  var keyMaterial2 = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
  var wrapKey2 = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 150000, hash: 'SHA-256' }, keyMaterial2, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  var entschluesselt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, wrapKey2, ct));
  assert.deepEqual(Array.from(entschluesselt), Array.from(dek));
  // Falsche PIN muss am GCM-Auth-Tag scheitern, nicht still falsche Daten liefern
  var keyMaterial3 = await crypto.subtle.importKey('raw', enc.encode('999999'), { name: 'PBKDF2' }, false, ['deriveKey']);
  var falscherKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 150000, hash: 'SHA-256' }, keyMaterial3, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await assert.rejects(crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, falscherKey, ct));
});
