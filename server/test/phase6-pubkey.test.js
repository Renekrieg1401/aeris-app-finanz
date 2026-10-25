// K5 Public-Key-Envelope (2026-10-25, security-privacy-Architektur "Variante B"): Datenmodell +
// Server-Endpunkte fuer das eigene RSA-OAEP-Schluesselpaar (POST /api/users/me/keypair,
// GET /api/users/:id/public-key) + Login-Response-Erweiterung. Laeuft gegen eine ECHTE server.js-
// Instanz (Blackbox ueber HTTP), identisches Muster wie phase3-orgstruktur.test.js.
var test = require('node:test');
var assert = require('node:assert/strict');
var path = require('node:path');
var os = require('node:os');
var fs = require('node:fs');
var crypto = require('node:crypto');
var Database = require('better-sqlite3'); // in dieser Testumgebung durch sqlite-shim.js ersetzt
var { starteServer, starteMitPfaden, freierPort, api } = require('./helpers');

var srv;
test.before(async function () { srv = await starteServer(); });
test.after(async function () { await srv.stoppen(); srv.aufraeumen(); });

function dummyWrappedDek() { return { salt: 'c2FsdA==', iv: 'aXZpdml2', ct: 'Y3Q=' }; }
function dummyKeypair(tag) {
  return { publicKey: 'PUB-' + tag, wrappedPrivkey: { salt: 's-' + tag, iv: 'i-' + tag, ct: 'c-' + tag } };
}

async function neuerTenant(username, tenantName) {
  await api(srv.basis, '/setup', {
    method: 'POST',
    body: JSON.stringify({ tenantName: tenantName, username: username, password: '123456', displayName: username, wrappedDek: dummyWrappedDek() })
  });
  var login = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: '123456' }) });
  assert.equal(login.status, 200, 'Login nach Setup muss erfolgreich sein');
  return login.body; // { token, user, tenantId, tenantName, wrappedDek, publicKey, wrappedPrivkey, klienten }
}

async function neuerMa(adminToken, username) {
  var r = await api(srv.basis, '/users', {
    method: 'POST', headers: { Authorization: 'Bearer ' + adminToken },
    body: JSON.stringify({ username: username, password: '111111', displayName: username, wrappedDek: dummyWrappedDek(), roles: ['ma'] })
  });
  assert.equal(r.status, 200, 'Nutzer-Anlage muss funktionieren: ' + JSON.stringify(r.body));
  var login = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: '111111' }) });
  var geaendert = await api(srv.basis, '/me/password', {
    method: 'POST', headers: { Authorization: 'Bearer ' + login.body.token }, body: JSON.stringify({ password: '222222', wrappedDek: dummyWrappedDek() })
  });
  assert.equal(geaendert.status, 200);
  var zweiteLogin = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: username, password: '222222' }) });
  return { userId: r.body.id, token: zweiteLogin.body.token, login: zweiteLogin.body };
}

test('Login-Response liefert publicKey/wrappedPrivkey als null, solange noch kein Schlüsselpaar existiert', async function () {
  var admin = await neuerTenant('pkNull_' + Date.now(), 'PK Null GmbH');
  assert.equal(admin.publicKey, null);
  assert.equal(admin.wrappedPrivkey, null);
});

test('POST /api/users/me/keypair: setzt das Schlüsselpaar, zweiter Versuch ohne force -> 409', async function () {
  var admin = await neuerTenant('pkSet_' + Date.now(), 'PK Set GmbH');
  var kp = dummyKeypair('a');
  var r1 = await api(srv.basis, '/users/me/keypair', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify(kp) });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.publicKey, kp.publicKey);
  assert.equal(r1.body.wrappedPrivkey.salt, kp.wrappedPrivkey.salt);

  var kp2 = dummyKeypair('b');
  var r2 = await api(srv.basis, '/users/me/keypair', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify(kp2) });
  assert.equal(r2.status, 409);

  // Login danach liefert das ZUERST gesetzte Schlüsselpaar unverändert zurück (kein stiller Überschreib).
  var erneuterLogin = await api(srv.basis, '/login', { method: 'POST', body: JSON.stringify({ username: admin.user.username, password: '123456' }) });
  assert.equal(erneuterLogin.body.publicKey, kp.publicKey);
  assert.equal(erneuterLogin.body.wrappedPrivkey.ct, kp.wrappedPrivkey.ct);
});

