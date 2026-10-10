// AERIS-Server: Multi-User/Mandanten-Backend. Siehe db.js für das Sicherheitsprinzip
// (Server sieht nie DEK oder Klardaten). Läuft hinter dem bestehenden Nginx-Reverse-Proxy
// (HTTPS + Basic-Auth) auf 212.132.117.130, lokal nur HTTP auf 127.0.0.1:8787.
var express = require('express');
var cors = require('cors');
var crypto = require('crypto');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var fs = require('fs');
var path = require('path');
var db = require('./db');

// AERIS_JWT_SECRET_PATH überschreibt den Pfad (für die Testsuite, analog AERIS_DB_PATH in db.js) --
// nie die echte, produktive jwt-secret.txt für Tests anfassen/löschen.
var SECRET_FILE = process.env.AERIS_JWT_SECRET_PATH || path.join(__dirname, 'jwt-secret.txt');
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
var JWT_SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();

var app = express();
app.set('trust proxy', true); // hinter Nginx (X-Forwarded-For) -- req.ip sonst immer 127.0.0.1
// AERIS_ALLOWED_ORIGIN überschreibt den erlaubten CORS-Origin (devops-infra-Fund 2026-10-09:
// vorher Wildcard `cors()` ohne jede Origin-Einschränkung). Der Client ruft die API ausschließlich
// relativ (`/api/...`, s. aeris-server.js) vom selben Origin auf -- Zugriffe von jedem ANDEREN
// Origin sind architektonisch nicht vorgesehen, daher harte Einschränkung statt Wildcard. Bei einem
// künftigen Domain-Wechsel (s. "Offene Entscheidungen" Punkt 6, echtes CA-Zertifikat) genügt eine
// Env-Var-Änderung, kein Code-Fix.
var ALLOWED_ORIGIN = process.env.AERIS_ALLOWED_ORIGIN || 'https://212.132.117.130';
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '20mb' }));

function uuid() { return crypto.randomUUID(); }
function nowIso() { return new Date().toISOString(); }
function sha256Hex(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }
// René-Direktive 2026-10-09: NEUE PINs müssen genau 6 Ziffern haben (kein 4-5-stelliges Wahlrecht
// mehr). Serverseitig geprüft (nicht nur im Client, s. aeris-server.js), da Client-Validierung sich
// umgehen lässt (z.B. direkter API-Aufruf). Gilt für /api/setup, /api/users (POST), /password-reset,
// /api/me/password -- NICHT für /api/login (das prüft eine bereits bestehende, evtl. ältere PIN).
function istGueltigeNeuePin(p) { return /^\d{6}$/.test(p || ''); }

// ---------- Rate-Limiting /api/login (security-privacy-Gegenprüfung 2026-10-09: PIN ist nur
// 4-6-stellig, max. 1 Mio. Kombinationen -- ohne Schutz wäre das ein triviales Online-Brute-Force-
// Ziel, sobald der Server erreichbar ist). Persistent in SQLite (Korrektur-Potenzial-Fund
// 2026-10-09, Nachtrag: ein rein In-Memory-Lockout überlebt keinen Server-Neustart/Deploy und
// wäre damit wirkungslos genau in dem Moment, in dem ein Angreifer einen Neustart erzwingen
// könnte, z.B. über den ohnehin vorhandenen systemd-Restart-on-failure). Sperrdauer/Schwelle
// identisch zum bereits bestehenden lokalen PIN-Gate (app.js AE_PIN_MAX=5, 15 Min). ----------
var LOGIN_MAX = 5, IP_MAX = 20, LOCK_MS = 15 * 60 * 1000;
var DUMMY_HASH = bcrypt.hashSync('kein-echtes-konto', 10); // gegen Username-Enumeration per Timing (s. u.)
function gesperrtBis(art, key) {
  var row = db.prepare('SELECT bis FROM login_sperre WHERE art = ? AND schluessel = ?').get(art, key);
  if (!row || !row.bis) return 0;
  var bis = new Date(row.bis).getTime();
  if (bis <= Date.now()) { db.prepare('DELETE FROM login_sperre WHERE art = ? AND schluessel = ?').run(art, key); return 0; }
  return bis;
}
function vermerkeFehlversuch(art, key, max) {
  var row = db.prepare('SELECT fehl FROM login_sperre WHERE art = ? AND schluessel = ?').get(art, key);
  var fehl = (row ? row.fehl : 0) + 1;
  var bis = '';
  if (fehl >= max) { bis = new Date(Date.now() + LOCK_MS).toISOString(); fehl = 0; }
  db.prepare(
    'INSERT INTO login_sperre (art, schluessel, fehl, bis) VALUES (?,?,?,?) ' +
    'ON CONFLICT(art, schluessel) DO UPDATE SET fehl = excluded.fehl, bis = excluded.bis'
  ).run(art, key, fehl, bis);
}
function entsperre(art, key) { db.prepare('DELETE FROM login_sperre WHERE art = ? AND schluessel = ?').run(art, key); }
function sperrMinuten(bis) { return Math.max(1, Math.ceil((bis - Date.now()) / 60000)); }

