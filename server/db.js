// AERIS-Server: SQLite-Schema. Läuft einmalig beim Start, legt fehlende Tabellen an.
// Sicherheitsprinzip (René-Direktive 2026-10-09, Architekturentscheidung "Server-Backend"):
// Der Server sieht NIE den Tenant-Datenschlüssel (DEK) im Klartext und NIE die entschlüsselten
// Pflegedaten — er speichert nur Chiffretext (blob.ct) und Passwort-Hashes (bcrypt). Die DEK wird
// ausschließlich client-seitig erzeugt/entschlüsselt/gewrappt (s. aeris-server.js im Projekt-Root).
var Database = require('better-sqlite3');
var path = require('path');

// AERIS_DB_PATH überschreibt den Pfad (für die Testsuite, s. test/server.test.js -- eine Wegwerf-DB
// pro Testlauf statt der echten aeris.db) -- Default unverändert für den normalen Produktivbetrieb.
var db = new Database(process.env.AERIS_DB_PATH || path.join(__dirname, 'aeris.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','ma')),
  telefon TEXT NOT NULL DEFAULT '',
  wrapped_dek_salt TEXT NOT NULL,
  wrapped_dek_iv TEXT NOT NULL,
  wrapped_dek_ct TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  -- René-Direktive 2026-10-09: eine vom Admin vergebene/zurückgesetzte PIN ist eine Einmal-PIN --
  -- beim nächsten Login MUSS die Person sofort eine eigene, selbstbestimmte PIN setzen, bevor die
  -- App nutzbar wird (s. /api/login mustChangePassword + aeris-server.js Pflicht-Änderungs-Screen).
  -- Bei der Erst-Einrichtung per /api/setup (Admin legt sich selbst an) NICHT gesetzt -- da wählt
  -- die Person von Anfang an die eigene PIN selbst.
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blob (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
  iv TEXT NOT NULL,
  ct TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

-- Dienstplan: bewusst NICHT Teil des großen Tenant-Blobs (siehe oben) -- append-only mit
-- Hash-Kette (wie das bereits bestehende lokale MD-Audit-Archiv), weil mehrere MAs gleichzeitig
-- planen/Krankmeldungen eintragen koennen. Ein geteilter "ein Blob pro Tenant"-Ansatz wuerde bei
-- gleichzeitigen Schreibzugriffen Aenderungen durch Last-Write-Wins stillschweigend verlieren --
-- bei einem manipulationssicher geforderten Dienstplan (Renés Auftrag) ist das nicht hinnehmbar.
-- "Aktueller Stand" pro (tenant,user,datum) = jeweils die juengste Zeile dafuer.
CREATE TABLE IF NOT EXISTS dienst_eintraege (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  datum TEXT NOT NULL,
  typ TEXT NOT NULL,
  kuerzel TEXT NOT NULL DEFAULT '',
  von TEXT NOT NULL DEFAULT '',
  bis TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'aktiv',
  notiz TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dienst_tenant_datum ON dienst_eintraege(tenant_id, datum);
CREATE INDEX IF NOT EXISTS idx_dienst_tenant_user ON dienst_eintraege(tenant_id, user_id);

-- Rate-Limiting /api/login (security-privacy-Fund 2026-10-09, zunächst In-Memory, hier auf
-- persistent umgestellt -- ein In-Memory-Lockout überlebt keinen Server-Neustart/Deploy und wäre
-- damit genau in dem Moment wirkungslos, in dem ein Angreifer einen Neustart erzwingen könnte.
CREATE TABLE IF NOT EXISTS login_sperre (
  art TEXT NOT NULL,       -- 'user' oder 'ip'
  schluessel TEXT NOT NULL,
  fehl INTEGER NOT NULL DEFAULT 0,
  bis TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (art, schluessel)
);

-- Audit-Log fuer destruktive/sicherheitskritische Aktionen (security-privacy-Fund 2026-10-10:
-- "wer wann welchen Mandanten geloescht hat, ist nach der Tat fuer immer verschwunden"). BEWUSST
-- ohne FK auf tenants/users -- die referenzierten Zeilen koennen durch genau die geloggte Aktion
-- geloescht werden, der Log-Eintrag muss das ueberleben. Denormalisierte Namen/IDs als Momentaufnahme.
-- Enthaelt NUR Metadaten (wer/wann/was), NIE Klardaten -- keine Kollision mit dem Zero-Knowledge-Prinzip.
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  aktion TEXT NOT NULL,
  akteur_user_id TEXT NOT NULL,
  akteur_username TEXT NOT NULL,
  ziel_tenant_id TEXT NOT NULL,
  ziel_tenant_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

// Additive Schema-Migrationen für bereits bestehende DB-Dateien: "CREATE TABLE IF NOT EXISTS" legt
// eine fehlende Tabelle an, verändert aber eine BEREITS existierende Tabelle nicht nach -- eine neue
// Spalte in der CREATE-Anweisung oben reicht für eine schon vorhandene aeris.db-Datei allein nicht.
// Idempotent (prüft vorher, ob die Spalte schon existiert), damit ein Neustart mit bereits
// migrierter DB nichts kaputt macht.
function spalteFehlt(tabelle, spalte) {
  return !db.prepare('PRAGMA table_info(' + tabelle + ')').all().some(function (s) { return s.name === spalte; });
}
if (spalteFehlt('users', 'must_change_password')) {
  db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
}

module.exports = db;