test('POST /api/users/me/keypair mit force=true überschreibt ein bereits gesetztes Schlüsselpaar', async function () {
  var admin = await neuerTenant('pkForce_' + Date.now(), 'PK Force GmbH');
  var kp = dummyKeypair('a');
  await api(srv.basis, '/users/me/keypair', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify(kp) });
  var kp2 = dummyKeypair('b');
  var r = await api(srv.basis, '/users/me/keypair', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify(Object.assign({ force: true }, kp2))
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.publicKey, kp2.publicKey);
});

test('POST /api/users/me/keypair lehnt unvollständigen Body ab (400)', async function () {
  var admin = await neuerTenant('pkBad_' + Date.now(), 'PK Bad GmbH');
  var r = await api(srv.basis, '/users/me/keypair', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ publicKey: 'PUB' })
  });
  assert.equal(r.status, 400);
});

test('GET /api/users/:id/public-key liefert NUR publicKey eines fremden Nutzers desselben Tenants, niemals wrappedPrivkey', async function () {
  var admin = await neuerTenant('pkGet_' + Date.now(), 'PK Get GmbH');
  var ma = await neuerMa(admin.token, 'pkGetMa_' + Date.now());
  var kpMa = dummyKeypair('ma');
  var gesetzt = await api(srv.basis, '/users/me/keypair', { method: 'POST', headers: { Authorization: 'Bearer ' + ma.token }, body: JSON.stringify(kpMa) });
  assert.equal(gesetzt.status, 200);

  var r = await api(srv.basis, '/users/' + ma.userId + '/public-key', { headers: { Authorization: 'Bearer ' + admin.token } });
  assert.equal(r.status, 200);
  assert.equal(r.body.publicKey, kpMa.publicKey);
  assert.equal(Object.prototype.hasOwnProperty.call(r.body, 'wrappedPrivkey'), false);
});

test('GET /api/users/:id/public-key liefert publicKey:null, solange kein Schlüsselpaar existiert', async function () {
  var admin = await neuerTenant('pkGetNull_' + Date.now(), 'PK GetNull GmbH');
  var ma = await neuerMa(admin.token, 'pkGetNullMa_' + Date.now());
  var r = await api(srv.basis, '/users/' + ma.userId + '/public-key', { headers: { Authorization: 'Bearer ' + admin.token } });
  assert.equal(r.status, 200);
  assert.equal(r.body.publicKey, null);
});

test('GET /api/users/:id/public-key: Tenant-Isolation (404 bei fremdem Mandanten)', async function () {
  var a = await neuerTenant('pkIsoA_' + Date.now(), 'PK Iso A GmbH');
  var b = await neuerTenant('pkIsoB_' + Date.now(), 'PK Iso B GmbH');
  var r = await api(srv.basis, '/users/' + b.user.id + '/public-key', { headers: { Authorization: 'Bearer ' + a.token } });
  assert.equal(r.status, 404);
});