function publicUser(u) {
  return { id: u.id, username: u.username, displayName: u.display_name, role: u.role, telefon: u.telefon, active: !!u.active, mustChangePassword: !!u.must_change_password };
}

// security-privacy-Gegenprüfung 2026-10-09: must_change_password war bis hierhin reines Client-UI-
// Theater -- ein direkter API-Aufruf mit dem gültigen Bearer-Token konnte den Pflicht-PIN-Wechsel
// komplett umgehen, der Server prüfte das Flag nirgends. Erlaubt bleiben nur die Routen, die der
// Pflicht-Wechsel-Ablauf selbst braucht (eigene Daten lesen, um sie im Speicher zu halten + die
// PIN tatsächlich ändern) -- alles andere (Schreiben, Team-Verwaltung, Dienstplan, ...) ist gesperrt,
// bis die Person eine eigene PIN gesetzt hat.
var AUTH_TROTZ_PFLICHT_WECHSEL_ERLAUBT = { 'GET /api/me': true, 'GET /api/blob': true, 'POST /api/me/password': true };
function auth(req, res, next) {
  var h = req.headers.authorization || '';
  var m = /^Bearer (.+)$/.exec(h);
  if (!m) return res.status(401).json({ error: 'Kein Token.' });
  try {
    var payload = jwt.verify(m[1], JWT_SECRET);
    var user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'Account nicht mehr aktiv.' });
    if (user.must_change_password && !AUTH_TROTZ_PFLICHT_WECHSEL_ERLAUBT[req.method + ' ' + req.path]) {
      return res.status(403).json({ error: 'PIN muss zuerst geändert werden.', mustChangePassword: true });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token ungültig oder abgelaufen.' });
  }
}
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur für Admins.' });
  next();
}

// ---------- Setup: neuer Mandant + erster Admin-Account ----------
app.post('/api/setup', function (req, res) {
  var b = req.body || {};
  if (!b.tenantName || !b.username || !b.password || !b.displayName || !b.wrappedDek) {
    return res.status(400).json({ error: 'tenantName, username, password, displayName, wrappedDek erforderlich.' });
  }
  if (!istGueltigeNeuePin(b.password)) return res.status(400).json({ error: 'PIN muss genau 6 Ziffern haben.' });
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(b.username)) {
    return res.status(409).json({ error: 'Benutzername bereits vergeben.' });
  }
  var tenantId = uuid(), userId = uuid(), ts = nowIso();
  var tx = db.transaction(function () {
    db.prepare('INSERT INTO tenants (id, name, created_at) VALUES (?,?,?)').run(tenantId, b.tenantName, ts);
    db.prepare(
      'INSERT INTO users (id, tenant_id, username, password_hash, display_name, role, telefon, wrapped_dek_salt, wrapped_dek_iv, wrapped_dek_ct, active, created_at) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?,1,?)'
    ).run(userId, tenantId, b.username, bcrypt.hashSync(b.password, 10), b.displayName, 'admin', b.telefon || '',
      b.wrappedDek.salt, b.wrappedDek.iv, b.wrappedDek.ct, ts);
  });
  tx();
  res.json({ tenantId: tenantId, userId: userId });
});

