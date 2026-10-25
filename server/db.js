// AERIS-Server: SQLite-Schema. Läuft einmalig beim Start, legt fehlende Tabellen an.
// Sicherheitsprinzip (René-Direktive 2026-10-09, Architekturentscheidung "Server-Backend"):
// Der Server sieht NIE den Tenant-Datenschlüssel (DEK) im Klartext und NIE die entschlüsselten
// Pflegedaten — er speichert nur Chiffretext (blob.ct) und Passwort-Hashes (bcrypt). Die DEK wird
// ausschließlich client-seitig erzeugt/entschlüsselt/gewrappt (s. aeris-server.js im Projekt-Root).
var Database = require('better-sqlite3');
var path = require('path');
var crypto = require('crypto');

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
  -- K-neu (2026-10-24, software-architect-Konzept "Eintrag melden"): CHECK-Constraint bewusst NICHT
  -- erweitert, sondern komplett entfernt -- SQLite kann CHECK-Constraints nicht per ALTER TABLE
  -- aendern, eine Erweiterung haette wie beim signatur_anfragen-Fall (s.u.) Tabelle-neu-anlegen+Kopieren
  -- erfordert, was bei einer bereits produktiv befuellten users-Tabelle ein unnoetiges Risiko ist.
  -- Rollenwahl wird stattdessen applikationsseitig in server.js (POST /api/users, PATCH /api/users/:id)
  -- gegen das feste Array ['admin','ma','teamleiter'] geprueft -- robusteres Muster fuer Bestandsdaten.
  role TEXT NOT NULL,
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
  -- René-Direktive 2026-10-11 "das Einloggen ist Einstempeln, dadurch muss auch das Feld aktive PFK
  -- automatisch den richtigen Kuerzel zeigen und faelschungssicher sein": ein fester, vom Admin
  -- vergebener Kuerzel je Account -- wird beim Login automatisch als tag.pfk gesetzt UND das Dropdown
  -- in "Heute" gesperrt, damit niemand ein fremdes Kuerzel auswaehlen kann, waehrend eine andere
  -- Person tatsaechlich eingeloggt ist.
  pfk_kuerzel TEXT NOT NULL DEFAULT '',
  -- René-Auftrag 2026-10-11 "Profil-Anlage über die Master-Instanz": vollstaendiges Stammdatenprofil
  -- je Account statt nur Anzeigename -- display_name bleibt der aus vorname+nachname zusammengesetzte
  -- Name (fuer alle bestehenden Stellen im Code, die u.displayName bereits nutzen, unveraendert).
  vorname TEXT NOT NULL DEFAULT '',
  nachname TEXT NOT NULL DEFAULT '',
  adresse TEXT NOT NULL DEFAULT '',
  firma TEXT NOT NULL DEFAULT '',
  personalnummer TEXT NOT NULL DEFAULT '',
  berufsstand TEXT NOT NULL DEFAULT '',
  -- K5 Public-Key-Envelope (2026-10-25, security-privacy-Architektur "Variante B", René-freigegeben):
  -- loest den Fund ab, dass aeKlientZugriffGewaehren() (app.js) Klient-DEKs faktisch mit der GEMEINSAMEN
  -- Firmen-DEK statt eines an die Zielperson gebundenen Schluessels wrappte -- keine echte Pro-Klient-
  -- Trennung. Jeder Nutzer bekommt ein eigenes RSA-OAEP-Schluesselpaar: public_key liegt unkritisch im
  -- Klartext (jeder im Tenant darf ihn lesen, s. GET /api/users/:id/public-key), der private Schluessel
  -- wird NIE im Klartext an den Server gesendet -- der Client wrappt ihn mit der EIGENEN PIN (identisches
  -- PBKDF2(150k)+AES-256-GCM-Verfahren wie wrapped_dek_*) und liefert nur das Wrap-Ergebnis ab. Alle 4
  -- Spalten bewusst NULLABLE ohne DEFAULT (Phase-Trennung "nur Datenmodell+Server, kein Frontend-Krypto-
  -- Code in dieser Phase") -- nicht jeder Bestandsnutzer hat sofort ein Schluesselpaar, wird lazy beim
  -- naechsten Login nachgezogen (s. POST /api/users/me/keypair).
  public_key TEXT,
  wrapped_privkey_salt TEXT,
  wrapped_privkey_iv TEXT,
  wrapped_privkey_ct TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blob (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
  iv TEXT NOT NULL,
  ct TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

-- AERIS Buch eigener Tenant-Blob (René-Direktive 2026-10-18: Doku und Buch bleiben zwei
-- unabhaengige Programme mit je eigenem Login, sollen aber weiterhin dieselbe Mandanten-DEK
-- teilen koennen). BEWUSST eine eigene Tabelle statt denselben "blob" mitzubenutzen: beide Apps
-- schreiben unabhaengig voneinander (persist() je App), ein gemeinsamer Blob haette bei
-- zeitversetztem Speichern die jeweils andere App per Last-Write-Wins stillschweigend ueberschrieben.
CREATE TABLE IF NOT EXISTS blob_fin (
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
  chargen_nr TEXT NOT NULL DEFAULT '',
  verfallsdatum TEXT NOT NULL DEFAULT '',
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
-- BEWUSST OHNE tenant_id/created_by (René-Korrektur 2026-10-11: "nicht nur im Team-Modus" -- diese
-- Funktion braucht konzeptionell keine Mandanten-Zuordnung, der Inhalt ist ohnehin Ende-zu-Ende
-- verschluesselt. Dadurch funktioniert sie identisch im lokalen PIN-Modus UND im Server-Modus,
-- Autorisierung entsteht allein durch Besitz der unratbaren id (122-Bit-UUID) bzw. des Kurzcodes).
CREATE TABLE IF NOT EXISTS signatur_anfragen (
  id TEXT PRIMARY KEY,
  kurzcode_hash TEXT NOT NULL,
  kontext_ct TEXT NOT NULL,
  kontext_iv TEXT NOT NULL,
  wrapped_k_salt TEXT NOT NULL,
  wrapped_k_iv TEXT NOT NULL,
  wrapped_k_ct TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offen',
  signatur_ct TEXT NOT NULL DEFAULT '',
  signatur_iv TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  ablauf_at TEXT NOT NULL,
  eingeloest_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_signatur_kurzcode ON signatur_anfragen(kurzcode_hash);

-- K-neu (Feature "Eintrag melden", software-architect-Konzept 2026-10-24, René-bestaetigt):
-- Hybrid-Verschluesselung wie beim Tenant-Blob -- status/pfad/datum/user-referenzen bleiben im
-- Klartext auf dem Server (brauchen fuer Rollenfilter/Entscheidung durchsuchbare Spalten), der
-- eigentliche Meldungsinhalt (gemeldeter Wert, Begruendungen) ist client-seitig AES-GCM-
-- verschluesselt mit der Tenant-DEK -- identisches Muster wie blob/blob_fin (payload_iv/payload_ct).
CREATE TABLE IF NOT EXISTS meldungen (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  pfad TEXT NOT NULL,
  iso TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'offen' CHECK(status IN ('offen','angenommen','korrigiert','abgelehnt')),
  gemeldet_von TEXT NOT NULL REFERENCES users(id),
  entschieden_von TEXT REFERENCES users(id),
  entschieden_am TEXT NOT NULL DEFAULT '',
  -- fuer die automatische "Nachtragen"-Verknuepfung (K-neu Punkt 4): wird vom Frontend beim
  -- Nachtragen automatisch mit dem Pfad des neu erfassten Eintrags befuellt, nicht manuell.
  verknuepfter_eintrag_pfad TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  payload_iv TEXT NOT NULL,
  payload_ct TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meldungen_tenant ON meldungen(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meldungen_gemeldet_von ON meldungen(tenant_id, gemeldet_von);

-- Organisationsstruktur Phase 1 (2026-10-24, software-architect-Konzept, René 1:1 bestaetigt):
-- Geschaeftsfuehrer/HR/Bezirksleitung/Teamleitung + echte Pro-Klient-Verschluesselung. AERIS kannte
-- bisher kein "Klient"-Konzept (ein Tenant-Blob pro Unternehmen = implizit genau ein Pflegebeduerftiger).
-- Verschluesselung erfolgt PRO KLIENT, nicht pro Bezirk/Team -- Bezirks-/Team-Zugriff entsteht erst als
-- SUMME einzelner Klient-Zugaenge (klient_dek_wraps), damit niemand automatisch alle Klienten eines
-- Bezirks entschluesseln kann, nur weil er/sie Zugriff auf einen einzelnen Klienten hat. NUR
-- Datenmodell+Migration in dieser Phase -- KEINE API-Endpunkte, KEIN Frontend (folgen in Phase 2/3).
CREATE TABLE IF NOT EXISTS bezirke (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  leiter_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bezirke_tenant ON bezirke(tenant_id);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  bezirk_id TEXT NOT NULL REFERENCES bezirke(id),
  name TEXT NOT NULL,
  leiter_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teams_bezirk ON teams(bezirk_id);

-- team_id bewusst NULLABLE (nicht wie teams.bezirk_id NOT NULL) -- ein frisch migrierter "Alt-Klient"
-- (s. Migrationslogik unten) hat zunaechst KEIN Team, muss spaeter manuell zugeordnet werden, das ist
-- kein Blocker fuer die Migration selbst.
CREATE TABLE IF NOT EXISTS klienten (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  team_id TEXT REFERENCES teams(id),
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktiv' CHECK(status IN ('aktiv','beendet')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_klienten_tenant ON klienten(tenant_id);
CREATE INDEX IF NOT EXISTS idx_klienten_team ON klienten(team_id);

-- Ein verschluesselter Blob PRO KLIENT (ersetzt perspektivisch den heutigen EINEN "blob" pro Tenant,
-- s. Migrationslogik unten -- "blob"/"blob_fin" bleiben in dieser Phase unveraendert bestehen, kein
-- Drop/Rebuild, Rollback-Faehigkeit ist explizite Architektur-Vorgabe).
CREATE TABLE IF NOT EXISTS klient_blob (
  klient_id TEXT PRIMARY KEY REFERENCES klienten(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  iv TEXT NOT NULL,
  ct TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL REFERENCES users(id)
);

-- Pro-Klient-DEK-Wraps: wer (user_id) kann den Klient-DEK mit was (PIN oder Recovery-Key) entschluesseln.
-- wrap_art ist Teil des Primaerschluessels, da ein Nutzer theoretisch BEIDE Wrap-Arten fuer denselben
-- Klienten haben kann (eigene PIN + eigener Recovery-Key). granted_by dokumentiert, wer den Zugriff
-- eingeraeumt hat (Nachvollziehbarkeit, analog audit_log-Prinzip).
-- K5 (2026-10-25): 'pubkey' ergaenzt -- der Klient-DEK-Wrap-Inhalt wechselt fuer NEUE Gewaehrungen
-- von "mit der gemeinsamen Firmen-DEK" auf "mit dem RSA-OAEP-Public-Key der Zielperson" (s. Kommentar
-- bei users oben), die Server-Logik (Speichern/Lesen der Zeile) bleibt dabei strukturell unveraendert --
-- nur ein zusaetzlich erlaubter wrap_art-Wert.
CREATE TABLE IF NOT EXISTS klient_dek_wraps (
  klient_id TEXT NOT NULL REFERENCES klienten(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  wrap_salt TEXT NOT NULL,
  wrap_iv TEXT NOT NULL,
  wrap_ct TEXT NOT NULL,
  wrap_art TEXT NOT NULL CHECK(wrap_art IN ('pin','recovery','pubkey')),
  granted_by TEXT NOT NULL REFERENCES users(id),
  granted_at TEXT NOT NULL,
  PRIMARY KEY (klient_id, user_id, wrap_art)
);
CREATE INDEX IF NOT EXISTS idx_klient_dek_wraps_user ON klient_dek_wraps(user_id);

-- Mengen-Rollen-Tabelle (loest perspektivisch users.role als einzige Quelle ab -- in dieser Phase nur
-- Backfill, users.role bleibt unveraendert bestehen und massgeblich, s. Migrationslogik unten).
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
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
// signatur_anfragen auf das mandantenlose Schema umstellen (René-Korrektur 2026-10-11, s. Kommentar
// oben bei CREATE TABLE) -- SQLite kann NOT NULL-Spalten nicht per ALTER TABLE entfernen, daher Tabelle
// neu anlegen. Unkritisch: die Tabelle ist neu (Feature vom selben Tag), enthaelt nur kurzlebige
// Signatur-Anfragen (30 Min Ablauf), kein Datenverlust von Belang.
if (!spalteFehlt('signatur_anfragen', 'tenant_id')) {
  db.exec('DROP TABLE signatur_anfragen');
  db.exec(
    'CREATE TABLE signatur_anfragen (' +
    'id TEXT PRIMARY KEY, kurzcode_hash TEXT NOT NULL, kontext_ct TEXT NOT NULL, kontext_iv TEXT NOT NULL, ' +
    'wrapped_k_salt TEXT NOT NULL, wrapped_k_iv TEXT NOT NULL, wrapped_k_ct TEXT NOT NULL, ' +
    'status TEXT NOT NULL DEFAULT \'offen\', signatur_ct TEXT NOT NULL DEFAULT \'\', signatur_iv TEXT NOT NULL DEFAULT \'\', ' +
    'created_at TEXT NOT NULL, ablauf_at TEXT NOT NULL, eingeloest_at TEXT NOT NULL DEFAULT \'\')'
  );
  db.exec('CREATE INDEX IF NOT EXISTS idx_signatur_kurzcode ON signatur_anfragen(kurzcode_hash)');
}
if (spalteFehlt('users', 'pfk_kuerzel')) {
  db.exec('ALTER TABLE users ADD COLUMN pfk_kuerzel TEXT NOT NULL DEFAULT \'\'');
}
['vorname', 'nachname', 'adresse', 'firma', 'personalnummer', 'berufsstand'].forEach(function (spalte) {
  if (spalteFehlt('users', spalte)) db.exec('ALTER TABLE users ADD COLUMN ' + spalte + ' TEXT NOT NULL DEFAULT \'\'');
});
// K5 Public-Key-Envelope (2026-10-25): additive Spalten fuer bereits bestehende aeris.db-Dateien --
// alle 4 bewusst NULLABLE ohne DEFAULT (identisches Prinzip wie chargen_nr/verfallsdatum unten).
['public_key', 'wrapped_privkey_salt', 'wrapped_privkey_iv', 'wrapped_privkey_ct'].forEach(function (spalte) {
  if (spalteFehlt('users', spalte)) db.exec('ALTER TABLE users ADD COLUMN ' + spalte + ' TEXT');
});

// K7-Fix (business-consultant-Audit 2026-10-23): Chargennr./Verfallsdatum am BTM-Eintrag.
// WICHTIG: Spalte bewusst NULLABLE ohne DEFAULT '' angelegt (nicht NOT NULL wie sonst ueblich) --
// bestehende Zeilen werden dadurch NULL statt '' und bleiben so in btmContentHash() unterscheidbar
// von "Feld existiert, ist aber leer" (neue Eintraege). NULL-Spalten werden dort bewusst NICHT in
// den Hash-Inhalt aufgenommen -- sonst wuerde der jetzt nachgerechnete Hash fuer JEDEN bereits
// bestehenden BTM-Eintrag vom damals gespeicherten Hash abweichen (false-positive Manipulationsfund
// in der gesamten Alt-Kette). Analoges Prinzip zu JSON.stringify(), das "undefined"-Properties im
// Client (app.js aeBtmInhaltFuerHash) automatisch weglaesst -- hier serverseitig nachgebildet.
['chargen_nr', 'verfallsdatum'].forEach(function (spalte) {
  if (spalteFehlt('btm_eintraege', spalte)) db.exec('ALTER TABLE btm_eintraege ADD COLUMN ' + spalte + ' TEXT');
});

// K-neu (2026-10-24): neue Rolle 'teamleiter' -- die alte CHECK(role IN ('admin','ma'))-Einschraenkung
// auf bereits bestehenden aeris.db-Dateien wuerde jeden Versuch, einen Nutzer auf 'teamleiter' zu setzen,
// serverseitig mit einem SQLite-Constraint-Fehler blockieren (die neue CREATE-TABLE-Anweisung oben ohne
// CHECK wirkt nur auf frisch angelegte DB-Dateien, nicht auf bereits existierende). SQLite kann
// CHECK-Constraints nicht per ALTER TABLE entfernen -- einzige Option: Tabelle ohne CHECK neu anlegen,
// Daten 1:1 per PRAGMA table_info() kopieren, alte Tabelle ersetzen. Idempotent: läuft nur, wenn die
// alte Einschränkung im gespeicherten Schema tatsächlich noch vorhanden ist. UNIQUE(username) wird
// explizit nachgezogen (PRAGMA table_info liefert keine UNIQUE-Info) -- ohne das koennten doppelte
// Benutzernamen unbemerkt eingefuegt werden. Kein FK-Verlust an der Laufzeit-Semantik: foreign_keys
// ist in dieser App nirgends per PRAGMA aktiviert, FK-Deklarationen wurden also ohnehin nie erzwungen.
var usersSchemaRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
if (usersSchemaRow && /CHECK\(role IN \('admin',\s*'ma'\)\)/.test(usersSchemaRow.sql)) {
  var usersSpalten = db.prepare('PRAGMA table_info(users)').all();
  var spaltenDef = usersSpalten.map(function (s) {
    var def = s.name + ' ' + s.type;
    if (s.notnull) def += ' NOT NULL';
    if (s.dflt_value !== null && s.dflt_value !== undefined) def += ' DEFAULT ' + s.dflt_value;
    if (s.pk) def += ' PRIMARY KEY';
    return def;
  }).join(', ');
  var spaltenNamen = usersSpalten.map(function (s) { return s.name; }).join(', ');
  db.transaction(function () {
    db.exec('CREATE TABLE users_neu (' + spaltenDef + ')');
    db.exec('INSERT INTO users_neu (' + spaltenNamen + ') SELECT ' + spaltenNamen + ' FROM users');
    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_neu RENAME TO users');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');
  })();
}

// K5 Public-Key-Envelope (2026-10-25): wrap_art-CHECK um 'pubkey' erweitern. SQLite kann CHECK-
// Constraints nicht per ALTER TABLE aendern -- Tabelle neu anlegen (identisches Prinzip wie der
// users.role-Fix oben), ABER NICHT ueber den dortigen generischen PRAGMA-table_info-Spalten-Zusammenbau
// (der haengt "PRIMARY KEY" an JEDE Spalte mit s.pk>0 -- bei einem COMPOSITE Primary Key wie hier
// (klient_id, user_id, wrap_art) wuerde das mehrfach "PRIMARY KEY" inline erzeugen = ungueltiges SQL).
// Stattdessen die bekannte, feste Zielstruktur explizit nachgebaut. Idempotent: laeuft nur, wenn die
// alte Einschraenkung im gespeicherten Schema tatsaechlich noch vorhanden ist. Kein FK-Verlust an der
// Laufzeit-Semantik (foreign_keys ist in dieser App nirgends per PRAGMA aktiviert, s. users.role-Fix-
// Kommentar oben -- gilt identisch hier).
var wrapsSchemaRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='klient_dek_wraps'").get();
if (wrapsSchemaRow && /CHECK\(wrap_art IN \('pin',\s*'recovery'\)\)/.test(wrapsSchemaRow.sql)) {
  db.transaction(function () {
    db.exec(
      'CREATE TABLE klient_dek_wraps_neu (' +
      'klient_id TEXT NOT NULL REFERENCES klienten(id), user_id TEXT NOT NULL REFERENCES users(id), ' +
      'wrap_salt TEXT NOT NULL, wrap_iv TEXT NOT NULL, wrap_ct TEXT NOT NULL, ' +
      "wrap_art TEXT NOT NULL CHECK(wrap_art IN ('pin','recovery','pubkey')), " +
      'granted_by TEXT NOT NULL REFERENCES users(id), granted_at TEXT NOT NULL, ' +
      'PRIMARY KEY (klient_id, user_id, wrap_art))'
    );
    db.exec(
      'INSERT INTO klient_dek_wraps_neu (klient_id, user_id, wrap_salt, wrap_iv, wrap_ct, wrap_art, granted_by, granted_at) ' +
      'SELECT klient_id, user_id, wrap_salt, wrap_iv, wrap_ct, wrap_art, granted_by, granted_at FROM klient_dek_wraps'
    );
    db.exec('DROP TABLE klient_dek_wraps');
    db.exec('ALTER TABLE klient_dek_wraps_neu RENAME TO klient_dek_wraps');
    db.exec('CREATE INDEX IF NOT EXISTS idx_klient_dek_wraps_user ON klient_dek_wraps(user_id)');
  })();
}

// Organisationsstruktur Phase 1 (2026-10-24) -- additive Spalten fuer bereits bestehende aeris.db-
// Dateien. team_id bewusst NULLABLE (ein Nutzer ist nicht zwingend bereits einem Team zugeordnet).
if (spalteFehlt('users', 'team_id')) {
  db.exec('ALTER TABLE users ADD COLUMN team_id TEXT REFERENCES teams(id)');
}
// klient_id NULLABLE ohne DEFAULT (identisches Prinzip wie chargen_nr/verfallsdatum oben) -- bestehende
// Zeilen werden NULL, nicht '' oder ein erfundener Platzhalter-Klient. Bewusst NUR diese 6 Tabellen
// (laut Architektur-Vorgabe) -- wunden/wunde_eintraege sind NICHT Teil dieser Liste.
['btm_praeparate', 'btm_eintraege', 'mp_geraete', 'mp_eintraege', 'meldungen', 'dienst_eintraege'].forEach(function (tabelle) {
  if (spalteFehlt(tabelle, 'klient_id')) db.exec('ALTER TABLE ' + tabelle + ' ADD COLUMN klient_id TEXT REFERENCES klienten(id)');
});

// Daten-Migration: jeder bestehende Tenant mit einer Zeile in "blob" bekommt einen "Alt-Klienten", an
// den die bestehende Verschluesselung (DEK-Wraps) UND alle bisher klientenlosen Fachdaten (BTM/
// Medizinprodukte/Meldungen/Dienstplan) gehaengt werden. Blob-Kopie ist BIT-IDENTISCH (iv/ct 1:1
// uebernommen) -- KEINE Neuverschluesselung, dieselbe DEK bleibt fuer die Pflegekraefte gueltig.
// Idempotent: ein Tenant, der bereits mindestens einen Klienten hat, wird NICHT erneut migriert -- in
// dieser Phase existiert noch KEIN API-Endpunkt, der eigenstaendig einen Klienten anlegen koennte,
// "schon >=1 Klient vorhanden" ist daher ein sicheres, alleiniges Idempotenz-Kriterium fuer diese Phase.
// devops-infra-Fund 2026-10-25 (Produktions-Crash-Loop): eine verwaiste "blob"-Zeile ohne
// zugehoerige "tenants"-Zeile (Rest eines frueheren Smoke-Tests, von VOR Einfuehrung von
// DELETE /api/tenant am 2026-10-10 -- diese Route loescht blob+tenants seit ihrer allerersten
// Fassung korrekt, s. Commit c80ea27) liess die Migration einen "Alt-Klienten" mit einer
// tenant_id anlegen, fuer die klienten.tenant_id REFERENCES tenants(id) fehlschlaegt
// (FOREIGN KEY constraint failed) -- bei JEDEM Serverstart, da die Migration nicht idempotent
// "erledigt" markiert wird, solange sie crasht. Fix: nur Tenants migrieren, die tatsaechlich noch
// in "tenants" existieren. Verwaiste Zeilen werden NICHT geloescht (kein Datenverlustrisiko),
// nur von dieser Migration ignoriert -- Boot-Log dokumentiert, wie viele uebersprungen wurden.
var verwaisteBlobZeilen = db.prepare(
  'SELECT COUNT(*) AS n FROM blob b WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = b.tenant_id)'
).get().n;
if (verwaisteBlobZeilen > 0) {
  console.warn('[db.js migration] ' + verwaisteBlobZeilen + ' verwaiste blob-Zeile(n) ohne gueltigen Tenant uebersprungen (nicht geloescht, kein Alt-Klient angelegt).');
}
var tenantsOhneKlient = db.prepare(
  'SELECT b.tenant_id AS tenant_id FROM blob b ' +
  'WHERE EXISTS (SELECT 1 FROM tenants t WHERE t.id = b.tenant_id) ' +
  'AND NOT EXISTS (SELECT 1 FROM klienten k WHERE k.tenant_id = b.tenant_id)'
).all();
tenantsOhneKlient.forEach(function (row) {
  var tenantId = row.tenant_id;
  db.transaction(function () {
    var altKlientId = crypto.randomUUID();
    var jetzt = new Date().toISOString();
    db.prepare('INSERT INTO klienten (id, tenant_id, team_id, label, status, created_at) VALUES (?,?,?,?,?,?)')
      .run(altKlientId, tenantId, null, 'Bestandsklient (migriert)', 'aktiv', jetzt);

    // Schritt 2: Blob 1:1 kopieren (bit-identisch, kein Neu-Verschluesseln).
    var blobZeile = db.prepare('SELECT * FROM blob WHERE tenant_id = ?').get(tenantId);
    if (blobZeile) {
      db.prepare('INSERT INTO klient_blob (klient_id, tenant_id, iv, ct, updated_at, updated_by) VALUES (?,?,?,?,?,?)')
        .run(altKlientId, tenantId, blobZeile.iv, blobZeile.ct, blobZeile.updated_at, blobZeile.updated_by);
    }

    // Schritt 3: jede bestehende users.wrapped_dek_*-Zeile 1:1 nach klient_dek_wraps kopieren
    // (wrap_art='pin'). Kein serverseitiger Recovery-Wrap vorhanden -- das K5-Recovery-Key-Feature
    // (2026-10-23) ist ein rein LOKALER app.js-Mechanismus fuer den Einzelgeraete-PIN-Modus, die
    // server-seitige users-Tabelle hat kein wrapped_recovery_*-Pendant (Code-Recherche bestaetigt,
    // s. Goal-Auftrag "pruefe das exakte Spaltenschema selbst am Code") -- nichts zu kopieren.
    // granted_by = die Person selbst (sie hatte den Zugriff bereits vor der Migration), granted_at =
    // der urspruengliche Account-Erstellungszeitpunkt (kein praeziserer historischer Wert verfuegbar).
    var nutzer = db.prepare('SELECT id, wrapped_dek_salt, wrapped_dek_iv, wrapped_dek_ct, created_at FROM users WHERE tenant_id = ?').all(tenantId);
    nutzer.forEach(function (u) {
      db.prepare(
        'INSERT INTO klient_dek_wraps (klient_id, user_id, wrap_salt, wrap_iv, wrap_ct, wrap_art, granted_by, granted_at) VALUES (?,?,?,?,?,?,?,?)'
      ).run(altKlientId, u.id, u.wrapped_dek_salt, u.wrapped_dek_iv, u.wrapped_dek_ct, 'pin', u.id, u.created_at);
    });

    // Schritt 4: bisher klientenlose Fachdaten auf den Alt-Klienten verankern.
    ['btm_praeparate', 'btm_eintraege', 'mp_geraete', 'mp_eintraege', 'meldungen', 'dienst_eintraege'].forEach(function (tabelle) {
      db.prepare('UPDATE ' + tabelle + ' SET klient_id = ? WHERE tenant_id = ? AND klient_id IS NULL').run(altKlientId, tenantId);
    });
  })();
});

// Schritt 5: Backfill der heutigen Singular-Rolle (users.role) in die neue Mengen-Tabelle user_roles --
// GLOBAL fuer alle Nutzer, unabhaengig vom obigen Pro-Tenant-Blob-Loop (jeder Nutzer hat unabhaengig
// davon, ob sein Tenant bereits eine Blob-Zeile/einen Alt-Klienten hat, genau eine Rolle). INSERT OR
// IGNORE macht diesen Schritt bei jedem Serverstart idempotent (PRIMARY KEY (user_id, role)).
db.exec('INSERT OR IGNORE INTO user_roles (user_id, role) SELECT id, role FROM users');

module.exports = db;