test('klient_dek_wraps akzeptiert wrap_art "pubkey" bei POST /api/klienten/:id/wraps', async function () {
  var admin = await neuerTenant('pkWrap_' + Date.now(), 'PK Wrap GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Nord' }) });
  var team = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'T1', bezirkId: bez.body.id }) });
  var klient = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ teamId: team.body.id, label: 'Klient Pubkey', initialeWraps: [{ userId: admin.user.id, wrapArt: 'pin', wrapSalt: 's', wrapIv: 'i', wrapCt: 'c' }] })
  });
  assert.equal(klient.status, 200, JSON.stringify(klient.body));

  var ma = await neuerMa(admin.token, 'pkWrapMa_' + Date.now());
  await api(srv.basis, '/users/' + ma.userId, { method: 'PATCH', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ teamId: team.body.id }) });

  var r = await api(srv.basis, '/klienten/' + klient.body.klientId + '/wraps', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ userId: ma.userId, wrapArt: 'pubkey', wrapSalt: 's2', wrapIv: 'i2', wrapCt: 'c2-pubkey-verschluesselt' })
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
});

// ---------- Echter Migrationstest gegen eine simulierte Alt-Schema-DB (Phase-3-Stand, VOR K5) ----------
// phase1-migration.test.js deckt nur den Zustand "klient_dek_wraps existiert noch gar nicht" ab -- die
// CHECK-Rebuild-Migration (s. db.js) greift aber nur, wenn die Tabelle BEREITS mit der ALTEN
// CHECK(wrap_art IN ('pin','recovery')) existiert (echter Produktionsstand seit 2026-10-24). Muss
// separat gegengetestet werden, sonst bleibt der riskanteste Teil der Migration (composite-PK-Tabelle
// neu anlegen+Daten kopieren) ungeprüft.
function seedeAltSchemaVorK5(dbPath) {
  var db = new Database(dbPath);
  db.exec(
    'CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);' +
    'CREATE TABLE users (' +
    '  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,' +
    '  display_name TEXT NOT NULL, role TEXT NOT NULL, telefon TEXT NOT NULL DEFAULT \'\',' +
    '  wrapped_dek_salt TEXT NOT NULL, wrapped_dek_iv TEXT NOT NULL, wrapped_dek_ct TEXT NOT NULL,' +
    '  active INTEGER NOT NULL DEFAULT 1, must_change_password INTEGER NOT NULL DEFAULT 0,' +
    '  pfk_kuerzel TEXT NOT NULL DEFAULT \'\', vorname TEXT NOT NULL DEFAULT \'\', nachname TEXT NOT NULL DEFAULT \'\',' +
    '  adresse TEXT NOT NULL DEFAULT \'\', firma TEXT NOT NULL DEFAULT \'\', personalnummer TEXT NOT NULL DEFAULT \'\',' +
    '  berufsstand TEXT NOT NULL DEFAULT \'\', team_id TEXT, created_at TEXT NOT NULL' +
    ');' +
    'CREATE TABLE blob (tenant_id TEXT PRIMARY KEY, iv TEXT NOT NULL, ct TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL);' +
    'CREATE TABLE login_sperre (art TEXT NOT NULL, schluessel TEXT NOT NULL, fehl INTEGER NOT NULL DEFAULT 0, bis TEXT NOT NULL DEFAULT \'\', PRIMARY KEY (art, schluessel));' +
    'CREATE TABLE bezirke (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, leiter_user_id TEXT, created_at TEXT NOT NULL);' +
    'CREATE TABLE teams (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, bezirk_id TEXT NOT NULL, name TEXT NOT NULL, leiter_user_id TEXT, created_at TEXT NOT NULL);' +
    'CREATE TABLE klienten (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, team_id TEXT, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT \'aktiv\', created_at TEXT NOT NULL);' +
    'CREATE TABLE klient_blob (klient_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, iv TEXT NOT NULL, ct TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL);' +
    'CREATE TABLE klient_dek_wraps (' +
    '  klient_id TEXT NOT NULL, user_id TEXT NOT NULL, wrap_salt TEXT NOT NULL, wrap_iv TEXT NOT NULL, wrap_ct TEXT NOT NULL,' +
    "  wrap_art TEXT NOT NULL CHECK(wrap_art IN ('pin','recovery'))," +
    '  granted_by TEXT NOT NULL, granted_at TEXT NOT NULL, PRIMARY KEY (klient_id, user_id, wrap_art)' +
    ');' +
    'CREATE TABLE user_roles (user_id TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY (user_id, role));' +
    'CREATE TABLE btm_praeparate (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, bezeichnung TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);' +
    'CREATE TABLE btm_eintraege (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, praeparat_id TEXT NOT NULL, typ TEXT NOT NULL, menge REAL NOT NULL, hash TEXT NOT NULL, prev_hash TEXT NOT NULL DEFAULT \'\', created_by TEXT NOT NULL, created_at TEXT NOT NULL);' +
    'CREATE TABLE mp_geraete (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, bezeichnung TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);' +
    'CREATE TABLE mp_eintraege (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, geraet_id TEXT NOT NULL, typ TEXT NOT NULL, datum TEXT NOT NULL, hash TEXT NOT NULL, prev_hash TEXT NOT NULL DEFAULT \'\', created_by TEXT NOT NULL, created_at TEXT NOT NULL);' +
    'CREATE TABLE meldungen (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, pfad TEXT NOT NULL, iso TEXT NOT NULL DEFAULT \'\', status TEXT NOT NULL DEFAULT \'offen\', gemeldet_von TEXT NOT NULL, entschieden_von TEXT, entschieden_am TEXT NOT NULL DEFAULT \'\', verknuepfter_eintrag_pfad TEXT NOT NULL DEFAULT \'\', created_at TEXT NOT NULL, payload_iv TEXT NOT NULL, payload_ct TEXT NOT NULL);' +
    'CREATE TABLE dienst_eintraege (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, datum TEXT NOT NULL, typ TEXT NOT NULL, kuerzel TEXT NOT NULL DEFAULT \'\', von TEXT NOT NULL DEFAULT \'\', bis TEXT NOT NULL DEFAULT \'\', status TEXT NOT NULL DEFAULT \'aktiv\', notiz TEXT NOT NULL DEFAULT \'\', hash TEXT NOT NULL, prev_hash TEXT NOT NULL DEFAULT \'\', created_by TEXT NOT NULL, created_at TEXT NOT NULL);'
  );

  var t0 = '2026-01-01T08:00:00.000Z';
  var tenantId = 'tenant-k5mig', userId = 'user-k5mig', klientId = 'klient-k5mig';
  db.prepare('INSERT INTO tenants (id, name, created_at) VALUES (?,?,?)').run(tenantId, 'K5-Migration GmbH', t0);
  db.prepare(
    'INSERT INTO users (id, tenant_id, username, password_hash, display_name, role, wrapped_dek_salt, wrapped_dek_iv, wrapped_dek_ct, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(userId, tenantId, 'admin_k5mig', require('bcryptjs').hashSync('472918', 10), 'Admin K5Mig', 'admin', 'c2FsdA==', 'aXZpdml2', 'Y3Q=', t0);
  db.prepare('INSERT INTO user_roles (user_id, role) VALUES (?,?)').run(userId, 'admin');
  db.prepare('INSERT INTO blob (tenant_id, iv, ct, updated_at, updated_by) VALUES (?,?,?,?,?)').run(tenantId, 'iv-blob', 'ct-blob', t0, userId);
  db.prepare('INSERT INTO klienten (id, tenant_id, team_id, label, status, created_at) VALUES (?,?,?,?,\'aktiv\',?)').run(klientId, tenantId, null, 'K5-Bestandsklient', t0);
  // Echter Bestands-Wrap mit der ALTEN, noch erlaubten wrap_art -- muss die Migration unveraendert ueberleben.
  db.prepare(
    'INSERT INTO klient_dek_wraps (klient_id, user_id, wrap_salt, wrap_iv, wrap_ct, wrap_art, granted_by, granted_at) VALUES (?,?,?,?,?,?,?,?)'
  ).run(klientId, userId, 's-alt', 'i-alt', 'c-alt-bestand', 'pin', userId, t0);
  db.close();
  return { tenantId: tenantId, userId: userId, klientId: klientId };
}

test('K5-Migration gegen echte Alt-Schema-DB: users-Spalten kommen nach, alte wrap_art-CHECK erlaubt jetzt "pubkey", Bestandszeile bleibt unverändert', async function () {
  var port = await freierPort();
  var kennung = crypto.randomBytes(8).toString('hex');
  var dbPath = path.join(os.tmpdir(), 'aeris-k5migration-' + kennung + '.db');
  var secretPath = path.join(os.tmpdir(), 'aeris-k5migration-' + kennung + '.jwt-secret.txt');
  var daten = seedeAltSchemaVorK5(dbPath);

  var instanz = await starteMitPfaden(port, dbPath, secretPath);

  var login = await api(instanz.basis, '/login', { method: 'POST', body: JSON.stringify({ username: 'admin_k5mig', password: '472918' }) });
  assert.equal(login.status, 200, 'Login muss nach der Migration weiterhin funktionieren: ' + JSON.stringify(login.body));
  assert.equal(login.body.publicKey, null, 'neue Spalte ist fuer den Bestandsnutzer NULL, nicht fehlerhaft befuellt');

  // Bestands-Wrap (wrap_art='pin') muss die Tabellen-Neuanlage unveraendert ueberlebt haben.
  var insp = new Database(dbPath);
  var bestandsZeile = insp.prepare('SELECT * FROM klient_dek_wraps WHERE klient_id = ? AND user_id = ? AND wrap_art = ?').get(daten.klientId, daten.userId, 'pin');
  assert.ok(bestandsZeile, 'Bestandszeile muss nach der Migration weiterhin existieren');
  assert.equal(bestandsZeile.wrap_ct, 'c-alt-bestand');
  insp.close();

  // Jetzt muss sich eine NEUE Zeile mit wrap_art='pubkey' einfügen lassen -- das schlägt mit der ALTEN
  // CHECK-Einschränkung sofort mit einem SQLite-Constraint-Fehler fehl, wenn die Migration nicht lief.
  var neuerWrap = await api(instanz.basis, '/klienten/' + daten.klientId + '/wraps', {
    method: 'POST', headers: { Authorization: 'Bearer ' + login.body.token },
    body: JSON.stringify({ userId: daten.userId, wrapArt: 'pubkey', wrapSalt: 's-neu', wrapIv: 'i-neu', wrapCt: 'c-neu-pubkey' })
  });
  assert.equal(neuerWrap.status, 200, JSON.stringify(neuerWrap.body));

  await instanz.stoppen();
  ['', '-wal', '-shm'].forEach(function (suffix) { try { fs.unlinkSync(dbPath + suffix); } catch (e) {} });
  try { fs.unlinkSync(secretPath); } catch (e) {}
});

test('POST /api/klienten/:id/wraps lehnt weiterhin ungültige wrapArt ab (400)', async function () {
  var admin = await neuerTenant('pkWrapBad_' + Date.now(), 'PK WrapBad GmbH');
  var bez = await api(srv.basis, '/bezirke', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'Nord' }) });
  var team = await api(srv.basis, '/teams', { method: 'POST', headers: { Authorization: 'Bearer ' + admin.token }, body: JSON.stringify({ name: 'T1', bezirkId: bez.body.id }) });
  var klient = await api(srv.basis, '/klienten', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ teamId: team.body.id, label: 'Klient X', initialeWraps: [{ userId: admin.user.id, wrapArt: 'pin', wrapSalt: 's', wrapIv: 'i', wrapCt: 'c' }] })
  });
  var ma = await neuerMa(admin.token, 'pkWrapBadMa_' + Date.now());
  var r = await api(srv.basis, '/klienten/' + klient.body.klientId + '/wraps', {
    method: 'POST', headers: { Authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ userId: ma.userId, wrapArt: 'unsinn', wrapSalt: 's', wrapIv: 'i', wrapCt: 'c' })
  });
  assert.equal(r.status, 400);
});