// ---------- Login ----------
app.post('/api/login', function (req, res) {
  var b = req.body || {};
  var username = b.username || '', ip = req.ip;
  var ipBis = gesperrtBis('ip', ip);
  if (ipBis) return res.status(429).json({ error: 'Zu viele Anmeldeversuche von dieser Verbindung — bitte in ' + sperrMinuten(ipBis) + ' Minute(n) erneut versuchen.' });
  var userBis = gesperrtBis('user', username);
  if (userBis) return res.status(429).json({ error: 'Zu viele Fehlversuche für diesen Benutzernamen — bitte in ' + sperrMinuten(userBis) + ' Minute(n) erneut versuchen.' });
  var u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  // Gegen Konto existiert vs. Passwort falsch unterscheidbar via Antwortzeit: bcrypt läuft IMMER
  // (gegen einen Dummy-Hash bei unbekanntem Username), nicht nur wenn der Account real existiert.
  var passwortOk = bcrypt.compareSync(b.password || '', u ? u.password_hash : DUMMY_HASH);
  if (!u || !u.active || !passwortOk) {
    vermerkeFehlversuch('user', username, LOGIN_MAX);
    vermerkeFehlversuch('ip', ip, IP_MAX);
    return res.status(401).json({ error: 'Benutzername oder Passwort falsch, oder Account deaktiviert.' });
  }
  entsperre('user', username); entsperre('ip', ip);
  var tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(u.tenant_id);
  var token = jwt.sign({ sub: u.id, tenantId: u.tenant_id, role: u.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({
    token: token,
    user: publicUser(u),
    tenantId: tenant.id,
    tenantName: tenant.name,
    wrappedDek: { salt: u.wrapped_dek_salt, iv: u.wrapped_dek_iv, ct: u.wrapped_dek_ct }
  });
});

app.get('/api/me', auth, function (req, res) {
  var tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.user.tenant_id);
  res.json({ user: publicUser(req.user), tenantId: tenant.id, tenantName: tenant.name });
});

// ---------- Nutzerverwaltung (Mandant-intern) ----------
app.get('/api/users', auth, function (req, res) {
  var rows = db.prepare('SELECT * FROM users WHERE tenant_id = ? ORDER BY display_name').all(req.user.tenant_id);
  res.json(rows.map(publicUser));
});

app.post('/api/users', auth, requireAdmin, function (req, res) {
  var b = req.body || {};
  if (!b.username || !b.password || !b.displayName || !b.wrappedDek) {
    return res.status(400).json({ error: 'username, password, displayName, wrappedDek erforderlich.' });
  }
  if (!istGueltigeNeuePin(b.password)) return res.status(400).json({ error: 'Start-PIN muss genau 6 Ziffern haben.' });
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(b.username)) {
    return res.status(409).json({ error: 'Benutzername bereits vergeben.' });
  }
  var userId = uuid(), ts = nowIso();
  // must_change_password = 1: René-Direktive 2026-10-09 -- eine vom Admin vergebene PIN ist eine
  // Einmal-PIN, die Person MUSS sie beim ersten Login sofort durch eine eigene ersetzen.
  db.prepare(
    'INSERT INTO users (id, tenant_id, username, password_hash, display_name, role, telefon, wrapped_dek_salt, wrapped_dek_iv, wrapped_dek_ct, active, must_change_password, created_at) ' +
    'VALUES (?,?,?,?,?,?,?,?,?,?,1,1,?)'
  ).run(userId, req.user.tenant_id, b.username, bcrypt.hashSync(b.password, 10), b.displayName,
    b.role === 'admin' ? 'admin' : 'ma', b.telefon || '', b.wrappedDek.salt, b.wrappedDek.iv, b.wrappedDek.ct, ts);
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId)));
});

