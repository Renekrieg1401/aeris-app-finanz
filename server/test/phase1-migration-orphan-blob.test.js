// devops-infra-Fund 2026-10-25 (Produktions-Crash-Loop): die Organisationsstruktur-Phase-1-
// Migration (db.js) legte fuer JEDE Zeile in "blob" einen "Alt-Klienten" an, ohne zu pruefen, ob
// die zugehoerige tenant_id noch in "tenants" existiert. Eine verwaiste "blob"-Zeile (Rest eines
// frueheren Smoke-Tests, von VOR Einfuehrung von DELETE /api/tenant am 2026-10-10) liess
// "INSERT INTO klienten(...,tenant_id,...)" an "REFERENCES tenants(id)" scheitern -- FOREIGN KEY
// constraint failed bei JEDEM Serverstart. Dieser Test seedet exakt diesen Fall (verwaiste
// blob-Zeile OHNE tenants-Zeile, NEBEN einem normalen, gueltigen Tenant) und prueft: (a) der
// Server bootet ohne Crash, (b) der gueltige Tenant wird weiterhin korrekt migriert, (c) fuer die
// verwaiste tenant_id entsteht KEIN Alt-Klient, (d) die verwaiste blob-Zeile bleibt unangetastet
// (kein Datenverlust -- die Migration ueberspringt sie nur, loescht sie nicht).
var test = require('node:test');
var assert = require('node:assert/strict');
var path = require('node:path');
var os = require('node:os');
var fs = require('node:fs');
var crypto = require('node:crypto');
var bcrypt = require('bcryptjs');
var Database = require('better-sqlite3'); // in dieser Testumgebung durch sqlite-shim.js ersetzt
var { starteMitPfaden, freierPort, api } = require('./helpers');

function neueDbDatei() {
  var kennung = crypto.randomBytes(8).toString('hex');
  return path.join(os.tmpdir(), 'aeris-phase1-orphan-blob-' + kennung + '.db');
}

