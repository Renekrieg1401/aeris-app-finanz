// AERIS-Server: SQLite-Schema. Läuft einmalig beim Start, legt fehlende Tabellen an.
// Sicherheitsprinzip (René-Direktive 2026-10-09, Architekturentscheidung "Server-Backend"):
// Der Server sieht NIE den Tenant-Datenschlüssel (DEK) im Klartext und NIE die entschlüsselten
// Pflegedaten — er speichert nur Chiffretext (blob.ct) und Passwort-Hashes (bcrypt). Die DEK wird
// ausschließlich client-seitig erzeugt/entschlüsselt/gewrappt (s. aeris-server.js im Projekt-Root).
var Database = require('better-sqlite3');
var path = require('path');

var db = new Database(path.join(__dirname, 'aeris.db'));
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
`);

module.exports = db;