app.patch('/api/users/:id', auth, requireAdmin, function (req, res) {
  var u = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!u) return res.status(404).json({ error: 'Nicht gefunden.' });
  var b = req.body || {};
  db.prepare('UPDATE users SET display_name = ?, telefon = ?, role = ?, active = ? WHERE id = ?').run(
    typeof b.displayName === 'string' ? b.displayName : u.display_name,
    typeof b.telefon === 'string' ? b.telefon : u.telefon,
    b.role === 'admin' || b.role === 'ma' ? b.role : u.role,
    typeof b.active === 'boolean' ? (b.active ? 1 : 0) : u.active,
    u.id
  );
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)));
});

// Passwort-Reset durch Admin: Admin hat die DEK im Speicher (nach eigenem Login) und wrappt sie
// client-seitig mit dem neuen Passwort des Ziel-Nutzers neu -- der Server bekommt nur das Ergebnis.
app.post('/api/users/:id/password-reset', auth, requireAdmin, function (req, res) {
  var u = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!u) return res.status(404).json({ error: 'Nicht gefunden.' });
  var b = req.body || {};
  if (!b.password || !b.wrappedDek) return res.status(400).json({ error: 'password, wrappedDek erforderlich.' });
  if (!istGueltigeNeuePin(b.password)) return res.status(400).json({ error: 'PIN muss genau 6 Ziffern haben.' });
  // Ein Admin-Reset ist ebenfalls eine Einmal-PIN -- erneut Pflicht-Änderung beim nächsten Login,
  // DEK bleibt dabei unverändert (nur neu gewrappt), also kein Datenverlust/keine Sperre der
  // bisherigen Dokumentations-Einträge (René-Direktive, "Achtung"-Punkt).
  db.prepare('UPDATE users SET password_hash = ?, wrapped_dek_salt = ?, wrapped_dek_iv = ?, wrapped_dek_ct = ?, must_change_password = 1 WHERE id = ?')
    .run(bcrypt.hashSync(b.password, 10), b.wrappedDek.salt, b.wrappedDek.iv, b.wrappedDek.ct, u.id);
  res.json({ ok: true });
});

// Eigenes Passwort ändern (Nutzer hat die DEK selbst im Speicher, wrappt client-seitig neu) --
// hebt must_change_password auf, da die Person jetzt selbst eine eigene PIN gewählt hat.
app.post('/api/me/password', auth, function (req, res) {
  var b = req.body || {};
  if (!b.password || !b.wrappedDek) return res.status(400).json({ error: 'password, wrappedDek erforderlich.' });
  if (!istGueltigeNeuePin(b.password)) return res.status(400).json({ error: 'PIN muss genau 6 Ziffern haben.' });
  db.prepare('UPDATE users SET password_hash = ?, wrapped_dek_salt = ?, wrapped_dek_iv = ?, wrapped_dek_ct = ?, must_change_password = 0 WHERE id = ?')
    .run(bcrypt.hashSync(b.password, 10), b.wrappedDek.salt, b.wrappedDek.iv, b.wrappedDek.ct, req.user.id);
  res.json({ ok: true });
});