// Minimal-Schema im Stand "unmittelbar vor" der Phase-1-Migration -- identische Tabellenliste wie
// test/phase1-migration.test.js's seedeAltSchema() (dort NICHT exportiert, daher hier bewusst
// eigenstaendig gehalten, analog dem bereits etablierten Muster "eigener Migrationstest mit
// eigener Alt-Schema-Seed-Funktion" aus dem K5-Envelope-Nachtrag 2026-10-25).
function seedeAltSchemaMitVerwaisterBlobZeile(dbPath) {
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

  var kennung = 'OrphanBlob';
  var tenantGueltig = 'tenant-gueltig-' + kennung;
  var tenantVerwaist = 'tenant-verwaist-' + kennung; // BEWUSST NICHT in "tenants" eingefuegt
  var userGueltig = 'user-gueltig-' + kennung;
  var t0 = '2026-01-01T08:00:00.000Z';

  db.prepare('INSERT INTO tenants (id, name, created_at) VALUES (?,?,?)').run(tenantGueltig, 'Pflegedienst Gueltig GmbH', t0);

  var pin = '583147';
  var passwortHash = bcrypt.hashSync(pin, 10);
  db.prepare(
    'INSERT INTO users (id, tenant_id, username, password_hash, display_name, role, wrapped_dek_salt, wrapped_dek_iv, wrapped_dek_ct, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(userGueltig, tenantGueltig, 'admin_gueltig', passwortHash, 'Admina Gueltig', 'admin', 'c2FsdC1n', 'aXZpdmln', 'Y3QtZw==', t0);

  db.prepare('INSERT INTO blob (tenant_id, iv, ct, updated_at, updated_by) VALUES (?,?,?,?,?)')
    .run(tenantGueltig, 'iv-gueltig', 'ct-gueltig', t0, userGueltig);

  // Die verwaiste Zeile: blob existiert, tenants-Zeile fehlt (identisch zum Produktions-Fund
  // tenant_id=5b307d49-45aa-41a4-9c85-a950c498e424) UND kein users-Eintrag -- genau der
  // "0 Zeilen in tenants fuer diese ID"-Zustand aus dem Auftrag.
  db.prepare('INSERT INTO blob (tenant_id, iv, ct, updated_at, updated_by) VALUES (?,?,?,?,?)')
    .run(tenantVerwaist, 'iv-verwaist-unveraendert', 'ct-verwaist-unveraendert', t0, 'ghost-user');

  db.close();
  return { tenantGueltig: tenantGueltig, tenantVerwaist: tenantVerwaist, userGueltig: userGueltig, pin: pin };
}

function oeffneZurInspektion(dbPath) { return new Database(dbPath); }

test('Phase 1: verwaiste blob-Zeile ohne Tenant darf die Migration NICHT crashen', async function (t) {
  var dbPath = neueDbDatei();
  var secretPath = dbPath + '.jwt-secret.txt';
  var daten = seedeAltSchemaMitVerwaisterBlobZeile(dbPath);

  var port = await freierPort();
  // Reproduziert den Produktions-Crash-Loop VOR dem Fix: db.js wirft beim ersten "require" (Boot-
  // Zeitpunkt, VOR app.listen) eine FOREIGN KEY constraint failed-Exception, der Prozess crasht
  // sofort -- starteMitPfaden() wuerde dann nach 10s Polling mit "nicht bereit geworden" fehlschlagen.
  // Nach dem Fix bootet der Server normal.
  var instanz = await starteMitPfaden(port, dbPath, secretPath);

  await t.test('gueltiger Tenant wurde trotzdem korrekt zu einem Alt-Klienten migriert', function () {
    var insp = oeffneZurInspektion(dbPath);
    var klientenGueltig = insp.prepare('SELECT * FROM klienten WHERE tenant_id = ?').all(daten.tenantGueltig);
    assert.equal(klientenGueltig.length, 1, 'genau ein Alt-Klient fuer den gueltigen Tenant');
    assert.equal(klientenGueltig[0].label, 'Bestandsklient (migriert)');
    insp.close();
  });

  await t.test('fuer die verwaiste tenant_id entsteht KEIN Alt-Klient', function () {
    var insp = oeffneZurInspektion(dbPath);
    var klientenVerwaist = insp.prepare('SELECT * FROM klienten WHERE tenant_id = ?').all(daten.tenantVerwaist);
    assert.equal(klientenVerwaist.length, 0, 'kein Alt-Klient fuer eine tenant_id ohne tenants-Zeile');
    insp.close();
  });

  await t.test('verwaiste blob-Zeile bleibt unangetastet (kein Datenverlust, nur uebersprungen)', function () {
    var insp = oeffneZurInspektion(dbPath);
    var blobZeile = insp.prepare('SELECT * FROM blob WHERE tenant_id = ?').get(daten.tenantVerwaist);
    assert.ok(blobZeile, 'verwaiste blob-Zeile wurde NICHT geloescht');
    assert.equal(blobZeile.iv, 'iv-verwaist-unveraendert');
    assert.equal(blobZeile.ct, 'ct-verwaist-unveraendert');
    insp.close();
  });

  await t.test('echter Login gegen den gueltigen Tenant funktioniert weiterhin (Server tatsaechlich lauffaehig, kein Teil-Crash)', async function () {
    var login = await api(instanz.basis, '/login', { method: 'POST', body: JSON.stringify({ username: 'admin_gueltig', password: daten.pin }) });
    assert.equal(login.status, 200);
  });

  await instanz.stoppen();

  await t.test('Idempotenz: zweiter Serverstart gegen dieselbe DB legt weiterhin nichts fuer die verwaiste tenant_id an', async function () {
    var zweiteInstanz = await starteMitPfaden(port, dbPath, secretPath);
    var insp = oeffneZurInspektion(dbPath);
    assert.equal(insp.prepare('SELECT COUNT(*) AS n FROM klienten WHERE tenant_id = ?').get(daten.tenantVerwaist).n, 0);
    assert.equal(insp.prepare('SELECT COUNT(*) AS n FROM klienten WHERE tenant_id = ?').get(daten.tenantGueltig).n, 1, 'kein zweiter Alt-Klient fuer den gueltigen Tenant');
    insp.close();
    await zweiteInstanz.stoppen();
  });

  ['', '-wal', '-shm'].forEach(function (suffix) { try { fs.unlinkSync(dbPath + suffix); } catch (e) {} });
  try { fs.unlinkSync(secretPath); } catch (e) {}
});
