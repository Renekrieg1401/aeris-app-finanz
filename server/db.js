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

-- Echte Tamper-Resistenz fuer BTM-Nachweisbuch/Medizinproduktebuch/ICW-Wunddokumentation
-- (René-Direktive 2026-10-10, nach security-privacy-Fund Runde 2: die vorherige client-seitige
-- Hash-Kette im mutable Blob schuetzte NICHT gegen die dokumentierende Person selbst). Analog
-- dienst_eintraege: append-only, Hash wird SERVERSEITIG berechnet (nicht vom Client uebernommen),
-- kein UPDATE/DELETE-Endpunkt. Stammdaten (Praeparate/Geraete/Wunden) bewusst ebenfalls nur INSERT
-- (keine Aenderbarkeit nach Anlegen, s. bereits dokumentierte Entscheidung Nachtrag 2026-10-10 (8)).
CREATE TABLE IF NOT EXISTS btm_praeparate (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  bezeichnung TEXT NOT NULL,
  wirkstoff TEXT NOT NULL DEFAULT '',
  staerke TEXT NOT NULL DEFAULT '',
  darreichungsform TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_btm_praeparate_tenant ON btm_praeparate(tenant_id);

CREATE TABLE IF NOT EXISTS btm_eintraege (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  praeparat_id TEXT NOT NULL REFERENCES btm_praeparate(id),
  typ TEXT NOT NULL,
  menge REAL NOT NULL,
  einheit TEXT NOT NULL DEFAULT '',
  datum TEXT NOT NULL,
  uhrzeit TEXT NOT NULL DEFAULT '',
  bestand_vorher REAL NOT NULL,
  bestand_nachher REAL NOT NULL,
  gegenpart TEXT NOT NULL DEFAULT '',
  verordner TEXT NOT NULL DEFAULT '',
  rezept_nr TEXT NOT NULL DEFAULT '',
  pflegekraft TEXT NOT NULL DEFAULT '',
  zeuge TEXT NOT NULL DEFAULT '',
  bemerkung TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_btm_eintraege_tenant ON btm_eintraege(tenant_id);
CREATE INDEX IF NOT EXISTS idx_btm_eintraege_praeparat ON btm_eintraege(tenant_id, praeparat_id);

-- § 13 Abs. 2 BtMVV: monatliche Bestandspruefung durch berechtigte Person, bestaetigt durch
-- Namenszeichen und Pruefdatum (René-Entscheidung 2026-10-10: direkte BtMVV-Bindung besteht).
CREATE TABLE IF NOT EXISTS btm_monatspruefungen (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  praeparat_id TEXT NOT NULL REFERENCES btm_praeparate(id),
  monat TEXT NOT NULL,
  namenszeichen TEXT NOT NULL,
  pruefdatum TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_btm_monatspruefungen_tenant ON btm_monatspruefungen(tenant_id, praeparat_id);

CREATE TABLE IF NOT EXISTS mp_geraete (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  bezeichnung TEXT NOT NULL,
  art_typ TEXT NOT NULL DEFAULT '',
  loscode_seriennummer TEXT NOT NULL DEFAULT '',
  anschaffungsjahr TEXT NOT NULL DEFAULT '',
  hersteller_name TEXT NOT NULL DEFAULT '',
  hersteller_anschrift TEXT NOT NULL DEFAULT '',
  betriebliche_id TEXT NOT NULL DEFAULT '',
  standort TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mp_geraete_tenant ON mp_geraete(tenant_id);

CREATE TABLE IF NOT EXISTS mp_eintraege (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  geraet_id TEXT NOT NULL REFERENCES mp_geraete(id),
  typ TEXT NOT NULL,
  datum TEXT NOT NULL,
  person TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  naechste_faelligkeit TEXT NOT NULL DEFAULT '',
  folgen TEXT NOT NULL DEFAULT '',
  bemerkung TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mp_eintraege_tenant ON mp_eintraege(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mp_eintraege_geraet ON mp_eintraege(tenant_id, geraet_id);

CREATE TABLE IF NOT EXISTS wunden (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  bezeichnung TEXT NOT NULL,
  wundart TEXT NOT NULL DEFAULT '',
  lokalisation TEXT NOT NULL DEFAULT '',
  erstdokumentiert TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wunden_tenant ON wunden(tenant_id);

CREATE TABLE IF NOT EXISTS wunde_eintraege (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  wunde_id TEXT NOT NULL REFERENCES wunden(id),
  datum TEXT NOT NULL,
  laenge REAL NOT NULL DEFAULT 0,
  breite REAL NOT NULL DEFAULT 0,
  tiefe REAL NOT NULL DEFAULT 0,
  unterminierung TEXT NOT NULL DEFAULT '',
  wundgrund TEXT NOT NULL DEFAULT '',
  wundbelag TEXT NOT NULL DEFAULT '',
  wundrand TEXT NOT NULL DEFAULT '',
  wundumgebung TEXT NOT NULL DEFAULT '',
  mazeration INTEGER NOT NULL DEFAULT 0,
  erythem INTEGER NOT NULL DEFAULT 0,
  exsudat_menge TEXT NOT NULL DEFAULT '',
  exsudat_art TEXT NOT NULL DEFAULT '',
  geruch INTEGER NOT NULL DEFAULT 0,
  infektionszeichen TEXT NOT NULL DEFAULT '[]',
  schmerz_nrs TEXT NOT NULL DEFAULT '',
  foto_vermerk INTEGER NOT NULL DEFAULT 0,
  verbandsmaterial TEXT NOT NULL DEFAULT '',
  pflegekraft TEXT NOT NULL DEFAULT '',
  bemerkung TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wunde_eintraege_tenant ON wunde_eintraege(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wunde_eintraege_wunde ON wunde_eintraege(tenant_id, wunde_id);

-- MD-Archiv (lokale, Ende-zu-Ende-verschluesselte Tages-Hash-Kette, s. app.js aeMdArchivNachfuehren)
-- bleibt bewusst Ende-zu-Ende-verschluesselt -- der Server darf den eigentlichen Pflegeinhalt NIE
-- sehen. Statt die Kette vollstaendig zu migrieren (wuerde Klardaten preisgeben), verankert der
-- Client nur den rechnerischen Ketten-Hash je Tag server-seitig als unveraenderlichen Pruefanker
-- (kein Klartext, keine Kollision mit Zero-Knowledge). Ein (tenant,datum)-Paar ist nur EINMAL
-- schreibbar (s. server.js) -- ein nachtraeglich umgeschriebener lokaler Tag erzeugt einen neuen
-- Hash, der nicht mehr zum fest verankerten Checkpoint passt und die Manipulation damit aufdeckt.
CREATE TABLE IF NOT EXISTS md_archiv_checkpoints (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  datum TEXT NOT NULL,
  ketten_hash TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, datum)
);

-- Cross-Device-Signatur (Signatur-PWA-Ersatz, René-Auftrag 2026-10-10/11): kein eigenes PWA-Silo --
-- eine Seite (signatur.html) im selben Deployment. Zero-Knowledge bleibt gewahrt: Dokumentkontext UND
-- Signatur liegen hier NUR als Ciphertext vor. Der Schluessel K entsteht zufaellig auf Geraet A, wird
-- entweder per URL-Fragment (QR-Pfad, nie an den Server gesendet) ODER -- Fallback-Pfad ohne Fragment --
-- per Kurzcode-abgeleitetem Schluessel gewrappt uebertragen (identisches wrapped_dek_*-Muster wie bei
-- users). kurzcode_hash ist nur ein Lookup-Schluessel (SHA-256, kein Geheimnis fuer sich), der eigentliche
-- Brute-Force-Schutz ist das bestehende login_sperre-Rate-Limiting (s. server.js). Single-use, 30 Min Ablauf.
CREATE TABLE IF NOT EXISTS signatur_anfragen (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  kurzcode_hash TEXT NOT NULL,
  kontext_ct TEXT NOT NULL,
  kontext_iv TEXT NOT NULL,
  wrapped_k_salt TEXT NOT NULL,
  wrapped_k_iv TEXT NOT NULL,
  wrapped_k_ct TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offen',
  signatur_ct TEXT NOT NULL DEFAULT '',
  signatur_iv TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  ablauf_at TEXT NOT NULL,
  eingeloest_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_signatur_tenant ON signatur_anfragen(tenant_id);
CREATE INDEX IF NOT EXISTS idx_signatur_kurzcode ON signatur_anfragen(kurzcode_hash);
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