// ---------- Tenant-Löschung (Art. 17 DSGVO, René-Auftrag 2026-10-10) ----------
// Vorher gab es nur Deaktivieren einzelner Nutzer (users.active), keine echte Loeschung eines
// ganzen Mandanten -- legal-compliance-Fund 2026-10-02 ("kein echter Loeschmechanismus"). Admin-
// only, verlangt die eigene PIN erneut als Bestaetigung (schuetzt gegen versehentliches/CSRF-
// ausgeloestes Loeschen ueber einen reinen Button-Klick). Unwiderruflich -- loescht in einer
// Transaktion alle Tenant-skopierten Zeilen (Dienstplan, Blob, alle Nutzer) + den Tenant selbst.
// security-privacy-Fund Runde 2 (2026-10-10): die PIN-Reauthentifizierung hatte KEIN Lockout --
// wer an ein gueltiges Admin-JWT kommt, haette die 6-stellige PIN unbegrenzt online durchprobieren
// und am Ende den gesamten Mandanten unwiderruflich loeschen koennen. Gleicher Mechanismus wie
// /api/login (persistent, ueberlebt einen Neustart), eigener 'tenant_delete'-Sperr-Typ pro User-ID.
var TENANT_DELETE_MAX = 5;
app.delete('/api/tenant', auth, requireAdmin, function (req, res) {
  var b = req.body || {};
  var sperrBis = gesperrtBis('tenant_delete', req.user.id);
  if (sperrBis) return res.status(429).json({ error: 'Zu viele Fehlversuche — bitte in ' + sperrMinuten(sperrBis) + ' Minute(n) erneut versuchen.' });
  if (!b.password) return res.status(400).json({ error: 'Eigene PIN zur Bestätigung erforderlich.' });
  if (!bcrypt.compareSync(b.password, req.user.password_hash)) {
    vermerkeFehlversuch('tenant_delete', req.user.id, TENANT_DELETE_MAX);
    return res.status(401).json({ error: 'PIN stimmt nicht überein.' });
  }
  entsperre('tenant_delete', req.user.id);
  var tenantId = req.user.tenant_id;
  var tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
  // Audit-Log VOR der Loeschung schreiben (security-privacy-Fund: "kein Audit-Log, wer wann
  // welchen Mandanten geloescht hat") -- eigene Tabelle, nicht Teil der Loesch-Transaktion unten,
  // damit der Eintrag die Loeschung selbst ueberlebt.
  db.prepare('INSERT INTO audit_log (id, aktion, akteur_user_id, akteur_username, ziel_tenant_id, ziel_tenant_name, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(uuid(), 'tenant_geloescht', req.user.id, req.user.username, tenantId, tenant ? tenant.name : '', nowIso());
  var tx = db.transaction(function () {
    db.prepare('DELETE FROM dienst_eintraege WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM blob WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM users WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM tenants WHERE id = ?').run(tenantId);
  });
  tx();
  res.json({ ok: true });
});

// ---------- Tenant-Blob (verschlüsselte Pflege-/Finanzdokumentation, s. db.js) ----------
app.get('/api/blob', auth, function (req, res) {
  var row = db.prepare('SELECT * FROM blob WHERE tenant_id = ?').get(req.user.tenant_id);
  if (!row) return res.status(404).json({ error: 'Noch kein Datenstand.' });
  res.json({ iv: row.iv, ct: row.ct, updatedAt: row.updated_at });
});
app.put('/api/blob', auth, function (req, res) {
  var b = req.body || {};
  if (!b.iv || !b.ct) return res.status(400).json({ error: 'iv, ct erforderlich.' });
  var ts = nowIso();
  db.prepare(
    'INSERT INTO blob (tenant_id, iv, ct, updated_at, updated_by) VALUES (?,?,?,?,?) ' +
    'ON CONFLICT(tenant_id) DO UPDATE SET iv = excluded.iv, ct = excluded.ct, updated_at = excluded.updated_at, updated_by = excluded.updated_by'
  ).run(req.user.tenant_id, b.iv, b.ct, ts, req.user.id);
  res.json({ ok: true, updatedAt: ts });
});

// ---------- Dienstplan: append-only, hash-verkettet (manipulationssicher) ----------
function dienstContentHash(e, prevHash) {
  return sha256Hex(JSON.stringify({
    tenantId: e.tenant_id, userId: e.user_id, datum: e.datum, typ: e.typ, kuerzel: e.kuerzel,
    von: e.von, bis: e.bis, status: e.status, notiz: e.notiz, createdBy: e.created_by, createdAt: e.created_at
  }) + '|' + prevHash);
}
function rowToDienst(r) {
  return { id: r.id, userId: r.user_id, datum: r.datum, typ: r.typ, kuerzel: r.kuerzel, von: r.von, bis: r.bis, status: r.status, notiz: r.notiz, createdBy: r.created_by, createdAt: r.created_at };
}

app.get('/api/dienst', auth, function (req, res) {
  var von = req.query.von || '0000-01-01', bis = req.query.bis || '9999-12-31';
  var rows = db.prepare(
    'SELECT d.*, u.display_name AS user_name, u.telefon AS user_telefon FROM dienst_eintraege d ' +
    'JOIN users u ON u.id = d.user_id WHERE d.tenant_id = ? AND d.datum >= ? AND d.datum <= ? ORDER BY d.datum, d.rowid'
  ).all(req.user.tenant_id, von, bis);
  res.json(rows.map(function (r) {
    var o = rowToDienst(r); o.userName = r.user_name; o.userTelefon = r.user_telefon; return o;
  }));
});

// Jeder Mandant-Nutzer darf einen neuen Eintrag anlegen -- auch für eine andere Person (deckt den
// Auftrag "aktueller Dienst vermerkt, dass der NÄCHSTE Dienst krank ist" ab). Append-only: das
// überschreibt nichts, es fügt ein neues Ereignis an -- "gültiger Stand" ist der jüngste Eintrag
// pro (user,datum), die Historie bleibt für die Manipulationsprüfung vollständig erhalten.
app.post('/api/dienst', auth, function (req, res) {
  var b = req.body || {};
  if (!b.userId || !b.datum || !b.typ) return res.status(400).json({ error: 'userId, datum, typ erforderlich.' });
  var ziel = db.prepare('SELECT id FROM users WHERE id = ? AND tenant_id = ?').get(b.userId, req.user.tenant_id);
  if (!ziel) return res.status(404).json({ error: 'Zielnutzer nicht in diesem Mandanten gefunden.' });
  var last = db.prepare('SELECT hash FROM dienst_eintraege WHERE tenant_id = ? ORDER BY rowid DESC LIMIT 1').get(req.user.tenant_id);
  var prevHash = last ? last.hash : '';
  var e = {
    id: uuid(), tenant_id: req.user.tenant_id, user_id: b.userId, datum: b.datum, typ: b.typ,
    kuerzel: b.kuerzel || '', von: b.von || '', bis: b.bis || '', status: b.status || 'aktiv',
    notiz: b.notiz || '', created_by: req.user.id, created_at: nowIso()
  };
  e.hash = dienstContentHash(e, prevHash);
  e.prev_hash = prevHash;
  db.prepare(
    'INSERT INTO dienst_eintraege (id, tenant_id, user_id, datum, typ, kuerzel, von, bis, status, notiz, hash, prev_hash, created_by, created_at) ' +
    'VALUES (@id,@tenant_id,@user_id,@datum,@typ,@kuerzel,@von,@bis,@status,@notiz,@hash,@prev_hash,@created_by,@created_at)'
  ).run(e);
  res.json(rowToDienst(e));
});

app.get('/api/dienst/kette-pruefen', auth, function (req, res) {
  var rows = db.prepare('SELECT * FROM dienst_eintraege WHERE tenant_id = ? ORDER BY rowid').all(req.user.tenant_id);
  var prevHash = '', manipuliert = null;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.prev_hash !== prevHash || dienstContentHash(r, prevHash) !== r.hash) { manipuliert = r.id; break; }
    prevHash = r.hash;
  }
  res.json({ anzahl: rows.length, intakt: manipuliert === null, ersterManipulierterEintrag: manipuliert });
});

app.use(function (err, req, res, next) {
  console.error('Unbehandelter Fehler:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Interner Serverfehler.' });
});

var PORT = process.env.PORT || 8787;
var server = app.listen(PORT, '127.0.0.1', function () { console.log('AERIS-Server läuft auf 127.0.0.1:' + PORT); });

function graceful(signal) {
  console.log('AERIS-Server: ' + signal + ' empfangen, fahre geordnet herunter ...');
  server.close(function () {
    db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', function () { graceful('SIGTERM'); });
process.on('SIGINT', function () { graceful('SIGINT'); });
