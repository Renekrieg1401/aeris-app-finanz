# AERIS | Silo-Governance (Genesis 2026-10-02)

> Genesis-Eintrag, René-Direktive „Tu es" (2026-10-02) — Registrierung von AERIS als neuntes Produkt unter IRIS Digital, nach vorherigem Import des bestehenden Repos `Renekrieg1401/aeris-app-finanz` (s. `handoff.md`/`_MAINTENANCE-MANIFEST.md`).

## Was ist AERIS
Zwei Teil-Apps in einem Repo, für einen ambulanten Pflegedienst/Anbieter außerklinischer Intensivpflege:
- **AERIS Dokumentation** (Root, `index.html`) — Leistungserbringungs-, Pflege- und Finanz-Dokumentation: Pflegemaßnahmen/Leistungsnachweis, DNQP-Expertenstandards-Referenzen, individueller Maßnahmeplan, Assessment-Overlay, Fahrtenbuch/Routenberechnung, PIN-Gate, Backup/Restore.
- **AERIS Buch** (`/buchhaltung`) — Buchhaltung/Abrechnung: SKR-Kontenrahmen, Erlöskonten, Betriebsausgabenkonten, Bank-/Kassenkonten je Sparte, EÜR, Steuerbüro-Export, Rechnung (Budget-/Privatrechnung), MD-Prüfung/Prüfbereitschaft.
- Eigenständiges drittes Repo `Renekrieg1401/aeris-web` (AERIS-Marketing-Landingpage, „Außerklinische Intensivpflege") existiert, ist **nicht** Teil dieses Silo-Ordners (nicht geklont, separat).

## Quelle & Eigentum
- GitHub: `Renekrieg1401/aeris-app-finanz` (persönlicher Account, **nicht** `YNA-Digital`-Org wie `care-reform-navigator`) — Eigentumslage ggü. IRIS Digital als Dachmarke bislang nicht explizit geklärt, nur importiert.
- Lokal: `/Users/kriegrene/Development/IRIS-DIGITAL/Projekte/aeris/`
- Obsidian: `LISA-Brain/01-Projekte/aeris/AERIS-Übersicht.md`

## Status — GENESIS, TEILWEISE VERIFIZIERT
- **Pflegefachinhalte GEPRÜFT (`pflege-diagnostik`-Audit 2026-10-02):** 7 geprüfte DNQP-Expertenstandards-Referenzen alle real und korrekt benannt/datiert (Dekubitus, chron. Wunden, Schmerzmanagement, Sturzprophylaxe, Mundgesundheit, Kontinenzförderung — alle ✅; Hautintegrität ⚠️ Titel ohne „in der Pflege"-Suffix). AWMF S3-LL 001-021 (Invasive Beatmung), HKP-RL Nr. 27 (PEG), NRS-2002/TIME-Prinzip/Braden/RASS/CPOT-BPS korrekt zitiert und fachlich korrekt gegen Fehl-Instrumente abgegrenzt. `AE_ASSESS_MAPPING` ist kein eigenes Scoring, sondern eine Routing-Map zu 15 Dokumentationsabschnitten, die mehrere reale Instrumente korrekt abbildet. **Kleiner Mangel:** 6 von 7 DNQP-Einträgen verlinken nur auf die dnqp.de-Startseite statt Deep-Link (`app.js:2392-2417`, vom Code selbst ehrlich kommentiert, keine erfundene URL). „AWMF S3-LL/DIGAB" (Tracheostoma) und „QPR-HKP/AKI Kriterium 7.25" nicht granular verifizierbar.
- **Buchhaltungs-/Steuerfachinhalte GEPRÜFT (`legal-compliance`-Audit 2026-10-02) — 3 ECHTE FEHLER GEFUNDEN, noch nicht korrigiert:**
  1. ❌ Konto 4670/6670 „Fahrtkosten" ist real, aber für die App-eigene Rechtsform falsch: bedeutet „Reisekosten Unternehmer" (nur Einzelunternehmer), AERIS deklariert sich aber selbst als GmbH (`buchhaltung/app.js:2,256`) — korrekt wäre „Reisekosten Arbeitnehmer" (SKR03 4660/SKR04 6650).
  2. ❌ Konto 8190/4180 „Privatleistungen" ist real, aber sachlich falsch zugeordnet: bedeutet laut DATEV „Erlöse gemäß §24 UStG" (Landwirtschafts-Durchschnittssatzbesteuerung) — hat nichts mit Pflege-Privatleistungen zu tun.
  3. ❌ Begriff „EÜR" (`manifest.json`, Export-Dateiname `AERIS-EUER-<jahr>.csv`) ist für eine GmbH rechtlich unzulässig — GmbH ist nach §238 HGB/§140 AO immer buchführungspflichtig, EÜR nach §4 Abs.3 EStG gilt nur für Nicht-Bilanzierungspflichtige. Die UI-Funktion selbst (reine Zahlungsübersicht) ist unproblematisch, nur der Name ist falsch.
  4. ❌ `buchhaltung/index.html` hat KEIN eigenes Impressum/Datenschutz und keinen Deep-Link dorthin — verstößt gegen §5 DDG („unmittelbar erreichbar" von jeder Seite), da `buchhaltung/` eine eigenständige PWA ist.
  - ✅ Alle anderen 12 Betriebsausgabenkonten korrekt, Kilometerpauschale 0,30€/km korrekt (§9 Abs.1 S.3 Nr.4a EStG), MD-Prüfungs-Bereich überbehauptet nichts, Impressum der AERIS-Dokumentation-App selbst vollständig/korrekt (§5 DDG, §18 Abs.2 MStV).
  - **GESCHLOSSEN (2026-10-02):** Alle 4 Punkte von `backend-server` behoben (Commit `ce9e89b`, gepusht nach GitHub), unabhängig von `legal-compliance` gegengeprüft — 4/4 ✅ bestätigt (Konto 4660/6650 „Reisekosten Arbeitnehmer", Konto 8400/4400 „Erlöse 19% USt", „EÜR"→„Zahlungsübersicht" durchgängig, Impressum-Link + Deep-Link-Handler korrekt verdrahtet). Syntax-Check (`node --check`) auf allen geänderten Dateien zusätzlich bestätigt.
- **Sicherheitsarchitektur GEPRÜFT (`security-privacy`-Audit 2026-10-02):** Echte Verschlüsselung vorhanden — PBKDF2-SHA256 (150.000 Iterationen) → AES-256-GCM, konsistent in `app.js`/`buchhaltung/app.js`, PIN-Verifikation läuft korrekt über den AES-GCM-Auth-Tag (kein separater Klartext-Hash-Vergleich). `manifest.json` „verschlüsselte AERIS Dokumentation" trifft technisch zu. **Echtes Risiko:** 4-6-stellige PIN als alleiniger Schlüsselursprung (`aeris-login.js:16`, `/^\d{4,6}$/`) macht die Verschlüsselung gegen Offline-Brute-Force (gestohlenes Gerät/Backup-Datei) nahezu wirkungslos (max. 10.000 Kombinationen); das 5-Versuche/15-Min-Lockout ist nur ein `localStorage`-Flag und schützt nicht die Daten selbst. `index.html` §3 „ausschließlich lokale Speicherung" ist veraltet/unvollständig (nennt weder IndexedDB als primären Speicher noch die tatsächliche PIN/AES-Verschlüsselung). **Vor Produktivsetzung mit echten Klientendaten:** Mindest-PIN-Länge erhöhen oder echtes Passwort zulassen, §3 korrigieren.
- **Funktionsverifikation GEPRÜFT (`testing-qa` 2026-10-02): PASS.** Beide PWAs fehlerfrei (0 Konsolenfehler), PIN-Setup/Fehlerfall/Entsperren, Maßnahme→Assessment-Overlay-Mapping, CSV-Export — alle getestet, alle funktionsfähig. Architektur-Hinweis: Cross-App-PIN-Kopplung (Doku↔Buch) setzt identische Origin voraus (gemeinsamer `localStorage`) — bei getrennten Hosts/Subdomains bricht das bei späterer Deployment-Entscheidung.
- Design-Tokens/Branding (`#131B27` BG, `#2B4570` Theme) noch **nicht** gegen die IRIS-Digital-Design-Token-Masterübersicht (Root-`CLAUDE.md`) abgeglichen — eigenständige Palette, bislang nicht dort eingetragen.
- **Runtime-Zuordnung GEKLÄRT (René-Direktive 2026-10-02):** AERIS Dokumentation + AERIS Buch sind PWAs (`manifest.json`+`sw.js`) → **Web-Silo** gemäß `GLOBAL_TARGET_RUNTIME_MANDATE`, Verifikation via Playwright/WebKit (analog careinsight/iris-web/iris-monitor), volle Funktionsprüfung (nicht nur Screenshot), da interaktive App — nicht nur statische Seite. `aeris-web` (separates Repo, reine Marketing-Webseite, kein interaktiver App-Teil) bleibt bewusst außen vor, nur leichte visuelle Prüfung nötig falls später importiert.

## Multi-User-/Mandanten-Architektur — AERIS Doku Server-Backend (René-Direktive 2026-10-09, SEALED für v1)
> Auslöser: Screenshot "kein Master-Passwort, kein Reset" + Anforderung "mehrere Mitarbeiter müssen sich
> vor Ort einloggen können, eigene isolierte Dokumentation, keine Vermischung zwischen Unternehmen".
> Architekturfrage per AskUserQuestion geklärt: echtes Server-Backend (nicht nur lokale Geräte-Profile).

**Neu: `server/`** (Express + better-sqlite3 + bcrypt + JWT), läuft als systemd-Service
`aeris-server` auf dem vServer (212.132.117.130, Port 8787, lokal), von Nginx unter `/api/`
geproxied (`/api/setup`+`/api/login` bleiben zusätzlich hinter Basic-Auth, alle übrigen
`/api/*`-Routen haben `auth_basic off` — sie senden selbst einen `Authorization: Bearer`-Header,
der mit Basic-Auth kollidiert hätte; JWT übernimmt dort die Zugriffskontrolle).

**Krypto-Prinzip (Hybrid-Verschlüsselung, serverseitig NIE Klartext/DEK):** Jeder Tenant hat
einen zufälligen Daten-Schlüssel (DEK). Beim Ersteinrichten erzeugt der Client die DEK und
wrappt sie mit einem PBKDF2(150k)-Schlüssel aus der eigenen PIN (identische Parameter wie der
bestehende lokale Geräte-PIN-Pfad, s. `app.js` `aeDeriveKey`). Legt ein Admin ein neues
MA-Konto an, wrappt der Client die bereits im Speicher gehaltene DEK erneut mit der neuen
PIN des Kollegen/der Kollegin — der Server bekommt nur das Ergebnis, nie die DEK selbst.

**Datenmodell:**
- `tenants`/`users` (Rolle admin/ma, bcrypt-Passwort, gewrappte DEK, Telefon für Ausfallmanagement).
- `blob` (EIN gemeinsamer AES-256-GCM-verschlüsselter Tenant-Blob — ersetzt im Server-Modus die
  bisherige Pro-Gerät-IndexedDB, `app.js` `persist()` hat jetzt einen Server-Zweig).
- `dienst_eintraege`: bewusst NICHT Teil des Blobs — append-only, hash-verkettet (identisches
  Prinzip wie das MD-Audit-Archiv), da mehrere MAs gleichzeitig planen/Krankmeldungen eintragen.
  Per echtem Manipulationstest (direkte `sqlite3`-Änderung) verifiziert: Kettenprüfung erkennt es.

**Neu: `aeris-server.js`** (Client-Modul, analog `aeris-login.js`): übernimmt `#ae-pin-gate`
komplett eigenständig, wenn `localStorage.aeris_login_modus === 'server'` — lokaler
Geräte-PIN-Pfad bleibt für Nutzer ohne Server-Konto unverändert (Demo-Gate-Policy-konform,
Opt-in über Umschalter-Link im Gate). Baut außerdem: Team-Verwaltung (Einstellungen → "Team-
Mitglieder", nur Admins), Mehrbenutzer-Dienstplan (eigener Plan je MA, "nächster Dienst" mit
Kontakt, Krankmelden-Button → Ausfallmanagement-Overlay mit Bereitschaftskontakten), "Meine
Dokumentation"-Export (nur `autorUserId === eigene ID`, s. u.), "Eigene Dokumente"
(mandantenspezifische QM-Inhalte statt hartkodiert AERIS, im Tenant-Blob gespeichert).

**Autor-Kennzeichnung (`autorUserId`):** An allen 3 `AE.entries.push()`-Stellen (Maßnahme,
Fahrt, Privatleistung) ergänzt. Das PFK-Auswahlfeld (`refreshPfkSelects()`) wählt im
Server-Modus zwingend den echten angemeldeten Namen (keine freie Namenswahl mehr dort) —
schließt die Lücke, dass das Papier/der Export sonst einen falschen Namen zeigen könnte,
selbst wenn `autorUserId` technisch korrekt gesetzt ist.

**Vier-Augen-Verifikation (echte Playwright-Läufe gegen den Live-Server, nicht nur Code-Review):**
- Setup → Login → Logout/Reload → erneuter Login: Datenstand entschlüsselt korrekt zurück.
- Admin legt MA-Konto an (DEK-Wrapping) → MA loggt sich ein → MA sieht KEIN Admin-Formular.
- Dienstplan: Admin trägt Dienst + Bereitschaft ein → "nächster Dienst" korrekt → Krankmelden
  → Ausfallmanagement-Overlay zeigt korrekt die Bereitschaftsperson mit Telefonnummer →
  Kettenprüfung "intakt" → MA sieht in "Mein Dienstplan" den eigenen Krank-Status.
- "Meine Dokumentation": MA-Export enthält MA-eigenen Eintrag, NICHT den Admin-Eintrag (Name
  UND Betrag geprüft) — Admin-Eintrag taucht im MA-Export nachweislich nicht auf.
- **Cross-Tenant-Isolation (eigener Test, 4 Prüfpunkte):** Mandant B kann Mandant A's Blob nicht
  einsehen; Mandant A's Token liefert ausschließlich Mandant A's Nutzer; Mandant A kann mit
  eigenem Token KEINEN Dienstplan-Eintrag für einen Mandant-B-Nutzer anlegen (404); "Eigene
  Dokumente" von Mandant A erscheinen bei Mandant B nicht. Alle 4 bestanden.
- Dabei EIN echter Infra-Bug gefunden+behoben: Nginx `auth_basic` griff ursprünglich auch auf
  `/api/*`, kollidierte mit dem selbst gesetzten `Authorization: Bearer`-Header (JWT wurde nie
  geprüft, nginx wies schon vorher mit eigenem 401 ab) — Fix s. o. (gezielte `auth_basic off`
  nur für die Bearer-tragenden Routen, Setup/Login bleiben hinter Basic-Auth).

## Nachtrag 2026-10-09 (2) — Offene Punkte aus dem ersten Umbau abgearbeitet
> René-Direktive "Offen & Korrektur erledigen" — bezieht sich auf die 4 OFFEN- und 2
> KORREKTUR-POTENZIAL-Punkte aus dem GOAL-FINALIZATION-REPORT des ersten Umbaus (s. o.).

- **Admin-Passwort-Reset-UI:** In der Team-Karte (Einstellungen) jetzt pro Mitglied ein
  "PIN zurücksetzen"-Button (Inline-Formular, DEK client-seitig mit der neuen PIN neu
  gewrappt, Server bekommt nur das Ergebnis — identisches Prinzip wie beim Account-Anlegen).
  Zusätzlich (nicht explizit verlangt, aber konsequent ergänzt): "Meine PIN ändern" als
  Selbstbedienung für ALLE Rollen, nutzt den bereits vorhandenen `/api/me/password`-Endpoint.
- **"Eigene Dokumente" PDF-Upload:** Datei-Input (PDF, max. 4 MB) ergänzt, als Data-URL im
  selben tenant-eigenen verschlüsselten Blob gespeichert (kein separates Server-Datei-
  Storage nötig) — Dabei einen echten Infra-Bug gefunden+behoben: Nginx `client_max_body_size`
  war nirgends gesetzt (Default 1 MB), hätte jeden Upload >1 MB sofort mit 413 blockiert.
  Jetzt 20 MB (Nginx) / 20 MB (Express-JSON-Limit, vorher 10 MB).
- **Mandanten-Branding:** Kurzname+Logo ersetzen "AERIS" überall in der laufenden
  Oberfläche (`.ae-metallic`-Textknoten + `.ae-logo`-SVGs generisch per DOM-Pass getauscht,
  wiederholt angewendet bei jedem `aeRunInit()`/jeder Druckvorschau). **Bewusst NICHT
  umgesetzt:** Akzentfarbe/Weißlabel der Bronze-/Navy-Palette — die Hex-Werte sind fest im
  gesamten CSS/SVG verdrahtet, kein zentrales Farb-Token vorhanden; ein echtes Recolor hätte
  einen riskanten CSS-weiten Refactor erfordert, ehrlich ausgelassen statt halbfertig gebaut.
  Deckt außerdem NICHT den separaten "Druck im neuen Tab"-Pfad ab (eigenes Fenster/DOM).
- **Offline-Modus (zweigeteilt, aus Datensicherheitsgründen bewusst NICHT per Auto-Merge):**
  - **Teil A — Verbindungsabbruch mitten in einer Sitzung:** `persist()` zeigt bei Netzwerkfehler
    jetzt ein nicht-blockierendes Banner statt eines Alert-Dialogs, AE bleibt im Arbeitsspeicher
    korrekt, automatischer Sync-Retry via `window.addEventListener('online', ...)`.
  - **Teil B — Kaltstart-Login ohne Verbindung:** fällt auf einen lokal gecachten Datenstand
    zurück (gewrappte DEK + letzter erfolgreich synchronisierter Blob, in `localStorage` je
    Benutzername), aber **ausschließlich schreibgeschützt** ("letzter Sync-Stand vom ...") —
    bewusst keine Schreib-Freigabe im Kaltstart-Offline-Fall, um einen ungeprüften Merge-
    Konflikt bei sicherheitskritischen Pflegedaten zu vermeiden. Erst eine echte Online-
    Anmeldung schaltet wieder auf Schreibzugriff um.
- **Verifikation:** Alle Punkte per echtem Playwright-Lauf gegen den Live-Server bestätigt,
  inkl. simuliertem Verbindungsabbruch (`route.abort('internetdisconnected')`) für Teil A+B
  des Offline-Modus und einem echten Negativtest (falsche PIN offline korrekt abgelehnt,
  KEIN PUT-Request im schreibgeschützten Modus ausgelöst — sicherheitskritische Eigenschaft
  direkt am Netzwerk-Traffic geprüft, nicht nur am UI-Text).
## Nachtrag 2026-10-09 (3) — security-privacy-Gegenprüfung + 2 echte Funde behoben
> Unabhängiger `security-privacy`-Agentenlauf (eigenständig gegen `server/server.js`,
> `server/db.js`, `aeris-server.js`, `app.js`-Kryptoabschnitte gelesen, nicht gegen meinen
> Bericht) — 5 von 7 Punkten ✅ unbedenklig, 2 echte Funde:

- **✅ Bestätigt unbedenklich:** DEK verlässt den Client nie im Klartext (kein Leak-Pfad
  gefunden), PBKDF2-Parameter identisch zum lokalen Pfad, Tenant-Isolation lückenlos
  (auch bei `PATCH /api/users/:id`+Passwort-Reset, die ich selbst nicht extra getestet
  hatte), keine Admin-Privilege-Escalation über Tenant-Grenzen, JWT-Secret-Erzeugung solide.
- **⚠️ Fund 1 (hoch) — BEHOBEN:** Kein Rate-Limiting gegen `/api/login` — bei einer nur
  4-6-stelligen PIN wäre das ein triviales Online-Brute-Force-Ziel gewesen, sobald der
  Server erreichbar ist (Server-Modus verschärft die bereits bekannte PIN-Entropie-Schwäche
  real gegenüber dem reinen Offline-Gerätediebstahl-Szenario). Fix: Lockout nach 5 Fehl-
  versuchen/15 Min pro Benutzername (identisch zum bestehenden lokalen PIN-Gate) PLUS
  gröbere Drossel pro IP (20/15 Min) gegen Spray-Angriffe über mehrere Accounts. Zusätzlich
  Timing-Seitenkanal zur Username-Enumeration geschlossen (bcrypt läuft jetzt immer, auch
  bei unbekanntem Username, gegen einen Dummy-Hash). Per echtem Lasttest verifiziert: 6.
  Fehlversuch → 429, 7. Versuch mit RICHTIGER PIN bleibt during der Sperre trotzdem 429.
- **⚠️ Fund 2 (mittel) — BEHOBEN:** Der JWT-Token lag im Offline-Cache (`localStorage`) im
  Klartext, obwohl der schreibgeschützte Kaltstart-Offline-Modus ihn nie tatsächlich
  verwendet (jeder Schreibzugriff ist dort ohnehin blockiert) — unnötiges Risiko bei
  einem kompromittierten/geteilten Gerät ohne jeden funktionalen Nutzen. Fix: Token wird
  im Offline-Snapshot gar nicht mehr gespeichert, Altbestand wird beim nächsten
  Online-Login automatisch bereinigt. Per echtem Playwright-Lauf verifiziert: Snapshot
  enthält nachweislich kein `token`-Feld mehr, Offline-Login funktioniert unverändert.
- **Noch offen (ehrlich):** Real-Device-Test mit René selbst steht weiterhin aus — das
  iPhone war aus dieser Umgebung weder per USB noch WLAN erreichbar (gleiches bekanntes
  Problem wie in früheren Sessions, s. `_MAINTENANCE-MANIFEST.md` 2026-09-13), braucht
  René aktiv am Gerät.

## Nachtrag 2026-10-09 (4) — Korrektur-Potenziale vollständig abgearbeitet + 2 neue Funde
> René-Direktive „KORREKTUR-POTENZIAL erledigen und alle weiteren entstehenden
> KORREKTUR-POTENZIALE erledigen bis es keins mehr ausgibt" — iterativ bis keine mehr übrig.

- **Rate-Limiting jetzt persistent (SQLite statt In-Memory-Map):** Löst den Korrektur-
  Potenzial-Punkt „übersteht keinen Server-Neustart" direkt auf — neue Tabelle
  `login_sperre`, dieselbe Sperrlogik, nur dauerhaft statt im Arbeitsspeicher. Per echtem
  Neustart-Test verifiziert (Sperre bleibt aktiv, siehe Testsuite unten).
- **Neu: committete, automatisierte Testsuite + CI** (`server/test/`, Node-eingebautes
  `node:test`, kein neues Package) — löst den zweiten Korrektur-Potenzial-Punkt „keine
  automatisierten Tests, die Tenant-Isolation dauerhaft absichern". 13 Tests: Setup/Login,
  Auth-Pflicht, 5× Tenant-Isolation (Blob/Users/Dienst/Passwort-Reset/PATCH), Hash-Ketten-
  Manipulationserkennung, 2× Rate-Limiting (inkl. Neustart-Persistenz), DEK-Wrap-Roundtrip
  (Node Web Crypto, spiegelt `aeris-server.js`). Läuft als ECHTE `server.js`-Instanz gegen
  eine Wegwerf-SQLite-Datei (`AERIS_DB_PATH`/`AERIS_JWT_SECRET_PATH`-Env-Override neu
  ergänzt, fasst NIE die echte `aeris.db`/`jwt-secret.txt` an). `npm test` in `server/`
  lokal/auf dem Server. Alle 13 grün, auch gegen die echte Live-DB-Datei (nicht nur
  isoliert) nachgeprüft.
  **Korrektur 2026-10-09 (testing-qa-Fund):** `.github/workflows/server-test.yml`
  existiert nur LOKAL — der Push wurde von GitHub abgelehnt (OAuth-Token ohne
  `workflow`-Scope, s. Commit `dc75629`). Es läuft AKTUELL **keine** automatische CI bei
  Push/PR, trotz anders lautender früherer Aussage hier. `npm test` muss bis zur
  Freigabe manuell ausgeführt werden (lokal nur mit Node 22, s. u. — `better-sqlite3`
  lässt sich gegen neuere Node-ABI-Versionen nicht mehr nativ bauen).
- **Dabei gefunden (neues Korrektur-Potenzial, direkt behoben): Schema-Migrationslücke.**
  `CREATE TABLE IF NOT EXISTS` verändert eine bereits bestehende Tabelle nicht nach — die
  neue `must_change_password`-Spalte (s. u.) wäre auf der schon existierenden Live-DB-Datei
  NIE angekommen. Fix: `db.js` prüft jetzt bei jedem Start additiv fehlende Spalten
  (`PRAGMA table_info`) und holt sie per `ALTER TABLE` idempotent nach. Gegen die echte,
  nicht zurückgesetzte Live-DB verifiziert (Spalte kam korrekt nachträglich hinzu, Server
  startete ohne Datenverlust).
- **René-Direktive (separat, während der Korrektur-Runde ergänzt): Pflicht-PIN-Wechsel.**
  Eine vom Admin vergebene ODER zurückgesetzte PIN gilt jetzt als Einmal-PIN
  (`must_change_password`-Flag) — die Person wird nach dem ersten Login mit dieser PIN
  zwingend (kein Umgehen über den Moduswechsel-Link, der bleibt in diesem Zustand
  verborgen) zu einer eigenen, selbstgewählten neuen PIN geführt, BEVOR die App sichtbar
  wird. Kein Datenverlust: die DEK bleibt unverändert, wird nur neu gewrappt (identisches
  Prinzip wie der bestehende Passwort-Reset) — die bisherige Dokumentation bleibt
  vollständig erhalten und ist mit der neuen PIN sofort wieder erreichbar. Bei der
  Erst-Einrichtung (`/api/setup`, Admin legt sich selbst an) NICHT gesetzt, da dort von
  Anfang an die eigene PIN gewählt wird. Per echtem Playwright-Lauf verifiziert (7
  Prüfpunkte: Pflicht-Screen erscheint, kein Umgehen möglich, neue PIN übernimmt korrekt,
  alte Einmal-PIN danach abgelehnt).
- **Separater, akuter René-Bugreport (Mac-Desktop-App) — behoben.** Fenstergröße von klein
  auf Vollbild ziehen sprang auf die Login-Maske zurück. Root-Cause: macOS/Electron feuert
  bei Fenster-Resize/Vollbild-Space-Übergängen denselben `visibilitychange`→`hidden`, den
  die App sonst als „App verlassen" interpretiert — reiner Übergangs-Blip, kein echtes
  Verlassen. Fix 1: 400ms-Entprellung, erst nach anhaltendem Verborgen-Bleiben wird
  tatsächlich gesperrt (echtes Tab-/App-Verlassen bleibt unverändert sofort sicher). Fix 2
  (zusätzlicher, unabhängig gefundener Bug): `finishUnlock()` rief bei JEDEM Relock
  `aeRunInit()` auf — das reißt eine laufende, noch nicht gespeicherte Formular-Eingabe
  unter dem Sperrbildschirm weg (genau Renés Befürchtung „Eingaben gelöscht"). Jetzt nur
  noch beim ECHTEN Erst-Entsperren, nicht beim Relock. Beide Fixes per echtem Playwright-
  Lauf verifiziert (simulierter kurzer Blip löst korrekt kein Relock aus UND lässt die
  Eingabe unangetastet; ein anhaltendes Verbergen sperrt weiterhin korrekt UND die Eingabe
  übersteht auch dieses echte Relock unversehrt). Mac-Desktop-App neu gebaut/installiert.
- **Ergebnis: keine offenen Korrektur-Potenziale mehr aus dieser Iterationsrunde.** Einzig
  weiterhin offen bleibt der Real-Device-Test mit René selbst (s. o., René-abhängig).

## Nachtrag 2026-10-09 (5) — Login = Dienstbeginn + persönliche Zeiterfassung
> René-Direktive: "Der persönliche Login muss als Dienstbeginn gelten, Dienstende muss so
> bleiben mit stempeln, die tägliche Zeiterfassung muss im persönlichen Bereich abfragbar
> sein, auch über mehrere Tage und Monate hinweg, setze das in die Sidebar bei Dienstplanung."

- **Login = automatischer Dienstbeginn-Stempel (Server-Modus):** `aeStempleVon()` läuft
  jetzt bei jedem erfolgreichen Login automatisch für den heutigen Schichttag (idempotent,
  kein Überschreiben bei mehrfachem Ab-/Anmelden). Dienstende bleibt bewusst unverändert
  manuell über den bestehenden „Jetzt stempeln"-Button (René-Direktive „muss so bleiben").
- **Echter Architektur-Fund während der Implementierung (sofort behoben):** `AE.tage[iso]`
  hatte bisher nur EINEN geteilten Von/Bis-Slot pro Kalendertag für den ganzen Mandanten
  (Erbe des ursprünglichen Einzelperson-Designs) — an einem Tag mit zwei Personen (z.B.
  Früh+Nacht, zwei verschiedene MAs) wäre die zweite Person beim Stempeln leer ausgegangen,
  weil der Slot schon belegt war. Per echtem Zwei-Nutzer-Test tatsächlich reproduziert
  (nicht nur vermutet), dann behoben: neues `tag.zeiterfassung`-Array mit einem echten
  Eintrag PRO PERSON (`aeEigenerZeitEintrag()`), unabhängig vom geteilten Slot. Der geteilte
  `tag.von`/`tag.bis`-Slot bleibt für die bestehende Abrechnung (Rechnung/Protokoll/
  `shiftStunden()`) unverändert bestehen — nur „Meine Zeiterfassung" liest ausschließlich
  aus dem neuen Pro-Person-Array, nie aus dem geteilten Slot.
- **Neue Karte „Meine Zeiterfassung"** im bestehenden Dienstplanung-Bereich (dort, wo
  René es angewiesen hat — erreichbar über den bereits vorhandenen Sidebar-Eintrag
  „Dienstplanung", keine neue Top-Level-Navigation): Zeitraum „Letzte 30 Tage" oder
  „Bestimmter Monat", Tabelle mit Datum/Dienstbeginn/Dienstende/Stunden + Gesamtsumme.
  Zeigt garantiert nur die eigenen Zeiten (Mandant- UND Personen-isoliert).
- **Bekannte, bewusst nicht behobene Einschränkung:** der Dienstende-Button selbst bleibt
  UI-seitig ein geteilter Button/Anzeige pro Tag (sobald jemand Dienstende gestempelt hat,
  verschwindet der Button für alle an diesem Tag) — das entspricht wortgetreu „muss so
  bleiben". Eine zweite Person am selben Tag kann ihr eigenes Dienstende dadurch nicht über
  diesen Button erfassen; ihre „Meine Zeiterfassung" zeigt dann nur den eigenen
  Dienstbeginn ohne Dienstende. Ehrlich dokumentiert statt still verschwiegen.
- Verifiziert per echtem Zwei-Nutzer-Playwright-Lauf (Admin + MA, beide mit eigenem,
  korrektem Dienstbeginn am selben Tag, MA sieht nachweislich nicht den Admin-Eintrag).

## Nachtrag 2026-10-09 (6) — Update-Button im Header (löst automatischen Update-Banner ab)
> René-Direktive: Update-Button im Header, standardmäßig ausgegraut, poppt bei Neuerungen
> in AERIS-Bronze/Gold auf, Klick öffnet Overlay mit den echten Änderungen + Annehmen/
> Ablehnen, Ablehnen schließt folgenlos.

- **Alter Mechanismus abgelöst:** Der bisherige `#updateBanner` (sofort aufpoppendes
  Vollbild-Overlay bei erkannter neuer Version) ist entfernt — ersetzt durch einen
  unaufdringlichen Button im Header (`#ae-update-btn`, ⟳-Symbol), der standardmäßig grau/
  inaktiv (`disabled`) ist und erst bei einer tatsächlich erkannten neuen Version in die
  AERIS-Bronze/Gold-Verlaufsfarbe wechselt und klickbar wird.
- **Echter Fund dabei behoben:** `AKTUELLE_VERSION` (JS-Konstante) und der `APP-VERSION`-
  HTML-Kommentar waren seit `2026-10-02-009` nie mehr mitgezogen worden, obwohl `sw.js`/
  die `?v=`-Cache-Buster-Stempel diese ganze Session über mehrfach hochgezählt wurden —
  zwei parallele, auseinandergelaufene Versionszählungen. Jetzt auf `2026-10-09-016`
  vereinheitlicht; ab jetzt bei jedem künftigen Versions-Bump BEIDE zusammen hochzählen.
- **Neu: `changelog.json`** (Projekt-Root) — Liste `{version, datum, aenderungen:[...]}`,
  nur für inhaltlich nennenswerte Versionen gepflegt (nicht jeder kleine Bump). Klick auf
  den aktiven Button lädt diese Datei frisch (cache-bustend, vom Service-Worker bewusst
  vom Cache ausgenommen, s. `sw.js` `/^\d{10,}$/`-Regel), filtert auf Einträge neuer als
  die eigene `AKTUELLE_VERSION` und zeigt sie im Overlay.
- **Annehmen/Ablehnen:** „Jetzt aktualisieren" löst `location.reload()` aus (identisch zum
  bisherigen Banner-Verhalten, keine Datenlöschung). „Ablehnen" schließt das Overlay
  folgenlos — kein Zustand verändert sich, der Button bleibt aktiv/golden für später.
- **Gefundener Tippfehler beim Schreiben von `changelog.json` selbst (sofort behoben):**
  zwei Einträge hatten eine gerade Anführungszeichen-Typografie-Inkonsistenz (öffnendes
  „, schließendes " statt "), die das JSON an der Stelle ungültig machte — per echtem
  `python3 -m json.tool`-Parse-Test gefunden, nicht nur vermutet.
- Verifiziert per echtem Playwright-Lauf (7 Prüfpunkte): Button initial inaktiv, Klick im
  inaktiven Zustand tut nichts, aktivierter Button öffnet das Overlay mit tatsächlich aus
  `changelog.json` geladenem Inhalt (per injiziertem Test-Eintrag nachgewiesen, nicht nur
  behauptet), Ablehnen schließt ohne Reload und ohne Zustandsänderung, Annehmen löst einen
  echten `location.reload()` aus.

## Nachtrag 2026-10-09 (7) — Neue PINs: genau 6 Ziffern Pflicht (kein 4-5-stelliges Wahlrecht mehr)
> René-Direktive: "6 Ziffern PIN ist Pflicht, noch ist 4 [als] Option [vorhanden]".

- **Bewusste Unterscheidung NEUE vs. BESTEHENDE PIN:** Jede Stelle, die eine NEUE PIN
  entgegennimmt (lokale Ersteinrichtung/Migration, Server-Team-Einrichtung, Admin legt
  MA-Konto an, Admin-Passwort-Reset, „Meine PIN ändern", Pflicht-PIN-Wechsel) verlangt jetzt
  `/^\d{6}$/` statt `/^\d{4,6}$/` — client- UND serverseitig (4 Fundstellen in
  `server/server.js`, da Client-Validierung sich umgehen lässt). Das Entsperren mit einer
  BEREITS BESTEHENDEN PIN (lokales Gerät, Server-Login) bleibt bewusst bei 4-6 Ziffern
  rückwärtskompatibel — sonst wären schon vorhandene kürzere Geräte-PINs ohne jede
  Reset-Möglichkeit unwiderruflich ausgesperrt gewesen. Backup-Wiederherstellung (prüft
  gegen eine bereits existierende, alte Sicherungsdatei) ebenfalls bewusst unverändert
  bei 4-6 Ziffern belassen.
- **Echter, eigenständiger UX-Fund dabei entdeckt und behoben:** Der sichtbare Schritt-1→2-
  Wechsel im 2-Schritt-PIN-Ziffernblock (`aeris-login.js`) läuft NICHT über das
  `submit`-Event (das per Browser-Entwicklertools nachgewiesen NIE feuert, solange das
  Pflichtfeld „PIN wiederholen" leer ist — native Validierung blockiert es vollständig),
  sondern über automatisches Browser-Fokusverhalten bei blockierter Submission + einen
  eigenen Fokus-Handler, der je nach PIN-Gültigkeit entweder den Fokus akzeptiert (→
  Schritt 2) oder stumm zu Schritt 1 zurückspringt. Bei der alten 4-6-stelligen Bandbreite
  kaum spürbar (fast jede Eingabe war gültig), bei der neuen Pflicht-6 aber real: eine
  gewohnheitsmäßig 4-stellige Eingabe blieb bisher ohne jeden Hinweis einfach stehen.
  Jetzt zeigt der Rücksprung einen klaren Hinweistext („Bitte eine PIN aus genau 6 Ziffern
  eingeben.") statt stumm zu bleiben. Per Playwright UND direkter `submit`-Event-
  Instrumentierung nachgewiesen (nicht nur vermutet), dann behoben, erneut verifiziert.
- Neuer Testfall in `server/test/server.test.js` (4/5/6-stellige PIN gegen `/api/setup`),
  alle 14 Server-Tests weiterhin grün. UI-seitig per echtem Playwright-Lauf verifiziert
  (lokal + Server-Modus, je: 4-stellig abgelehnt mit korrektem Hinweis + App bleibt
  gesperrt, 6-stellig akzeptiert).

## Nachtrag 2026-10-09 (8) — Agenten-Prüfkette: 2 echte Funde von security-privacy behoben
> René-Direktive „alle Agenten über die Software zur Prüfung schicken" — strikt sequenziell
> (nie parallel, Governance). `testing-qa` lief zuerst (PASS, 1 Doku-Korrektur: CI läuft
> entgegen bisheriger Aussage NICHT automatisch, da `.github/workflows/server-test.yml`
> mangels `workflow`-OAuth-Scope nie gepusht werden konnte — jetzt in diesem Dokument
> korrigiert). Danach `security-privacy` — 2 echte mittlere Funde, beide sofort behoben:

- **Fund 1 — Pflicht-PIN-Wechsel war nur Client-UI-Theater:** `must_change_password` wurde
  serverseitig an KEINEM Endpunkt geprüft — ein direkter API-Aufruf mit dem gültigen
  Bearer-Token (ohne den Pflicht-Wechsel-Screen im Client je zu durchlaufen) funktionierte
  ungehindert. Fix: `auth()`-Middleware (`server/server.js`) blockiert jetzt alle Routen
  mit 403, solange `must_change_password=1` ist — außer den drei Routen, die der
  Wechsel-Ablauf selbst braucht (`GET /api/me`, `GET /api/blob`, `POST /api/me/password`).
  Neuer Testfall verifiziert das end-to-end: Schreibversuch vor Wechsel → 403, erlaubte
  Routen weiterhin frei, nach `POST /api/me/password` → wieder voller Zugriff.
- **Fund 2 — Kein Gesamtgrößen-Limit für Uploads, irreführende Fehlermeldung bei
  Überschreitung:** „Eigene Dokumente" hatte nur eine Einzeldatei-Grenze (4 MB), keine
  Summen-Grenze — der Tenant-Blob hätte unbemerkt bis ans/über das 20-MB-Server-Limit
  wachsen können. Bei Überschreitung zeigte `persist()` die falsche Meldung
  „Verschlüsselungsfehler" UND blieb danach dauerhaft defekt (jede künftige Änderung
  scheiterte am selben, nicht behebbaren Grund, getarnt als Krypto-Bug). Fix: neue
  12-MB-Gesamtgrenze für alle Eigenen Dokumente zusammen (`AeDocs.add()` lehnt mit
  klarer Meldung ab, BEVOR überhaupt gespeichert wird), plus ehrliche, spezifische
  Meldung bei einem server-seitigen 413 („Datenbestand zu groß, bitte Dokument löschen")
  statt der generischen Krypto-Fehlermeldung. Per echtem Playwright-Lauf verifiziert
  (13-MB-Dokument korrekt abgelehnt mit der neuen Meldung, normale Dokumente weiterhin
  akzeptiert).
- **Bewusst nicht behoben (dokumentiert, kein Blocker):** Offline-Snapshots
  (`localStorage`) werden bei Logout nicht bereinigt — niedriges Risiko (nur eigene
  Profildaten: Username/Telefon/Rolle, kein Token mehr seit dem früheren Fix), sammelt
  sich auf Dauer auf geteilten Geräten an. Für später vorgemerkt, kein akuter Handlungsbedarf.

Danach `legal-compliance` — Impressum/Datenschutz sind erfreulicherweise bereits
tenant-eigen (jeder Mandant trägt seine eigenen Firmendaten ein, wird dadurch korrekt
selbst Verantwortlicher nach Art. 4 Nr. 7 DSGVO) — aber 2 echte, bisher unadressierte
Lücken gefunden:

- **❌ Datenschutzerklärung §3 war seit dem heutigen Server-Umbau objektiv falsch**
  (behauptete weiterhin „ausschließlich lokale Speicherung … kein serverseitiges
  Backend"). **BEHOBEN:** §3 beschreibt jetzt ehrlich beide Modi (lokal vs. Team-/
  Mandanten-Modus), nennt explizit, dass Dienstplan-Metadaten (Datum/Schichttyp/
  Krankmeldungs-Status/Freitext-Notiz) aus technischen Gründen (serverseitige Hash-
  Verkettung) **unverschlüsselt** auf dem Server liegen — ein Gesundheitsdatum über die
  jeweilige Mitarbeiterin/den Mitarbeiter (Art. 9 Abs. 1 DSGVO), nicht über Klient:innen.
  §5 (Speicherdauer) nennt jetzt ehrlich, dass noch kein automatisierter Lösch-
  Mechanismus für Mandanten/Accounts existiert.
- **⚠️ Noch NICHT behoben, bewusst nicht eigenmächtig entschieden (René-Entscheidung
  nötig):** Kein Auftragsverarbeitungsvertrag (Art. 28 DSGVO) zwischen AERIS (Server-
  Betreiber) und den Mandanten — in der Datenschutzerklärung jetzt als offener Punkt
  benannt, aber ein echter AVV muss als eigenes Rechtsdokument erstellt/abgeschlossen
  werden, das ist kein Code-Fix. **Vor jedem produktiven Einsatz mit einem FREMDEN
  Unternehmen als Mandant zwingend vorher klären.** Ebenso kein echter Lösch-
  Mechanismus für Tenants/Accounts (nur Deaktivieren, keine Löschung) — Art.-17-DSGVO-
  Anfragen laufen bis zur technischen Umsetzung manuell über den Betreiber.
- **⚠️ Nicht abschließend geklärt (Primärquelle unklar, kein bestätigter Fehler):**
  Stichprobe ergab, dass „AWMF S3-LL Invasive Beatmung, Reg.-Nr. 001-021" laut Titel den
  AKUTEN (ICU-)Kontext behandelt, nicht spezifisch die chronische/außerklinische
  Langzeitbeatmung, für die AERIS gebaut ist — mögliche fachliche Fehlzuordnung, aber
  ohne vollständigen Leitlinien-Scope-Abgleich nicht abschließend verifizierbar. Für eine
  künftige, tiefere `pflege-diagnostik`-Prüfung vorgemerkt, nicht in dieser Runde geändert.
  Andere Stichproben (DNQP Chronische Wunden 2. Akt. 2025, DNQP Mundgesundheit 2023)
  bestätigt real und korrekt.

Danach `pflege-diagnostik` — klärte den AWMF-001-021-Verdacht ab und fand eine zweite,
unabhängige Referenz-Lücke. Beide BEHOBEN:

- **Beatmung/Respiratormanagement:** AWMF 001-021 behandelt laut Primärquelle (DGAI,
  V2.0, 2025-08) nur die AKUTE respiratorische Insuffizienz. Eine spezifischere Leitlinie
  für außerklinische Langzeitbeatmung existiert aktuell NICHT (020-008 wurde 2024 bewusst
  auf reine Nichtinvasiv-Beatmung reduziert, der invasive Teil ist noch nicht unter
  eigener Reg.-Nr. veröffentlicht — eine echte Lücke in der Leitlinienlandschaft, nicht
  nur in AERIS). Referenz jetzt ehrlich qualifiziert statt unkommentiert übernommen.
- **Tracheostomapflege/Kanülenwechsel/Cuffdruckkontrolle:** "AWMF S3-LL/DIGAB" existierte
  so nicht — DIGAB hat dazu keine AWMF-registrierte S3-Leitlinie. Echte, zitierfähige
  Quelle gefunden und eingesetzt: DIGAB-Positionspapier „Ambulante Intensivpflege nach
  Tracheotomie", DMW 2017;142:909–911 (9 Jahre alt, kein neueres Update auffindbar —
  im Code-Kommentar ehrlich vermerkt).
- Stichprobe HKP-RL Nr. 3 + DNQP Dekubitusprophylaxe 2. Akt. 2017 bestätigt. QPR-HKP/AKI
  Kriterium 7.25 (PEG) bleibt wie beim Vorbefund nicht sauber verifizierbar (❓, PDF-
  Struktur ließ sich nicht zuverlässig parsen) — offener Punkt für eine künftige, tiefere
  Prüfung. Kein NANDA-Modul vorhanden (kein Fehler, App strukturiert konsequent über
  DNQP/AWMF/HKP-RL statt formaler NANDA-Taxonomie).

Danach `pflege-assessment` — 3 von 4 Instrumenten (RASS, CPOT, BPS, Braden-Struktur)
strukturell korrekt bestätigt, 2 klinisch relevante Funde, beide BEHOBEN:

- **❌ NRS-2002, echter Fehler — Score-Stufe 2/3 vertauscht:** Der Beispieltext
  „Beatmungs-/Intensivpflicht" stand bei Score 2 (mäßig), gehört laut Primärquelle
  (Kondrup et al., Clin Nutr 2003;22(3):321-336, Table S1) aber zu Score 3 (schwer).
  Klinisch relevant, weil genau AERIS' Zielgruppe (beatmungspflichtige außerklinische
  Intensivpflege) dadurch nahe am Cutoff ≥3 systematisch einen Punkt zu niedrig
  eingestuft worden wäre. Score 2 zeigt jetzt „schwere Pneumonie/Schlaganfall/große
  Bauch-OP", Score 3 „Beatmungs-/Intensivpflicht, APACHE>10".
- **⚠️ Braden-Skala, unklare Grenze — vorsorglich auf die sicherere Einstufung
  korrigiert:** Sekundärquellen uneinheitlich zur Grenze „sehr hohes" vs. „hohes"
  Risiko bei exakt 9 Punkten (Originalpublikation nicht direkt einsehbar). Bewusst
  `<=9` statt `<9` gewählt (identischer Fehler an 2 Code-Stellen behoben) — grimmiges
  Framing: im Zweifel die risikobehaftetere Einstufung, nicht die mildere.
- RASS: korrekt (-5 bis +4, korrekte Extrempunkt-Bezeichnungen, sauber von SAS/Ramsay
  abgegrenzt) — kleine, unkritische Lücke: Zwischenstufen (-4 bis -1, +1 bis +3) haben
  im Dropdown nur Zahlen, keine Textbezeichnung. CPOT (0-8, 4 Kategorien) und BPS
  (3-12, 3 Kategorien) beide korrekt und sauber getrennt. Zeiterfassung/Dienstplan
  bestätigt frei von jeder fälschlich deklarierten Assessment-Terminologie.

## Nachtrag 2026-10-09 (9) — Agenten-Prüfkette: 2 echte Funde von accessibility-a11y behoben
> `accessibility-a11y` prüfte die heutigen neuen UI-Elemente (Update-Button, Overlay,
> Meine-Zeiterfassung-Karte, Pflicht-PIN-Screen) gegen WCAG AA — 2 echte Kontrastfehler,
> beide behoben. Eigene Nachprüfung deckte dabei eine UNVOLLSTÄNDIGKEIT im Agenten-
> Vorschlag selbst auf (grimmiges Framing: auch Agentenbefunde werden nicht blind
> übernommen, sondern nachgerechnet).

- **Fund 1 — Bronze-Text (`#B87333`) auf dunklen Karten, 2,98–3,36:1 statt 4,5:1:**
  betraf 4 Stellen in `aeris-server.js` (3× `tel:`-Klick-zum-Anrufen-Links im
  Ausfallmanagement-Overlay, 1× „📄 … öffnen/herunterladen"-Link bei Eigenen Dokumenten).
  Fix: `#B87333` → `#E8C39E` (bereits Teil der Bronze-Palette), ergibt 6,44–9,35:1 gegen
  alle drei `.ae-card`-Gradient-Stopps — PASS.
- **Fund 2 — Update-Button-Icon/-Text auf dem 7-Stopp-Bronze-Verlauf, 2,04:1 am
  dunkelsten Stopp (`#6B4423`):** Agent schlug `#FFFFFF`-Text vor. Eigene Nachrechnung
  (alle 7 Stopps, nicht nur den gemeldeten) ergab: `#FFFFFF` behebt zwar `#6B4423`
  (8,48:1), reißt aber NEU `#E8C39E` auf nur 1,65:1 — der Agentenvorschlag war
  unvollständig, hätte nur das Problem verschoben statt gelöst. Strukturbefund: Bei
  diesem speziellen 3-Farben-Verlauf (dunkel→hell→dunkel…) besteht KEINE einzelne
  Flächenfarbe an allen Stopps gleichzeitig 4,5:1 — weder Dunkel noch Weiß. Fix:
  Original-Textfarbe `#131B27` (konsistent mit den übrigen Bronze-Buttons der App, z. B.
  „Setzen") beibehalten, zusätzlich heller Halo (`text-shadow:0 0 3px #fff,0 0 3px
  #fff,0 0 5px #fff`) ergänzt — sichert exakt den einen schwachen Stopp ab, ohne die
  Verlaufsfarben selbst neu zu gestalten (keine eigenmächtige Design-Entscheidung,
  reine Lesbarkeits-Absicherung). Per echtem Screenshot (Playwright, Gate deaktiviert)
  visuell bestätigt: Glyph/Text an jeder Stelle des Verlaufs klar lesbar.
- **Alle übrigen Prüfpunkte PASS** (grau-inaktiver Update-Button 4,81:1, Overlay-Text,
  Zeiterfassungs-Tabelle, Branding-Hinweistexte, „Löschen"-Link `#E88C7D` 4,56:1
  grenzwertig-PASS, Pflicht-PIN-Screen nutzt bestehende gesealte Klassen, 44×44px
  Touch-Targets PASS).
- Deploy: Version `2026-10-09-023`. `node --check` beider Dateien sauber. Keine
  Testdaten-Verschmutzung (lokaler PIN-Modus nutzt nur Browser-localStorage).

## Nachtrag 2026-10-09 (10) — Agenten-Prüfkette: 1 echter Fund von business-finance behoben
> `business-finance` prüfte Pricing-Konsistenz, Buchhaltungslogik, Abtretungserklärung,
> Payment-Bridge, Steuerberater-Zugang.

- **❌ ECHTER FUND, BEHOBEN — SKR-Kontenfehler lebte in einer zweiten, unabhängigen
  Code-Kopie weiter:** Der am 2026-10-02 von `legal-compliance` gefundene und laut
  `_MAINTENANCE-MANIFEST.md` „4/4 ✅ bestätigt" behobene SKR-Kontenfehler (8190/4180 statt
  korrekt 8400/4400 für Privatleistungen; 4670/6670 statt korrekt 4660/6650 für
  Reisekosten) wurde ausschließlich in `buchhaltung/app.js` gefixt. Die root-`app.js`
  hat eine ZWEITE, unabhängige CSV-Export-Funktion („Export für Steuerberater" auf der
  AERIS-Doku-Seite, `app.js:4495-4496`) mit identischer Kontenlogik, die beim damaligen
  Fix übersehen wurde — der Gegenprüf-Abschluss war demnach unvollständig (zwei
  Code-Kopien, nur eine geprüft). Jetzt auf dieselben korrekten Werte wie
  `buchhaltung/app.js:39-40` gezogen: Privatleistungen 8400/4400, Fahrtkosten 4660/6650.
  Grep über das gesamte Repo bestätigt: keine weiteren Vorkommen der falschen Werte.
- **⚠️ Nicht behoben, bewusst nicht eigenmächtig entschieden:**
  - `buchhaltung/app.js:934` — Rentenziel-Demo-Default (6.000 €/Monat) weicht vom in
    dieser Datei dokumentierten SEALED-Zielwert (≈7.130,81 €) ab. Laut CLAUDE.md
    selbst „noch keine Umsetzung in Code begonnen" — kein Bug, aber ein veralteter
    Platzhalter, der bei flüchtigem Blick für den echten Zielwert gehalten werden könnte.
  - Keine Stripe-/Payment-Bridge in diesem Silo vorhanden (bestätigt per Repo-weitem
    Grep) — sachlich unproblematisch (kein Abo-Produkt, keine täuschenden Kauf-CTAs),
    aber anders als bei careinsight nirgends explizit als „kein Payment-Layer" vermerkt.
  - Die Abtretungserklärung (`dokumente/abtretungserklaerung-zahlungsfluss.html`) ist
    reines Rechtsdokument ohne jede Code-Kopplung — es gibt keine technische Prüfung,
    ob eine Abtretung vorliegt, bevor eine Rechnung an den Kostenträger statt an den
    Klienten adressiert wird. Kein Widerspruch, aber auch keine Durchsetzung im Code.
  - Steuerberater-Export geprüft und sauber getrennt bestätigt: keine Klienten-/
    Pflegedaten enthalten, nur GmbH-/Finanzdaten.
- Deploy: Version `2026-10-09-024`. `node --check app.js` sauber.

## Nachtrag 2026-10-09 (11) — Agenten-Prüfkette: 1 Fund von brand-marketing behoben, 1 echte Markenfrage an René
> `brand-marketing` prüfte Logo/Name-Konsistenz, Design-Tokens, Tonalität, Rechtsform-
> Stand gegen die Root-CLAUDE.md als GLOBAL_SOURCE_OF_TRUTH.

- **✅ BEHOBEN — Theme-Color-Abweichung zwischen den zwei AERIS-PWAs:**
  `buchhaltung/manifest.json` setzte `theme_color: "#131B27"` (identisch mit
  `background_color`) statt des dokumentierten `AERIS_THEME`-Tokens `#2B4570` — AERIS
  Doku (`manifest.json`) hatte den korrekten Wert, AERIS Buch nicht. Jetzt angeglichen.
  Reiner Technik-Fix, keine Design-Entscheidung (Korrektur gegen bereits gesealten Token).
- **⚠️ ECHTE MARKENFRAGE, BEWUSST NICHT EIGENMÄCHTIG ENTSCHIEDEN — fehlende
  IRIS-Digital-Fußzeilen-Attribution:** Laut globaler Logo-Governance (Root-`CLAUDE.md`
  § Logo-Governance) muss jedes IRIS-Digital-Produkt im Footer „IRIS Digital ist Inhaber
  und Entwickler von …" führen (Referenzimplementierung: careinsight-Footer). In
  `index.html`/`app.js`/`buchhaltung/*` kommt „IRIS Digital" KEIN einziges Mal vor (0
  Treffer, repo-weit geprüft). Grund, warum das NICHT einfach ergänzt wurde: Diese
  CLAUDE.md selbst dokumentiert die Eigentumslage als „bislang nicht explizit geklärt"
  (verwandt mit „Offene Entscheidungen an René" Punkt 2 unten — GitHub-Org-Eigentum —,
  jetzt durch das Holding-Konstrukt vom 2026-10-09 noch relevanter — AERIS wird eigene
  3-stufige GmbH-Holding, evtl. kein reines „IRIS-Digital-Produkt" im bisherigen Sinn
  mehr, neuer Punkt 3 unten ergänzt). Ob die Logo-Governance-Pflicht
  hier überhaupt noch gilt, kann ich nicht beurteilen, ohne die Eigentumsfrage selbst zu
  entscheiden — **René-Entscheidung nötig, bevor diese Fußzeile ergänzt oder bewusst
  weggelassen wird.**
- **Geprüft und OK (keine Änderung nötig):** Markenname „AERIS" repo-weit korrekt
  geschrieben; Bronze-Gradient/Card-Gradient/Background-Token 1:1 korrekt verwendet;
  Tonalität durchgängig professionell, keine Stilbrüche; `changelog.json` sachlich
  neutral; historische „Einzelunternehmen"-Reste korrekt als historisch gekennzeichnet.
- Deploy: Version `2026-10-09-025`. JSON-Syntax von `buchhaltung/manifest.json` geprüft.

## Nachtrag 2026-10-09 (12) — Agenten-Prüfkette: 3 echte Funde von devops-infra behoben, 1 offen
> `devops-infra` prüfte Versionierung, `server/server.js`/`db.js`-Robustheit, systemd-
> Konfiguration, `sw.js`, Electron-Build, `.gitignore`.

- **✅ BEHOBEN — `NODE_ENV=production` fehlte:** `server/aeris-server.service` setzte
  nur `PORT`, kein `NODE_ENV` — Express lief im impliziten Development-Modus. Jetzt
  ergänzt. **Wichtiger Nebenfund beim Deployen:** die auf dem vServer tatsächlich
  wirksame Unit-Datei liegt unter `/etc/systemd/system/aeris-server.service`, NICHT im
  rsync-Zielordner `/opt/aeris-server/` — der bisherige Ad-hoc-Deploy-Weg hatte Service-
  File-Änderungen nie übertragen. Per `systemctl show -p Environment` live bestätigt.
- **✅ BEHOBEN — kein globaler Error-Handler/Graceful Shutdown in `server/server.js`:**
  Ungefangene Fehler hätten kein einheitliches JSON-Fehlerformat geliefert, ein
  `systemctl restart`/`stop` beendete den Prozess bisher hart statt die SQLite-
  Verbindung sauber zu schließen. Jetzt: globale Error-Middleware (einheitliches
  `{error: 'Interner Serverfehler.'}`), `SIGTERM`/`SIGINT`-Handler schließt Server+DB
  geordnet. Per echtem `systemctl restart`-Log verifiziert: „SIGTERM empfangen, fahre
  geordnet herunter" erscheint zuverlässig vor jedem Neustart.
- **✅ BEHOBEN — kein dokumentierter/skriptierter Deploy-Weg für `server/`:** Der
  bisherige rsync-Befehl existierte nur als Chat-/Sitzungswissen, nirgends im Repo.
  Neues `server/deploy.sh` (rsync + **jetzt auch scp der `.service`-Datei** nach
  `/etc/systemd/system/` + `chown`+`daemon-reload`+`restart`+Status-Check). Echt
  gegen den Live-Server getestet, Service lief danach sauber (`active`).
- **❌ Eskalation an René — GESCHLOSSEN 2026-10-09, René-Korrektur:** Fehlendes
  macOS-Code-Signing/Notarization im Electron-Build wurde ursprünglich als Blocker
  eskaliert. René-Einwand zurecht: AERIS ist primär eine PWA, der Electron-Wrapper
  dient nur Renés eigenem Mac (dort bereits per `xattr -dr com.apple.quarantine`
  gelöst) — kein Apple-Developer-Account nötig, solange die `.dmg` nicht an fremde
  Nutzer:innen verteilt wird. Details: § „Offene Entscheidungen an René" Punkt 4.
- **⚠️ Zusätzlicher, von mir selbst gefundener Nebenbefund (nicht Teil des
  Agentenauftrags):** Lokales `npm test` schlägt aktuell fehl — der lokale Mac läuft
  inzwischen Node v26.4.0 (seit der letzten Session automatisch aktualisiert), gegen das
  sich `better-sqlite3` (gepinnt auf v11.10.0) nicht mehr kompilieren lässt
  (`NODE_MODULE_VERSION`-Mismatch, `npm rebuild` schlägt mit V8-API-Deprecation-Fehlern
  fehl). Der Produktivserver läuft unbetroffen mit Node v22.23.3 — nur die LOKALE
  Testsuite ist betroffen. Nicht behoben (Node-Downgrade oder better-sqlite3-Upgrade ist
  eine Umgebungsentscheidung, keine Code-Änderung) — vor dem nächsten `npm test`-Lauf
  zu klären.
- **Offene René-Punkte aus dem Audit (keine Bugs, Entscheidungen):** CORS-Policy ohne
  Origin-Whitelist, keine journald-Log-Rotation konfiguriert — vor Produktivbetrieb mit
  fremden Mandanten zu klären.
- **Geprüft und OK:** Versionierung (`sw.js`/`index.html`/`app.js`) zum Zeitpunkt des
  Audits synchron; systemd-Service läuft bereits korrekt als `www-data`, nicht root.

## Nachtrag 2026-10-09 (13) — Agenten-Prüfkette: 2 echte Prozessverstöße von quality-management gefunden, beide behoben
> `quality-management` prüfte NICHT Code, sondern den Governance-PROZESS der
> heutigen 9-Agenten-Kette selbst — Verdikt: „Prozess mit Mängeln". 2 echte Funde:

- **✅ BEHOBEN — `_MAINTENANCE-MANIFEST.md` (Root) nie aktualisiert:** Trotz
  kompletten Server-Umbaus + 9 Agentenläufen stand dort seit 2026-10-04 kein einziger
  neuer Eintrag — Root-`CLAUDE.md` verlangt „Kein SUCCESS ohne … im Manifest
  protokolliert". Jetzt nachgeholt (neuer Eintrag `2026-10-09`, verweist auf diese
  Datei für Details statt Volltext zu duplizieren).
- **✅ BEHOBEN — „Real-Device-Test (iPhone) mit René" stillschweigend aus der
  offenen-Punkte-Liste gefallen:** War in Nachtrag (3)/(4)/(7) als offener Punkt
  geführt, verschwand danach ohne Erledigungs-Nachweis. Als Punkt 5 in „Offene
  Entscheidungen an René" wiederhergestellt — die komplette Multi-User-Architektur
  wurde bislang ausschließlich per Playwright/Browser verifiziert, nie auf einem
  echten Gerät.
- **⚠️ Fragwürdig/unklar, kein bestätigter Verstoß:** Ob vor dem Bau des
  Server-Backends (Komplexität klar >6) ein Score gezeigt und explizite René-
  Freigabe eingeholt wurde, ist aus der Doku selbst nicht rekonstruierbar (kein
  Transkript-Zugriff für den Agenten) — René selbst hatte laut Session-Historie die
  Architekturentscheidung „Server-Backend statt nur lokaler Profile" aber aktiv per
  `AskUserQuestion` mitentschieden, s. `handoff.md` Zeile 8-10.
- **Geprüft und OK:** Vier-Augen-Prinzip eingehalten (9 unabhängige Fachagenten mit
  echten eigenen Funden), keine parallelen Agenten-Starts (Commit-Zeitstempel streng
  monoton), kein blinder Retry, GLOBAL_SOURCE_OF_TRUTH_MANDATE bei der Markenfrage
  korrekt eingehalten (an René eskaliert statt geraten), Silo-Isolation gewahrt.
- **Wichtige Lektion (von quality-management selbst benannt):** Der am 2026-10-02
  als „4/4 ✅ bestätigt" protokollierte SKR-Konten-Fix war trotzdem unvollständig
  (zweite Code-Kopie übersehen, s. Nachtrag 10) — frühere „geschlossen"-Vermerke sind
  nicht automatisch verlässlich. Für künftige Gegenprüfungen vermerkt: explizit nach
  mehrfachen Code-Kopien derselben Logik suchen, nicht nur die bekannte Stelle prüfen.

## Nachtrag 2026-10-09 (14) — Agenten-Prüfkette 11/11 (letzte Instanz): product-acceptance — SUCCESS MIT VORBEHALTEN
> `product-acceptance` durchlief als neue Nutzerin eigenständig per Playwright die
> Kernflüsse gegen den Live-Server (PIN-Ersteinrichtung, Dokumentation anlegen,
> Design-Stimmigkeit über 7 Screens, Update-Button, AERIS Doku↔Buch-Navigation).
> **Verdikt: SUCCESS MIT VORBEHALTEN — kein Blocker, 3 echte Punkte.**

- **✅ VERIFIZIERT, ECHTER UND BISHER UNENTDECKTER FUND — Service Worker registriert
  sich faktisch NIE, auf keinem echten Gerät:** `index.html:2958` registriert `sw.js`
  normal, aber Chromium (und jeder andere moderne Browser) verweigert Service-Worker-
  Registrierung bei einem selbstsignierten Zertifikat — unabhängig von Testkonfiguration,
  das ist eine Browser-Sicherheitsregel ohne Ausnahme außer „localhost". Per eigenem
  Playwright-Lauf bestätigt: Konsolenfehler „An SSL certificate error occurred when
  fetching the script." bei JEDEM Seitenaufruf, `navigator.serviceWorker.getRegistrations()`
  liefert leer. **Korrigiert eine falsche Aussage aus Nachtrag (8)/testing-qa („0
  Konsolenfehler")** — der Fehler ist durch den `.catch()` in `index.html:2958` abgefangen
  und bricht die App nicht (App funktioniert normal weiter), aber die GESAMTE
  `sw.js`-Logik (Offline-Caching, Versionskontrolle über den Service Worker) läuft auf
  dem aktuellen Deployment bei NIEMANDEM — nicht nur im Test. **Kein Code-Fix möglich:**
  braucht ein echtes, von der CA vertrautes Zertifikat (z. B. Let's Encrypt), was
  wiederum eine öffentliche Domain statt der aktuellen privaten IP+Basic-Auth-Lösung
  voraussetzt — reine Infrastruktur-/Deployment-Entscheidung, René-Entscheidung nötig.
- **⚠️ Geprüft, bewusst NICHT geändert — „Meine Zeiterfassung" fehlt im lokalen
  PIN-Modus:** René-Direktive „setzte das mit in die Sidebar bei Dienstplanung" wurde
  technisch nur im Server-/Team-Modus umgesetzt (`index.html:1702-1731`,
  `aeris-server.js:506-611`), nicht im lokalen Einzelplatz-Modus. Sachlich begründet
  (das Mehrpersonen-Stempel-Problem, das die Funktion lösen sollte, existiert im
  lokalen Einzelplatz-Modus gar nicht — dort ist `tag.von`/`tag.bis` bereits die
  einzige, unzweideutige Zeiterfassung), aber eine wortgetreue Abweichung vom Auftrag.
  Nicht eigenmächtig geändert — falls René das auch im lokalen Modus sichtbar haben
  will (rein informativ, kein Mehrpersonen-Fall), bitte explizit sagen.
- **⚠️ Geprüft, bewusst NICHT geändert — „AERIS Buch"-Link-Icon vs. Verhalten:**
  `index.html:220` zeigt ein Extern-Icon (`ui-i-ext`) neben dem AERIS-Buch-Link, navigiert
  aber im selben Tab (nicht `target="_blank"`). Vertretbar als „du verlässt diesen
  App-Bereich" statt strikt „neuer Tab" (AERIS Buch ist architektonisch eine eigene
  zweite PWA) — kein eindeutiger Bug, eher eine Design-Nuance. Nicht eigenmächtig
  geändert (Design-Entscheidung, keine klare Fehlkorrektur).
- **Bestätigt stimmig:** Alle 6 heutigen René-Direktiven (Nachtrag 5-13) live
  wiedergefunden, keine doppelten/redundanten Navigationswege, PIN→Dashboard→
  Dokumentation-anlegen→Speichern End-to-End fehlerfrei, Design über 7 Screens
  durchgängig konsistent, Update-Button exakt spezifiziert.

## Nachtrag 2026-10-09 (15) — Offen/Korrektur-Potenzial-Aufarbeitung: Apple-Dev-Account-Korrektur + Icon-Fix
- **René-Korrektur bestätigt und übernommen:** Apple-Developer-Account-Eskalation aus
  Nachtrag (12) war überzogen — s. § „Offene Entscheidungen" Punkt 4, jetzt geschlossen.
- **✅ BEHOBEN — AERIS-Buch-Link-Icon (`product-acceptance`-Fund, Nachtrag 14):** Das
  Extern-Icon (`#ui-i-ext`, `index.html:208`, 2 Verwendungsstellen: Sidebar-Link +
  Dashboard-Hinweiskarte) versprach optisch „öffnet neuen Tab/extern", navigiert aber
  im selben Tab. Symbol auf einen neutralen Rechts-Chevron geändert (passt zum
  tatsächlichen Verhalten „navigiert innerhalb der Suite weiter"), Navigation selbst
  unverändert belassen (kein `target="_blank"`, da der bestehende Rückweg bereits
  funktioniert und ein neuer Tab unnötige PIN-Doppelabfrage riskieren würde).
- Deploy: Version `2026-10-09-026`.

## Nachtrag 2026-10-10 (1) — BTM-Nachweisbuch als eigenständiges digitales Modul (René-Auftrag, Score 9/10, Claude direkt)
> René-Direktive: BTM-Nachweisbuch, ICW®-Wunddokumentation und Medizinproduktebuch waren
> laut bestehendem Disclaimer (`app.js`, MD-Kompendium-Fußzeile) noch nicht als eigene
> digitale Module umgesetzt — Auftrag, das nachzuholen. Begonnen mit dem regulatorisch
> strengsten der drei: BTM-Nachweisbuch (lückenlose Bestandsführung zwingend).

- **Primärquelle verifiziert:** § 13 BtMVV (gesetze-im-internet.de/btmvv_1998/__13.html)
  — Nachweispflicht „unverzüglich nach Bestandsänderung nach amtlichem Formblatt",
  3 Jahre Aufbewahrung ab letzter Eintragung, elektronische Dokumentation zulässig sofern
  jederzeit in der Reihenfolge des amtlichen Formblatts ausdruckbar. § 14 BtMVV —
  Pflichtangaben: Bezeichnung, Datum, Menge (Zugang/Abgang/Bestand), Name Lieferant
  (bei Zugang)/Empfänger (bei Abgang). **Ehrlich ausgewiesen:** Das amtliche BfArM-
  Formblatt selbst liegt nicht maschinenlesbar öffentlich vor (Bekanntmachung im
  Bundesanzeiger) — die Umsetzung deckt die SUBSTANZIELLEN Pflichtangaben vollständig
  ab, erhebt aber keinen Anspruch auf bit-identische Formblatt-Nachbildung (in der
  UI selbst so benannt, nicht stillschweigend verkauft).
- **Umsetzung (`app.js`/`index.html`):** Neue Sektion `#btm` (Sidebar → Prüfung →
  BTM-Nachweisbuch). Datenmodell `AE.btm = {praeparate:[], eintraege:[]}` mit
  Migrations-Eintrag. Präparate-Verwaltung (Bezeichnung/Wirkstoff/Stärke/
  Darreichungsform) + automatische Bestandsberechnung je Präparat. Eintrag-Formular
  mit Typ Zugang/Abgang/Vernichtung, kontextabhängigen Pflichtfeldern (Verordner+
  Rezept-Nr. nur bei Zugang, Zeuge/Zweitunterschrift nur bei Vernichtung — Letzteres
  klar als „gängige Praxis, nicht explizit § 13/14 BtMVV-Pflicht" ausgewiesen, um keine
  erfundene Rechtspflicht zu suggerieren).
- **Manipulationssicherheit:** Gleiche hash-verkettete Append-only-Technik wie das
  bestehende MD-Archiv (`aeMdArchivNachfuehren`/`aeMdKettePruefen`), hier pro EINTRAG
  statt pro Tag (da § 13 „unverzüglich" verlangt). „Kette auf Manipulation prüfen"-
  Button + Druckansicht (bestehende `.ae-no-print`-Technik wiederverwendet).
- **Verifikation (echter Playwright-Lauf gegen den Live-Server, lokaler PIN-Modus):**
  Präparat angelegt → in Auswahl sichtbar. Zugang 100 ml + Abgang 5 ml gebucht →
  Bestand korrekt 95,00. Kettenprüfung bestätigt Integrität. Typ-Umschaltung
  (Zugang/Abgang/Vernichtung) schaltet Verordner-/Zeuge-Felder korrekt um (3/3
  Zustände bestätigt). Keine neuen Konsolenfehler (einziger Fehler: der bereits
  dokumentierte SSL/Service-Worker-Zertifikatsfehler aus Nachtrag 14, unverändert).
- **Bug während der Umsetzung gefunden+behoben:** Eintrag-Formular-Handler referenzierte
  `showNote` aus einem fremden, nicht erreichbaren Funktions-Scope (hätte bei fehlendem
  Präparat einen `ReferenceError` statt einer Nutzermeldung geworfen) — vor dem ersten
  Test durch Code-Review selbst gefunden, auf `alert()` korrigiert.
- Disclaimer in der MD-Kompendium-Fußzeile aktualisiert: BTM-Nachweisbuch aus der
  „noch nicht umgesetzt"-Liste entfernt, die beiden anderen (ICW-Wunddokumentation,
  Medizinproduktebuch) bleiben als offen stehen — folgen in dieser Reihenfolge.
- Deploy: Version `2026-10-10-001`.
- **Offen:** Kein Fachagenten-Review dieses neuen Moduls (`legal-compliance` für die
  BtMVV-Primärquellentreue, `security-privacy` für die Hash-Ketten-Integrität) — noch
  nicht angefordert, da Komplexitäts-Gate Agent-Einsatz nur nach expliziter
  Einzelfreigabe erlaubt. Vor Praxiseinsatz mit echten BTM-Daten empfohlen.

## Nachtrag 2026-10-10 (2) — Medizinproduktebuch als eigenständiges digitales Modul (2/3, Claude direkt)
> Zweites der drei fehlenden Module. Dabei einen echten, mehrfachen Primärquellen-Fehler
> in der BEREITS BESTEHENDEN statischen Vorlage-Datei gefunden und korrigiert.

- **Primärquelle verifiziert (gesetze-im-internet.de/mpbetreibv_2025):** § 14 Abs. 2
  (Bestandsverzeichnis: Bezeichnung/Art-Typ/Los-Seriennr./Anschaffungsjahr/Hersteller-
  Name+Anschrift/betriebl. ID/Standort), § 13 Abs. 1+2 (Medizinproduktebuch: Funktions-
  prüfung+Einweisung nach § 11, Fristen/Ergebnis STK/MTK, Instandhaltung, Funktions-
  störungen), § 12 Abs. 1 (STK spätestens alle 2 Jahre), § 15 Abs. 5 + Anlage 2
  (MTK-Fristen 1–6 Jahre je Produkttyp, nicht pauschal), § 4 Abs. 3/5 + § 11 Abs. 1-2
  (Einweisungspflicht), § 4 Abs. 7 (Gebrauchsanweisung griffbereit), § 2 Abs. 2/§ 3
  Abs. 1 (Betreiber-Verantwortlichkeit).
- **❌ ECHTER FUND, BEHOBEN — bestehende statische Vorlage
  (`dokumente/medizinproduktebuch-vorlage.html`) zitierte DURCHGÄNGIG falsche
  Paragraphen**, offenbar gegen eine ältere, inzwischen umnummerierte MPBetreibV-
  Fassung geschrieben: „§ 12" für das Medizinproduktebuch selbst (richtig: § 13),
  „§ 5" für den Verantwortlichen (richtig: § 2 Abs. 2/§ 3 Abs. 1), „§ 4 & § 10" für
  die Einweisung (richtig: § 4 Abs. 3/5 & § 11), „§ 11" für STK (richtig: § 12),
  „§ 14" für MTK (richtig: § 15 — § 14 ist tatsächlich das Bestandsverzeichnis),
  „24 Monate" als pauschale MTK-Frist (laut Anlage 2 tatsächlich 1–6 Jahre je
  Produkttyp, keine feste Zahl), „§ 12 Abs. 1" für die Gebrauchsanweisungs-Pflicht
  (richtig: § 4 Abs. 7). Alle 6 Stellen korrigiert, `app.js`-Katalogeintrag (Zeile
  ~3622) ebenfalls auf § 13 korrigiert und auf das neue interaktive Modul verweisend
  ergänzt.
- **Umsetzung:** Neue Sektion `#medizinprodukte` (Sidebar → Prüfung →
  Medizinproduktebuch). Datenmodell `AE.medizinprodukte = {geraete:[], eintraege:[]}`.
  Bestandsverzeichnis-Verwaltung + Eintrag-Formular mit 5 Typen (Funktionsprüfung/
  Einweisung, STK, MTK, Instandhaltung, Funktionsstörung), dynamische Feld-Labels je
  Typ (analog BTM-Modul). **Zusatzfunktion über die reine Gesetzespflicht hinaus:**
  automatische Fälligkeits-Ampel je Gerät (⚠ überfällig / ✓ aktuell / — unbekannt),
  berechnet aus dem jeweils LETZTEN STK-/MTK-Eintrag (ein überholter alter Termin
  zählt nicht fälschlich als aktuell fällig, wenn es inzwischen eine neuere Prüfung
  gab). Gleiche hash-verkettete Nachweis-Kette wie BTM-Modul/MD-Archiv.
- **Verifikation (echter Playwright-Lauf gegen den Live-Server, lokaler PIN-Modus):**
  Gerät angelegt → Status korrekt „unbekannt" ohne STK-Eintrag. STK mit
  Fälligkeitsdatum in der Vergangenheit gebucht → Status korrekt auf „überfällig"
  umgeschlagen. Funktionsstörung mit Folgen-Feld gebucht → korrekt in der
  Nachweis-Kette sichtbar. Kettenprüfung bestätigt Integrität. Keine neuen
  Konsolenfehler.
- Deploy: Version `2026-10-10-002`.
- **Offen:** Kein Fachagenten-Review (`legal-compliance` für die MPBetreibV-Treue)
  — noch nicht angefordert, Komplexitäts-Gate. Vor Praxiseinsatz empfohlen.

## Nachtrag 2026-10-10 (3) — ICW-Wunddokumentation als eigenständiges digitales Modul (3/3, alle drei Module fertig)
> Letztes der drei René-beauftragten Module. Primärquelle: ICW (Initiative Chronische
> Wunden e.V.), „Diagnostik und Therapie chronischer Wunden — Standards der ICW",
> Stand 01/2026 (icwunden.de/wundwissen/standards-definitionen), per MarkItDown-
> Volltext ausgewertet (PDF, 115.933 Zeichen konvertiert, gezielt nach den relevanten
> Begriffen durchsucht statt komplett gelesen, Token-Disziplin).

- **Primärquellen-Befund, ehrlich eingeordnet:** Die ICW-Quelle ist primär ein
  **Terminologie-/Standardisierungsglossar** (einheitliche Fachbegriffe, inkl. einer
  expliziten Liste „Begriffe, die nicht mehr verwendet werden sollten" vs. „Begriffe,
  die zukünftig verwendet werden sollten"), **kein starres Scoring-Schema** mit festen
  Prozent-/Mengenkategorien. Verifiziert übernommen: Wundrand = „schmaler Bereich
  (Grenze) zwischen Wundfläche und Wundumgebung", Wundgrund/Wundbelag/Wundoberfläche
  als drei GETRENNTE Begriffe (nicht wie in der bestehenden TIME-Sektion vereinfacht
  zusammengefasst), Erosion (oberflächlich, bis Epidermis) vs. Ulcus (bis in
  Dermis/Unterhaut) als unterschiedliche Wundarten, „Nekrose" statt „Gangrän" (ICW:
  Gangrän bezeichnet abgestorbene KÖRPERTEILE, nicht Wundgewebe), „Hypergranulation"
  statt „Wildes Fleisch"/„Caro luxurians", Mazeration/Erythem/Wundexsudat-Definitionen.
  **Ehrlich NICHT als ICW-Zitat ausgegeben:** Auswahloptionen wie Exsudatmenge
  „gering/mäßig/stark" — das ist gängige Wundpraxis, keine wörtliche ICW-Kategorie
  (in der UI per Hinweistext „gängige Praxis" von den ICW-verifizierten Feldern
  unterschieden). Keine Dekubitus-Grading-Skala erfunden (NPUAP/EPUAP wäre ein
  separater, nicht recherchierter Standard) — Wundart bleibt bewusst Freitext.
- **Eigenständig ggü. der bestehenden TIME-Sektion (Abschnitt 10 im Tages-Assessment,
  Schultz et al. 2003):** Die TIME-Sektion bleibt unverändert (eigener Zweck:
  Tagesmomentaufnahme im normalen Assessment-Bogen). Das neue Modul ist ein
  **Wund-REGISTER** — mehrere benannte, gleichzeitig verfolgte Wunden je Klient
  (z. B. Dekubitus sacral UND Trachealkanülenwundrand parallel), jede mit
  chronologischem Verlauf statt nur einer Momentaufnahme, wodurch Heilungstendenz
  über Zeit sichtbar wird (bei der TIME-Einzelerfassung nicht möglich).
- **Umsetzung:** Neue Sektion `#wunden` (Sidebar → Prüfung → ICW-Wunddokumentation).
  Datenmodell `AE.wunden = {wunden:[], eintraege:[]}`. Wunde-Stammdaten (Bezeichnung/
  Wundart/Lokalisation) + Verlaufs-Eintrag (Maße L×B×T/Unterminierung/Wundgrund/
  Wundbelag/Wundrand/Wundumgebung/Mazeration/Erythem/Exsudat/Geruch/Infektionszeichen
  Calor-Rubor-Tumor-Dolor-Functio laesa/Schmerz NRS/Fotovermerk/Verbandsmaterial).
  Gleiche hash-verkettete Nachweis-Kette wie BTM-/Medizinproduktebuch-Modul.
- **Verifikation (echter Playwright-Lauf gegen den Live-Server, lokaler PIN-Modus):**
  Wunde angelegt → sichtbar mit Wundart. Zwei chronologische Einträge gebucht
  (Nekrose/stark-Exsudat → Granulationsgewebe/gering-Exsudat, Maße rückläufig
  4,5×3,2×0,8 → 3,8×2,6×0,5) → Übersicht zeigt korrekt den LETZTEN Stand, Verlaufs-
  Tabelle zeigt BEIDE Einträge (Heilungstendenz nachvollziehbar). Kettenprüfung
  bestätigt Integrität. Keine neuen Konsolenfehler.
- Disclaimer final aktualisiert: alle drei ursprünglich fehlenden Module (BTM-
  Nachweisbuch, Medizinproduktebuch, ICW-Wunddokumentation) jetzt als „seit
  2026-10-10 verfügbar" vermerkt, keine „noch nicht umgesetzt"-Hinweise mehr offen.
- Deploy: Version `2026-10-10-003`.
- **Offen (für alle drei neuen Module gemeinsam):** Kein Fachagenten-Review
  (`legal-compliance` für BtMVV-/MPBetreibV-Primärquellentreue, `pflege-diagnostik`
  für die ICW-Terminologie-Treue, `security-privacy` für die Hash-Ketten-Integrität
  aller drei Module) — noch nicht angefordert, Komplexitäts-Gate verlangt explizite
  Einzelfreigabe. Dringend empfohlen vor jedem Praxiseinsatz mit echten Klienten-/
  BTM-/Geräte-/Wunddaten.

## Offene Entscheidungen (an René)
1. Soll `aeris-web` (Landingpage) ebenfalls importiert und demselben Silo zugeordnet werden?
2. Eigentumsklärung ggü. GitHub-Org (`Renekrieg1401` persönlich vs. `YNA-Digital`)?
3. Gilt die globale Logo-Governance-Pflicht (IRIS Digital im Footer, s. Root-CLAUDE.md
   § Logo-Governance) für AERIS noch, nachdem AERIS als eigene 3-stufige GmbH-Holding
   gesealt wurde (s. u.), oder ist AERIS markenrechtlich eigenständig? Aktuell fehlt
   jede „IRIS Digital"-Erwähnung im AERIS-Code (0 Treffer, `brand-marketing`-Fund
   2026-10-09) — weder ergänzt noch bewusst als „entfällt" entschieden.
4. ~~Apple-Developer-Account für macOS-Code-Signing~~ — **GESCHLOSSEN, 2026-10-09,
   René-Korrektur:** Der ursprüngliche `devops-infra`-Fund hatte die Notwendigkeit
   überzogen. Gatekeeper prüft zwar jedes `.app`-Bundle unabhängig davon, ob innen
   Web-Content (Electron) oder echter nativer Code läuft — aber das betrifft nur die
   Verteilung an FREMDE Macs. AERIS ist primär eine PWA (Browser-URL, kein Install
   nötig für andere Nutzer:innen/Mandanten); der Electron-Desktop-Wrapper existiert
   ausschließlich für Renés eigenen Mac, wo die Quarantäne-Sperre bereits zuverlässig
   per `xattr -dr com.apple.quarantine` umgangen wird (bestehendes, funktionierendes
   Verfahren bei jedem Reinstall). Kein Apple-Developer-Account nötig, solange die
   `.dmg` nie an fremde Nutzer:innen auf deren eigenen Macs verteilt wird.
5. **Real-Device-Test (iPhone) mit René** — ursprünglich in Nachtrag (3)/(4)/(7) als
   offener Punkt geführt, dann OHNE Erledigungs-Nachweis aus der laufenden Liste
   gefallen (`quality-management`-Fund 2026-10-09, s. Nachtrag 13). Hiermit als
   weiterhin offen wiederhergestellt — die gesamte heutige Multi-User-/
   Mandanten-Architektur wurde bislang nur per Playwright/Browser verifiziert, nie auf
   einem echten Gerät mit René als erstem Admin-Account vor Ort getestet.
6. **Echtes CA-Zertifikat statt selbstsigniert** (`product-acceptance`-Fund
   2026-10-09, Nachtrag 14) — ohne ein von der CA vertrautes Zertifikat (z. B. Let's
   Encrypt, braucht eine öffentliche Domain statt der aktuellen privaten IP) läuft der
   Service Worker (`sw.js`) bei KEINEM echten Besucher, egal auf welchem Gerät —
   Browser verweigern SW-Registrierung bei selbstsignierten Zertifikaten ausnahmslos.
   App funktioniert trotzdem normal weiter (Fehler ist abgefangen), aber Offline-
   Caching/die komplette sw.js-Versionslogik ist faktisch wirkungslos, solange das
   nicht geklärt ist.

## Offizielles Geschäftsmodell — Holding-Konstrukt (René-Direktive 2026-10-09, SEALED)
> Nach Sichtung von 37 PDF-Dokumenten aus 3 AirDrop-Ordnern (`~/Downloads/{Aeris holding,
> GmbH Gründung, Fachliche Dokumentation Vorschriften}`, Volltext gelesen nicht nur
> Dateinamen) legte René die widersprüchlichen Entwürfe verbindlich fest. Diese Fassung
> ersetzt alle älteren, abweichenden Zahlen/Modelle in früheren Dokumenten der 3 Ordner.

**Firmenarchitektur (Quelle: `AERIS_Konzern_Dossier_Von_A_bis_Z.pdf`) — 3-stufige Holding,
nicht das alternative Zwei-Sparten-Einzel-GmbH-Modell („AERIS Care"/„AERIS Consult"):**
- **AERIS Holding GmbH** — hält 100 % beider Töchter, reines Vermögenspolster, kein
  operatives Geschäft. § 8b KStG Schachtelprivileg: Ausschüttung Tochter→Holding nur
  ~1,5 % effektiv versteuert.
- **AERIS Intensivpflege Service GmbH** — operative AÜG-Mutter, hält die
  Arbeitnehmerüberlassungs-Lizenz, René als GGF angestellt, rechnet den Stammklienten
  per AÜV ab.
- **AERIS Pflegevermittlung GmbH/UG** — reine Maklerfirma, keine AÜG-Lizenz nötig, löst
  die gesetzliche 18-Monats-Rotationspause (§ 1 Abs. 1b AÜG) über Null-Summen-
  Provisionsmodell (4,50 €/h beide Richtungen verrechnet) mit Partner-Zeitarbeitsfirmen.

**Honorarsätze (René-Direktive 2026-10-09, ersetzt das gestaffelte 105/135/150-€-Modell
aus den neueren Finanzpaket-Dokumenten):**
- Grundstundenlohn: **115,00 €/Std. flat** über alle Leistungssäulen (Stammkunde,
  B2B-Springer, Akut-Springer) — deckungsgleich mit `AERIS_Kalkulation_Budgetkonferenz_
  Urlaubsvertretung-v2.pdf`.
- Zuschläge (ersetzt alle abweichenden Sätze aus anderen Dossiers): Samstag **8 %**,
  Nacht **25 %** (ersetzt den 19 %-Wert aus Master-Finanzpaket/GWB-Mappe — René-
  Entscheidung 2026-10-09: 25 % ist der einzige gültige Nachtzuschlag, kein Parallel-
  Tarif), Sonntag **50 %**, Feiertag **125 %**, Weihnachten (24.12.) **135 %**.

**Altersvorsorge & Hinterbliebenenschutz (Quelle: Konzern-Dossier Teil D+E):**
- Rente ab 63: bAV 1.290 € brutto + Holding-Depotentnahme 6.910 € brutto
  (Teileinkünfteverfahren) ≈ **7.130,81 € NETTO/Monat** — die von René bestätigte Zielgröße.
- Witwenrente zweisäulig: Säule 1 = 75 % der GF-Bezüge als Witwenrente (Betriebsausgabe,
  GF-Anstellungsvertrag § 14); Säule 2 = Ehefrau erbt Holding-Anteile steuerfrei
  (Ehegatten-Freibeträge) und entnimmt restliche 25 % als reguläre Dividende.

## Server-Deployment (privat, René-Direktive 2026-10-09)
- STRATO-vServer `212.132.117.130` (Debian 12, 1 vCPU/2GB/60GB), gehärtet: UFW (nur SSH/HTTP/HTTPS),
  fail2ban, unattended-upgrades, SSH ausschließlich per Key (`~/.ssh/aeris_server_ed25519` lokal),
  Passwort-Login deaktiviert. Node.js 22 LTS installiert, bislang ungenutzt (für künftiges Backend,
  z. B. Open-Banking — noch nicht gebaut, braucht erst einen Provider-Account von René).
- Nginx liefert `/var/www/aeris` (= 1:1-Sync des Projekt-Root) über HTTPS mit selbstsigniertem
  Zertifikat (`/etc/nginx/aeris-ssl/`, 10 Jahre gültig) + HTTP Basic Auth (`/etc/nginx/aeris-ssl/.htpasswd`,
  User `rene`) als zweite Ebene vor der App-eigenen PIN. **Bewusst NICHT öffentlich** — René-Direktive:
  „nur wir damit arbeiten können, Unternehmen startet erst in 5-6 Jahren". Keine Domain (noch keine
  vorhanden), daher kein Let's-Encrypt-Zertifikat möglich — Cert-Installation als vertrauenswürdiges
  Profil auf Renés iPhone nötig (einmalig, Anleitung im Chat-Verlauf 2026-10-09).
- Deployment-Weg: `rsync` vom lokalen Projektordner (kein `git pull` auf dem Server — kein Deploy-Key
  eingerichtet, um Renés GitHub-Login nicht zu brauchen). Bei jeder künftigen Session mit Server-Bezug:
  Änderungen erneut per rsync synchronisieren, `chown -R www-data:www-data /var/www/aeris` danach.
- Passwort NICHT im Git-Repo hinterlegt (Sicherheitshygiene) — bei Bedarf über `ssh root@212.132.117.130`
  neu setzen (`htpasswd -bc /etc/nginx/aeris-ssl/.htpasswd rene '<neues-passwort>'`).

**Noch ungeklärt, nicht Teil dieser Freigabe:**
- Firmenadresse uneinheitlich über die Quelldokumente (Hohenfelsstraße 34 Dautphetal /
  Marburger Straße 16 Dautphetal / Wetschaftstraße 12 Marburg) — René-Entscheidung
  noch ausstehend, bis dahin gilt die Root-CLAUDE.md-Global-Identity-Adresse
  (Hohenfelsstraße 34, 35232 Dautphetal) als Platzhalter.
- Noch keine Umsetzung in Code/Businessplan-Dokument/AERIS Buch begonnen — reine
  Modell-Festlegung. René hatte zuvor explizit „Stopp, alles als offen behalten"
  anngeordnet; diese Direktive bleibt in Kraft, bis René den Startschuss für die
  Umsetzung gibt.
