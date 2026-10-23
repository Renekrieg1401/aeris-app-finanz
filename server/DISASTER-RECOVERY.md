# AERIS-Server — Disaster-Recovery-Runbook

> Erstellt 2026-10-23 (devops-infra, K3 aus dem business-consultant-Architekturbericht
> 2026-10-23: "Backup lag nur auf derselben Maschine, nie Restore getestet, kein
> DR-Plan"). Richtet sich an jede Person, die den vServer im Ernstfall neu aufsetzen
> muss — nicht nur René.

## Ausgangslage (Stand 2026-10-23)
- Produktiv: vServer `212.132.117.130` (root-Zugriff via `~/.ssh/aeris_server_ed25519`).
- App-Code: `/opt/aeris-server/` (systemd `aeris-server.service`, Node 22, Port 8787 lokal).
- DB: `/opt/aeris-server/aeris.db` (better-sqlite3, WAL-Modus).
- Statische Dateien (AERIS Doku/Buch/Learn): `/var/www/aeris`, `/var/www/aeris-learn`.
- Lokale Backups: `/opt/aeris-backups/*.db.gz`, täglich 03:30 UTC (`aeris-backup.timer`
  → `aeris-backup.service` → `backup.sh`, SQLite Online-Backup-API, 30 Tage Aufbewahrung).
- **Offsite-Kopie (NEU, 2026-10-23):** `pull-backup-offsite.sh` zieht die Backups per
  rsync/SSH auf René's Mac (`Projekte/aeris/server/backups-offsite/`), getriggert vom
  LaunchAgent `com.irisdigital.aeris-backup-pull` (täglich 09:00 + bei jedem Mac-Login/
  -Neustart via `RunAtLoad`, idempotent). **Bekannte Grenze:** läuft nur, wenn der Mac
  online/eingeschaltet ist — kein Ersatz für eine echte dritte, immer-online Instanz,
  aber die einzige kostenfreie Option mit bereits bestehendem SSH-Zugriff in diesem Setup.
- **Backup-Format:** unverschlüsseltes, rohes SQLite-File (gzip) — kein eigenes
  Krypto-Layer in `backup.sh`. Enthält u. a. `login_sperre` (IP-Adressen) und
  `dienst_eintraege`-Metadaten unverschlüsselt (bestehende Architektur-Eigenschaft,
  s. `CLAUDE.md` § Datenschutzerklärung-§3-Fund 2026-10-09) — Backup-Dateien NIE ins
  Git-Repo, NIE unverschlüsselt per Mail versenden.

## Szenario A: Produktiv-DB auf dem laufenden vServer beschädigt/gelöscht (Server selbst intakt)
1. Service stoppen: `systemctl stop aeris-server`.
2. Neuestes intaktes Backup wählen — bevorzugt lokal (`/opt/aeris-backups/`), falls
   dort nichts mehr verwertbar ist: von Renés Mac zurückspielen
   (`scp -i ~/.ssh/aeris_server_ed25519 backups-offsite/aeris-<datum>.db.gz root@212.132.117.130:/tmp/`).
3. Entpacken + einspielen:
   ```
   gunzip /tmp/aeris-<datum>.db.gz
   cp /tmp/aeris-<datum>.db /opt/aeris-server/aeris.db
   chown www-data:www-data /opt/aeris-server/aeris.db
   rm -f /opt/aeris-server/aeris.db-wal /opt/aeris-server/aeris.db-shm
   ```
4. Integrität prüfen VOR dem Neustart: `sqlite3 /opt/aeris-server/aeris.db "PRAGMA integrity_check;"` → muss `ok` liefern.
5. `systemctl start aeris-server`, dann `systemctl is-active aeris-server` + `journalctl -u aeris-server --since '2 minutes ago'` prüfen (kein Fehler, kein Crash-Loop).
6. **JWT-Secret bleibt unverändert** (`/opt/aeris-server/jwt-secret.txt`, nicht Teil des Backups/DB) — alle bestehenden Bearer-Tokens bleiben gültig, kein Zwangs-Logout nötig.
7. Datenverlust-Fenster: maximal seit dem letzten Backup (täglich 03:30 UTC) — jede Änderung danach ist verloren, das ist technisch unvermeidbar ohne Echtzeit-Replikation (nicht Teil dieses Fixes).

## Szenario B: Totalausfall des vServers (Hardware/Hoster-Verlust) — kompletter Neuaufbau
Voraussetzung: ein neuer Ubuntu/Debian-Server mit Root-Zugriff, DNS/IP ggf. neu.

1. **System vorbereiten:** `node` (v22, s. `node --version` oben), `nginx`, `sqlite3`,
   `rsync` installieren. SSH-Key des neuen Servers in `~/.ssh/known_hosts` auf dem
   Mac aufnehmen bzw. `deploy.sh`/`pull-backup-offsite.sh` auf die neue IP anpassen.
2. **App-Code deployen:** `/opt/aeris-server/` anlegen, `server/`-Ordner aus diesem
   Repo per `rsync` übertragen (s. `deploy.sh` als Vorlage — bei neuem Server zuerst
   `REMOTE_HOST` in `deploy.sh` auf die neue IP ändern), danach `npm ci` auf dem
   Server selbst (better-sqlite3 muss nativ gegen die Server-Node-Version gebaut werden,
   NICHT den `node_modules`-Ordner vom Mac kopieren).
3. **systemd-Units einspielen** (liegen in diesem Repo, NICHT im rsync-Zielordner
   — immer explizit nach `/etc/systemd/system/` kopieren, s. `deploy.sh`-Kommentar):
   - `aeris-server.service` → `AERIS_ALLOWED_ORIGIN` ggf. auf neue Domain/IP anpassen.
   - `aeris-backup.service` + `aeris-backup.timer`.
   - `systemctl daemon-reload && systemctl enable --now aeris-server aeris-backup.timer`.
4. **JWT-Secret:** NEU generieren lassen (Server erzeugt `jwt-secret.txt` beim ersten
   Start automatisch, falls nicht vorhanden — s. `server.js`). Das bedeutet: **alle
   bestehenden Bearer-Tokens werden ungültig, jeder Nutzer muss sich neu einloggen**
   (PIN/Passwort bleibt unverändert, nur das Token verfällt) — kein Datenverlust, nur
   ein einmaliger Zwangs-Logout. Alternative (nur falls nahtloser Übergang gewünscht):
   `jwt-secret.txt` aus einem aktuellen Server-Backup/einer manuellen Sicherung
   wiederherstellen BEVOR der Server zum ersten Mal startet — Secret liegt NICHT in
   der DB und NICHT im `.db.gz`-Backup, muss separat gesichert worden sein.
5. **DB wiederherstellen:** neuestes Backup von Renés Mac (`backups-offsite/`) oder,
   falls der alte Server noch per SSH erreichbar war, aus `/opt/aeris-backups/` holen
   → Schritte 3-4 aus Szenario A (gunzip, kopieren, `chown www-data:www-data`,
   `PRAGMA integrity_check`).
6. **Nginx-Config:** TLS-Zertifikat (`/etc/nginx/aeris-ssl/aeris.crt`+`.key`, aktuell
   selbstsigniert — s. `CLAUDE.md` § "Offene Entscheidungen" zum echten CA-Zertifikat)
   + `.htpasswd` (Basic-Auth-Nutzerdatei) müssen aus einer separaten Sicherung
   wiederhergestellt oder neu erzeugt werden — **beides ist NICHT Teil des DB-Backups**,
   bei reinem Neuausstellen der Zertifikate ändert sich der Fingerprint (Browser-Warnung
   einmalig erneut). Proxy-Regeln 1:1 aus der bestehenden Config übernehmen: `/api/setup`
   und `/api/login` bleiben hinter Basic-Auth, alle übrigen `/api/*`-Routen mit
   `auth_basic off` (JWT übernimmt dort die Prüfung — s. Kommentar in der Live-Config),
   `/signatur.html` explizit `auth_basic off` (externe Klient:innen-Signatur).
7. **Verifikation vor Live-Schaltung:** `systemctl is-active aeris-server` → `active`,
   Test-Login gegen `/api/login` (erwartbar: 401 ohne gültige Daten, kein 500),
   `curl -k https://<neue-ip>/api/btm/praeparate` ohne Token → 401 (nicht 500),
   `node --test` in `server/test/` gegen eine Wegwerf-DB (nicht die Produktiv-DB!).

## Restore-Test — Ergebnis (2026-10-23, durchgeführt)
Lokal auf dem Mac, isoliert (temp-Verzeichnis, NICHT gegen Produktiv-/Entwicklungs-DB):
neuestes Offsite-Backup (`aeris-2026-10-23-033152.db.gz`) entpackt, `PRAGMA
integrity_check` → **`ok`**, alle 16 Tabellen lesbar, Beispieldaten real und konsistent
(`blob`: 1 Zeile, `login_sperre`: 2 Zeilen mit echten Werten). **Ergebnis: Restore
funktioniert wie erwartet, keine Korruption, kein spezielles Tool außer `gunzip`+
`sqlite3` nötig.**

## Was dieses Runbook NICHT abdeckt (bewusst, nicht mein Scope)
- WER im Notfall Zugriff auf Backup/Recovery-Prozess haben soll (K8, René-Entscheidung).
- Echtzeit-Replikation/RPO <24h (würde einen zweiten dauerhaft laufenden Server oder
  einen bezahlten Managed-DB-Dienst erfordern — nicht "ohne neue Kosten" umsetzbar).
- Verschlüsselung der Backup-Dateien selbst (Format ist aktuell roh/unverschlüsselt,
  s. o. — separater Fix, nicht Teil von K3).
