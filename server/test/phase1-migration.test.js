// Organisationsstruktur Phase 1 (2026-10-24, software-architect-Konzept, René 1:1 bestaetigt):
// Datenmodell + Migrationslogik fuer "Klient"-Konzept (bezirke/teams/klienten/klient_blob/
// klient_dek_wraps/user_roles + klient_id-Spalten). Dieser Test seedet eine SIMULIERTE
// Alt-Schema-Datenbank (echte Bestandsdaten, exakt wie die heutige Produktionsschema-Version VOR
// diesem Umbau) und prueft, dass db.js's automatische Migration beim ersten Serverstart danach
// korrekt + idempotent + hash-kettensicher lief -- Blackbox gegen eine ECHTE server.js-Instanz,
// kein Mock der Fachlogik (nur die SQLite-Bindung selbst ist in dieser Testumgebung geshimmt,
// s. test/sqlite-shim.js, wegen des bekannten better-sqlite3/Node-v26.4.0-Kompilierproblems).
var test = require('node:test');
var assert = require('node:assert/strict');
var path = require('node:path');
var os = require('node:os');
var fs = require('node:fs');
var crypto = require('node:crypto');
var bcrypt = require('bcryptjs');
var Database = require('better-sqlite3'); // in dieser Testumgebung durch sqlite-shim.js ersetzt
var { starteMitPfaden, freierPort, api } = require('./helpers');

// Repliziert bewusst 1:1 die AKTUELLE (nach eigenem Gegentest korrigierte) btmContentHash()-Logik aus
// server.js -- klient_id wird NIE aufgenommen (Backfill-Problem, s. Kommentar dort), chargen_nr/
// verfallsdatum nur wenn nicht NULL. Diese Kopie ist bewusst unabhaengig von server.js, damit der Test
// einen ECHTEN Hash seedet, nicht einen von server.js selbst zur Laufzeit erzeugten.
function btmContentHashReferenz(e, prevHash) {
  var basis = {
    tenantId: e.tenant_id, praeparatId: e.praeparat_id, typ: e.typ, menge: e.menge, einheit: e.einheit,
    datum: e.datum, uhrzeit: e.uhrzeit, bestandVorher: e.bestand_vorher, bestandNachher: e.bestand_nachher,
    gegenpart: e.gegenpart, verordner: e.verordner, rezeptNr: e.rezept_nr, pflegekraft: e.pflegekraft,
    zeuge: e.zeuge, bemerkung: e.bemerkung, createdBy: e.created_by, createdAt: e.created_at
  };
  if (e.chargen_nr !== null && e.chargen_nr !== undefined) basis.chargenNr = e.chargen_nr;
  if (e.verfallsdatum !== null && e.verfallsdatum !== undefined) basis.verfallsdatum = e.verfallsdatum;
  return crypto.createHash('sha256').update(JSON.stringify(basis) + '|' + prevHash, 'utf8').digest('hex');
}

function neueDbDatei() {
  var kennung = crypto.randomBytes(8).toString('hex');
  return path.join(os.tmpdir(), 'aeris-phase1-migration-' + kennung + '.db');
}

// Seedet eine Datenbank-Datei im EXAKTEN Schema-Stand "unmittelbar vor" der Phase-1-Migration --
// also inklusive aller zuvor schon gelandeten additiven Spalten (must_change_password, pfk_kuerzel,
// Profilfelder, chargen_nr/verfallsdatum), aber OHNE jede der neuen Phase-1-Tabellen/-Spalten.
function seedeAltSchema(dbPath) {
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
    '  berufsstand TEXT NOT NULL DEFAULT \'\', created_at TEXT NOT NULL' +
    ');' +
    'CREATE TABLE blob (tenant_id TEXT PRIMARY KEY, iv TEXT NOT NULL, ct TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL);' +
    'CREATE TABLE login_sperre (art TEXT NOT NULL, schluessel TEXT NOT NULL, fehl INTEGER NOT NULL DEFAULT 0, bis TEXT NOT NULL DEFAULT \'\', PRIMARY KEY (art, schluessel));' +
    'CREATE TABLE btm_praeparate (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, bezeichnung TEXT NOT NULL, wirkstoff TEXT NOT NULL DEFAULT \'\', staerke TEXT NOT NULL DEFAULT \'\', darreichungsform TEXT NOT NULL DEFAULT \'\', created_by TEXT NOT NULL, created_at TEXT NOT NULL);' +
    'CREATE TABLE btm_eintraege (' +
    '  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, praeparat_id TEXT NOT NULL, typ TEXT NOT NULL, menge REAL NOT NULL,' +
    '  einheit TEXT NOT NULL DEFAULT \'\', datum TEXT NOT NULL, uhrzeit TEXT NOT NULL DEFAULT \'\', bestand_vorher REAL NOT NULL,' +
    '  bestand_nachher REAL NOT NULL, gegenpart TEXT NOT NULL DEFAULT \'\', verordner TEXT NOT NULL DEFAULT \'\', rezept_nr TEXT NOT NULL DEFAULT \'\',' +
    '  chargen_nr TEXT, verfallsdatum TEXT, pflegekraft TEXT NOT NULL DEFAULT \'\', zeuge TEXT NOT NULL DEFAULT \'\', bemerkung TEXT NOT NULL DEFAULT \'\',' +
    '  hash TEXT NOT NULL, prev_hash TEXT NOT NULL DEFAULT \'\', created_by TEXT NOT NULL, created_at TEXT NOT NULL' +
    ');' +
    'CREATE TABLE mp_geraete (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, bezeichnung TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);' +
    'CREATE TABLE mp_eintraege (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, geraet_id TEXT NOT NULL, typ TEXT NOT NULL, datum TEXT NOT NULL, hash TEXT NOT NULL, prev_hash TEXT NOT NULL DEFAULT \'\', created_by TEXT NOT NULL, created_at TEXT NOT NULL);' +
    'CREATE TABLE meldungen (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, pfad TEXT NOT NULL, iso TEXT NOT NULL DEFAULT \'\', status TEXT NOT NULL DEFAULT \'offen\', gemeldet_von TEXT NOT NULL, entschieden_von TEXT, entschieden_am TEXT NOT NULL DEFAULT \'\', verknuepfter_eintrag_pfad TEXT NOT NULL DEFAULT \'\', created_at TEXT NOT NULL, payload_iv TEXT NOT NULL, payload_ct TEXT NOT NULL);' +
    'CREATE TABLE dienst_eintraege (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, datum TEXT NOT NULL, typ TEXT NOT NULL, kuerzel TEXT NOT NULL DEFAULT \'\', von TEXT NOT NULL DEFAULT \'\', bis TEXT NOT NULL DEFAULT \'\', status TEXT NOT NULL DEFAULT \'aktiv\', notiz TEXT NOT NULL DEFAULT \'\', hash TEXT NOT NULL, prev_hash TEXT NOT NULL DEFAULT \'\', created_by TEXT NOT NULL, created_at TEXT NOT NULL);'
  );

  var jwtKennung = 'Phase1Migration';
  var tenantA = 'tenant-a-' + jwtKennung, tenantB = 'tenant-b-' + jwtKennung;
  var userAdmin = 'user-admin-' + jwtKennung, userMa = 'user-ma-' + jwtKennung, userB = 'user-b-' + jwtKennung;
  var t0 = '2026-01-01T08:00:00.000Z';

  db.prepare('INSERT INTO tenants (id, name, created_at) VALUES (?,?,?)').run(tenantA, 'Pflegedienst A GmbH', t0);
  db.prepare('INSERT INTO tenants (id, name, created_at) VALUES (?,?,?)').run(tenantB, 'Pflegedienst B GmbH', t0);

  var pin = '472918';
  var passwortHash = bcrypt.hashSync(pin, 10);
  db.prepare(
    'INSERT INTO users (id, tenant_id, username, password_hash, display_name, role, wrapped_dek_salt, wrapped_dek_iv, wrapped_dek_ct, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(userAdmin, tenantA, 'admin_a', passwortHash, 'Admina A', 'admin', 'c2FsdC1hZG1pbg==', 'aXZpdml2YWQ=', 'Y3QtYWRtaW4=', t0);
  db.prepare(
    'INSERT INTO users (id, tenant_id, username, password_hash, display_name, role, wrapped_dek_salt, wrapped_dek_iv, wrapped_dek_ct, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(userMa, tenantA, 'ma_a', passwortHash, 'Maria A', 'ma', 'c2FsdC1tYQ==', 'aXZpdml2bWE=', 'Y3QtbWE=', t0);
  // Tenant B hat einen Nutzer, aber BEWUSST KEINE Blob-Zeile -- darf laut Architektur NICHT migriert
  // werden (Alt-Klient entsteht nur "pro existierendem Tenant mit einer Zeile in blob").
  db.prepare(
    'INSERT INTO users (id, tenant_id, username, password_hash, display_name, role, wrapped_dek_salt, wrapped_dek_iv, wrapped_dek_ct, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(userB, tenantB, 'admin_b', passwortHash, 'Admina B', 'admin', 'c2FsdC1i', 'aXZpdmli', 'Y3QtYg==', t0);

  db.prepare('INSERT INTO blob (tenant_id, iv, ct, updated_at, updated_by) VALUES (?,?,?,?,?)')
    .run(tenantA, 'iv-original-blob-a', 'ct-original-blob-a-unveraendert', t0, userAdmin);

  var praeparatId = 'praeparat-' + jwtKennung;
  db.prepare('INSERT INTO btm_praeparate (id, tenant_id, bezeichnung, created_by, created_at) VALUES (?,?,?,?,?)')
    .run(praeparatId, tenantA, 'Morphin 10mg/ml', userAdmin, t0);

  // Zwei echte, verkettete BTM-Eintraege MIT echtem, zu diesem Zeitpunkt (klient_id existiert noch
  // nicht) korrekt berechnetem Hash -- das ist der kritische Bestand, dessen Kette nach der Migration
  // unveraendert "intakt" bleiben muss.
  var e1 = {
    id: 'btm-e1-' + jwtKennung, tenant_id: tenantA, praeparat_id: praeparatId, typ: 'zugang', menge: 100,
    einheit: 'ml', datum: '2026-01-02', uhrzeit: '08:00', bestand_vorher: 0, bestand_nachher: 100,
    gegenpart: 'Apotheke', verordner: 'Dr. Beispiel', rezept_nr: 'RZ-1', chargen_nr: null, verfallsdatum: null,
    pflegekraft: 'Admina A', zeuge: '', bemerkung: '', created_by: userAdmin, created_at: '2026-01-02T08:00:00.000Z'
  };
  e1.prev_hash = '';
  e1.hash = btmContentHashReferenz(e1, e1.prev_hash);
  var e2 = {
    id: 'btm-e2-' + jwtKennung, tenant_id: tenantA, praeparat_id: praeparatId, typ: 'abgang', menge: 5,
    einheit: 'ml', datum: '2026-01-03', uhrzeit: '09:00', bestand_vorher: 100, bestand_nachher: 95,
    gegenpart: '', verordner: '', rezept_nr: '', chargen_nr: null, verfallsdatum: null,
    pflegekraft: 'Maria A', zeuge: '', bemerkung: 'Routine', created_by: userMa, created_at: '2026-01-03T09:00:00.000Z'
  };
  e2.prev_hash = e1.hash;
  e2.hash = btmContentHashReferenz(e2, e2.prev_hash);
  [e1, e2].forEach(function (e) {
    db.prepare(
      'INSERT INTO btm_eintraege (id, tenant_id, praeparat_id, typ, menge, einheit, datum, uhrzeit, bestand_vorher, bestand_nachher, gegenpart, verordner, rezept_nr, chargen_nr, verfallsdatum, pflegekraft, zeuge, bemerkung, hash, prev_hash, created_by, created_at) ' +
      'VALUES (@id,@tenant_id,@praeparat_id,@typ,@menge,@einheit,@datum,@uhrzeit,@bestand_vorher,@bestand_nachher,@gegenpart,@verordner,@rezept_nr,@chargen_nr,@verfallsdatum,@pflegekraft,@zeuge,@bemerkung,@hash,@prev_hash,@created_by,@created_at)'
    ).run(e);
  });

  db.close();
  return { tenantA: tenantA, tenantB: tenantB, userAdmin: userAdmin, userMa: userMa, userB: userB, pin: pin, e1: e1, e2: e2, praeparatId: praeparatId };
}

function oeffneZurInspektion(dbPath) { return new Database(dbPath); }

test('Phase 1: Alt-Klient-Migration -- Blob-Kopie bit-identisch, Wraps uebertragen, Hash-Kette bleibt intakt, Idempotenz', async function (t) {
  var dbPath = neueDbDatei();
  var secretPath = dbPath + '.jwt-secret.txt';
  var daten = seedeAltSchema(dbPath);

  var port = await freierPort();
  var instanz = await starteMitPfaden(port, dbPath, secretPath);

  await t.test('Alt-Klient wurde fuer Tenant A angelegt, Tenant B (kein Blob) NICHT migriert', function () {
    var insp = oeffneZurInspektion(dbPath);
    var klientenA = insp.prepare('SELECT * FROM klienten WHERE tenant_id = ?').all(daten.tenantA);
    assert.equal(klientenA.length, 1, 'genau ein Alt-Klient fuer Tenant A');
    assert.equal(klientenA[0].label, 'Bestandsklient (migriert)');
    assert.equal(klientenA[0].status, 'aktiv');
    assert.equal(klientenA[0].team_id, null, 'Alt-Klient hat zunaechst kein Team');

    var klientenB = insp.prepare('SELECT * FROM klienten WHERE tenant_id = ?').all(daten.tenantB);
    assert.equal(klientenB.length, 0, 'Tenant B ohne Blob-Zeile wird NICHT migriert');
    insp.close();
  });

  var altKlientId;
  await t.test('klient_blob ist bit-identisch zur ursprueglichen blob-Zeile', function () {
    var insp = oeffneZurInspektion(dbPath);
    altKlientId = insp.prepare('SELECT id FROM klienten WHERE tenant_id = ?').get(daten.tenantA).id;
    var kb = insp.prepare('SELECT * FROM klient_blob WHERE klient_id = ?').get(altKlientId);
    assert.ok(kb, 'klient_blob-Zeile existiert');
    assert.equal(kb.iv, 'iv-original-blob-a');
    assert.equal(kb.ct, 'ct-original-blob-a-unveraendert');
    assert.equal(kb.tenant_id, daten.tenantA);
    insp.close();
  });

  await t.test('klient_dek_wraps: beide Nutzer 1:1 uebertragen (wrap_art=pin)', function () {
    var insp = oeffneZurInspektion(dbPath);
    var wraps = insp.prepare('SELECT * FROM klient_dek_wraps WHERE klient_id = ? ORDER BY user_id').all(altKlientId);
    assert.equal(wraps.length, 2, 'ein Wrap je Nutzer von Tenant A');
    wraps.forEach(function (w) {
      assert.equal(w.wrap_art, 'pin');
      assert.equal(w.granted_by, w.user_id, 'granted_by = die Person selbst (hatte den Zugriff bereits)');
    });
    var adminWrap = wraps.find(function (w) { return w.user_id === daten.userAdmin; });
    assert.equal(adminWrap.wrap_salt, 'c2FsdC1hZG1pbg==');
    assert.equal(adminWrap.wrap_iv, 'aXZpdml2YWQ=');
    assert.equal(adminWrap.wrap_ct, 'Y3QtYWRtaW4=');
    insp.close();
  });

  await t.test('btm_eintraege: klient_id auf den Alt-Klienten verankert, hash/prev_hash UNVERAENDERT', function () {
    var insp = oeffneZurInspektion(dbPath);
    var rows = insp.prepare('SELECT * FROM btm_eintraege WHERE tenant_id = ? ORDER BY rowid').all(daten.tenantA);
    assert.equal(rows.length, 2);
    rows.forEach(function (r) { assert.equal(r.klient_id, altKlientId, 'klient_id korrekt auf den Alt-Klienten zurueckgefuehrt'); });
    assert.equal(rows[0].hash, daten.e1.hash, 'Hash des 1. Eintrags identisch zum VOR der Migration gespeicherten Wert');
    assert.equal(rows[1].hash, daten.e2.hash, 'Hash des 2. Eintrags identisch zum VOR der Migration gespeicherten Wert');
    assert.equal(rows[1].prev_hash, rows[0].hash);
    insp.close();
  });

  await t.test('user_roles: Backfill der heutigen Singular-Rolle fuer ALLE Nutzer (auch Tenant B)', function () {
    var insp = oeffneZurInspektion(dbPath);
    // assert.equal auf dem einzelnen Feld statt deepEqual auf der ganzen Zeile -- node:sqlite liefert
    // "null prototype"-Objekte (anders als better-sqlite3s normale Objekte), das ist ein reines
    // Artefakt der Test-Shim-Bindung, kein Fachunterschied.
    assert.equal(insp.prepare('SELECT role FROM user_roles WHERE user_id = ?').get(daten.userAdmin).role, 'admin');
    assert.equal(insp.prepare('SELECT role FROM user_roles WHERE user_id = ?').get(daten.userMa).role, 'ma');
    assert.equal(insp.prepare('SELECT role FROM user_roles WHERE user_id = ?').get(daten.userB).role, 'admin', 'auch Tenant B (kein Blob) bekommt den Rollen-Backfill');
    insp.close();
  });

  await t.test('echte HTTP-API /api/btm/kette-pruefen meldet NACH der Migration weiterhin "intakt" (kein false positive durch klient_id)', async function () {
    var login = await api(instanz.basis, '/login', { method: 'POST', body: JSON.stringify({ username: 'admin_a', password: daten.pin }) });
    assert.equal(login.status, 200);
    var pruefung = await api(instanz.basis, '/btm/kette-pruefen', { headers: { Authorization: 'Bearer ' + login.body.token } });
    assert.equal(pruefung.status, 200);
    assert.equal(pruefung.body.anzahl, 2);
    assert.equal(pruefung.body.intakt, true, 'Hash-Kette darf durch die Migration NICHT als manipuliert erscheinen');
    assert.equal(pruefung.body.ersterManipulierterEintrag, null);
  });

  await instanz.stoppen();

  await t.test('Idempotenz: zweiter Serverstart gegen dieselbe (bereits migrierte) DB legt NICHTS doppelt an', async function () {
    var zweiteInstanz = await starteMitPfaden(port, dbPath, secretPath);
    var insp = oeffneZurInspektion(dbPath);
    assert.equal(insp.prepare('SELECT COUNT(*) AS n FROM klienten WHERE tenant_id = ?').get(daten.tenantA).n, 1, 'kein zweiter Alt-Klient');
    assert.equal(insp.prepare('SELECT COUNT(*) AS n FROM klient_dek_wraps WHERE klient_id = ?').get(altKlientId).n, 2, 'keine doppelten Wraps');
    assert.equal(insp.prepare('SELECT COUNT(*) AS n FROM klient_blob WHERE klient_id = ?').get(altKlientId).n, 1, 'kein doppelter Blob');
    assert.equal(insp.prepare('SELECT COUNT(*) AS n FROM user_roles').get().n, 3, 'user_roles bleibt bei 3 Zeilen (eine je Nutzer)');
    insp.close();
    await zweiteInstanz.stoppen();
  });

  ['', '-wal', '-shm'].forEach(function (suffix) { try { fs.unlinkSync(dbPath + suffix); } catch (e) {} });
  try { fs.unlinkSync(secretPath); } catch (e) {}
});
