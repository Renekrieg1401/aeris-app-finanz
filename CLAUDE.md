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
  (Grenze) zwischen Wundfläche und Wundumgebung", Wundgrund und Wundbelag als zwei
  GETRENNTE Begriffe im Eintrag-Formular (die ICW-Quelle definiert zusätzlich noch
  „Wundoberfläche" als eigenen Begriff — im UMGESETZTEN Modul NICHT als drittes
  eigenes Feld abgebildet, nur Wundgrund/Wundbelag; `pflege-diagnostik`-Fund Runde 2,
  2026-10-10: diese Zeile hatte zuvor fälschlich drei getrennte Felder behauptet),
  Erosion (oberflächlich, bis Epidermis) vs. Ulcus (bis in
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

## Nachtrag 2026-10-10 (4) — "Alles Offene erledigen": 3 echte Technikpunkte behoben, 5 bewusst nicht eigenmächtig entschieden
> René-Direktive „Alles offene erledigen". Vorab sortiert: reine Entscheidungsfragen
> (Eigentum/Marke/öffentliche Domain/Rechtsdokument) sind NICHT „erledigbar" durch
> Code — die bleiben unverändert offen (s. u.). Tatsächliche Technikarbeit umgesetzt:

- **✅ BEHOBEN — CORS-Wildcard gehärtet:** `server/server.js` lief mit `cors()` ohne
  jede Origin-Einschränkung (devops-infra-Fund). Client ruft die API ausschließlich
  relativ (`/api/...`) vom selben Origin auf — Zugriff von einem anderen Origin ist
  architektonisch nicht vorgesehen. Jetzt per `AERIS_ALLOWED_ORIGIN`-Env-Var (Default
  `https://212.132.117.130`) eingeschränkt. Per echtem Playwright-Lauf verifiziert:
  Server-Modus-Login + `/api/me` funktionieren unverändert (Login 200, `/api/me` 200).
- **✅ BEHOBEN — journald-Log-Rotation konfiguriert:** Vorher keine expliziten Limits
  (devops-infra-Fund). Neue Drop-in `/etc/systemd/journald.conf.d/aeris-retention.conf`
  auf dem vServer: `SystemMaxUse=500M`, `MaxRetentionSec=90day` (59 GB Festplatte, 4 %
  belegt — 500 MB ist großzügig, aber begrenzt). `systemd-journald` sauber neu
  gestartet, `aeris-server`-Service unbeeinflusst.
- **✅ BEHOBEN — echter Tenant-Löschmechanismus (Art. 17 DSGVO):** Bislang gab es nur
  Deaktivieren einzelner Nutzer, keine echte Löschung eines Mandanten (`legal-
  compliance`-Fund 2026-10-02). Neuer Endpunkt `DELETE /api/tenant` (admin-only,
  verlangt die eigene PIN erneut zur Bestätigung gegen versehentliches Auslösen),
  löscht transaktional `dienst_eintraege`+`blob`+`users`+`tenants` für den
  betreffenden Mandanten. Neue UI-Karte „Mandant endgültig löschen" (Sidebar →
  Einstellungen, nur für Admins sichtbar, Checkbox-Bestätigung + PIN-Eingabe).
  Per echtem Playwright-Lauf verifiziert: falsche PIN korrekt abgelehnt (Account
  bleibt aktiv), echte PIN löscht wirklich — ein anschließender direkter
  `/api/login`-Aufruf mit denselben Zugangsdaten liefert 401 (Account existiert
  serverseitig nicht mehr, keine bloß clientseitige Zurücksetzung).
- Deploy: Version `2026-10-10-004` (Client), Server-Deploy via `server/deploy.sh`.
- **Bewusst NICHT eigenmächtig entschieden (reine René-Entscheidungen, kein Code-
  Fix möglich):** aeris-web-Import-Frage, GitHub-Org-Eigentum, IRIS-Digital-Marken-/
  Logo-Frage, echtes CA-Zertifikat/öffentliche Domain (würde den aktuell privaten,
  nur per Basic-Auth gesicherten Server öffentlich exponieren — eine Sicherheits-/
  Architektur-Entscheidung, keine reine Technikaufgabe), AVV-Vertrag als echtes
  Rechtsdokument (kann nicht einfach „programmiert" werden). Real-Device-Test mit
  René bleibt ebenfalls offen — braucht seine physische Anwesenheit.

## Nachtrag 2026-10-10 (5) — Agenten-Prüfkette Runde 2, 1/11: testing-qa — 1 KRITISCHER Fund behoben, 2 Lücken geschlossen
> René-Direktive „alle Agenten nacheinander alles prüfen lassen, nicht nur das was
> da ist sondern auch das was noch fehlt" — vollständige 11-Agenten-Kette läuft
> erneut, diesmal mit explizitem Lücken-Auftrag. `testing-qa` als erster Agent.

- **❌ KRITISCH, BEHOBEN — BTM-Modul erlaubte negativen Bestand:** `aeBtmEintragHinzufuegen`
  (`app.js`) berechnete den Bestand nach Abgang/Vernichtung OHNE jede Prüfung gegen den
  vorhandenen Bestand — live reproduziert: Bestand 100 ml, Abgang 99.999 ml über die
  normale UI gebucht → Bestand sprang auf **−99.899,00**, kein Fehler, landete
  unauffällig in der (korrekt verketteten) Nachweis-Kette. Einzige Schranke war das
  HTML-Attribut `min="0"` — rein clientseitig, trivial umgehbar. Bei einem BTM-
  Nachweisbuch kein kosmetischer, sondern ein Kernfehler (genau die Bestandsführung,
  die § 13/14 BtMVV verlangt). Fix: harte Ablehnung (Menge ≤ 0 UND Abgang/Vernichtung
  > aktueller Bestand), klare Fehlermeldung statt stiller Fehlbuchung. Per echtem
  Playwright-Lauf verifiziert: Überzugang abgelehnt (Bestand bleibt unverändert),
  Menge=0 abgelehnt, normaler Abgang funktioniert weiterhin korrekt.
- **✅ BEHOBEN — fehlendes `maxlength` auf 31 Textfeldern der 3 neuen Module:** Jedes
  neue Formularfeld (Bezeichnung/Wirkstoff/Verordner/Lokalisation usw.) hatte kein
  Längenlimit — Inkonsistenz zum Rest der App (24 bestehende Felder haben durchgängig
  `maxlength`). Alle 31 Felder nachgezogen (120/60/20/4/200/600 Zeichen je nach
  Feldtyp, konsistent mit bestehenden Werten wie `ae-eigene-dok-titel` maxlength 120).
- **✅ BEHOBEN — fehlender automatisierter Test für `DELETE /api/tenant`:** Neuer
  Testfall in `server/test/server.test.js` (Nicht-Admin → 403, falsche PIN → 401 +
  Tenant bleibt intakt, korrekte PIN → echte Löschung + anschließender Login 401).
  Gegen eine funktionierende Node-Umgebung auf dem vServer verifiziert (lokal weiterhin
  durch das bekannte Node-Versions-Problem blockiert, s. Nachtrag 12): **16/16 Tests
  grün.**
- **⚠️ Lücke bewusst NICHT durch neue UI behoben, stattdessen explizit dokumentiert:**
  Stammdaten (Präparat/Gerät/Wunde) waren nach Anlegen nicht mehr editierbar — testing-qa
  stufte das als „wirkt übersehen, nicht entschieden" ein. Eine volle Edit-UI für alle
  drei Module hätte den Umfang der restlichen 10-Agenten-Runde gesprengt — stattdessen
  jetzt als EXPLIZITE, sichtbare Design-Entscheidung in der UI kommuniziert („bewusst
  nicht mehr änderbar, bei Tippfehler neu anlegen"), konsistent mit dem Audit-Trail-
  Prinzip der Module. Workaround (neu anlegen) verliert keine Historie.
- **⚠️ Noch offen (von testing-qa benannt, nicht in dieser Runde behoben):** Kein
  Qualitäts-/Konsistenzabgleich der Geschäftslogik zwischen den 3 Modulen (nur BTM hatte
  die Bestandsprüfungs-Lücke, Medizinprodukte/Wunden strukturell ähnlich aber ohne
  vergleichbare numerische Validierungs-Anforderung) — für eine künftige Session
  vorgemerkt, kein akuter Zweitfund in dieser Runde.
- Deploy: Version `2026-10-10-005`.

## Nachtrag 2026-10-10 (6) — Agenten-Prüfkette Runde 2, 2/11: security-privacy — 2 echte Lücken behoben, 1 fundamentaler Architektur-Befund dokumentiert
> `security-privacy` prüfte die neue `DELETE /api/tenant`-Route, CORS-Härtung,
> Zero-Knowledge-Treue der 3 neuen Module, XSS, Hash-Ketten-Robustheit.

- **✅ BEHOBEN — kein Rate-Limiting auf der Tenant-Löschbestätigung:** Die PIN-
  Reauthentifizierung bei `DELETE /api/tenant` hatte kein Lockout — wer an ein
  gültiges Admin-JWT kommt (gestohlenes Token, kompromittiertes Gerät), hätte die
  6-stellige PIN unbegrenzt online durchprobieren und den gesamten Mandanten
  unwiderruflich löschen können. Gleicher, bereits bewährter Mechanismus wie
  `/api/login` (persistent in SQLite, übersteht einen Neustart), eigener
  `tenant_delete`-Sperr-Typ pro User-ID, 5 Fehlversuche → 15 Min Sperre. Per echtem
  Live-Test UND neuem automatisiertem Testfall verifiziert (6. Versuch korrekt 429).
- **✅ BEHOBEN — kein Audit-Log für die Tenant-Löschung:** Wer wann welchen
  Mandanten gelöscht hat, war für immer verschwunden — kein Request-Logging, keine
  Audit-Tabelle. Neue `audit_log`-Tabelle (`server/db.js`), bewusst OHNE Fremdschlüssel
  auf `tenants`/`users` (die referenzierten Zeilen werden durch genau die geloggte
  Aktion gelöscht — der Log-Eintrag muss das überleben, daher denormalisierte
  Akteur-/Ziel-Daten als Momentaufnahme). Enthält ausschließlich Metadaten (wer/wann/
  was), nie Klardaten — keine Kollision mit dem Zero-Knowledge-Prinzip. Eintrag wird
  VOR der Löschtransaktion geschrieben. Per automatisiertem Test verifiziert: Eintrag
  existiert nachweislich auch nach der Löschung des referenzierten Tenants.
  **Jetzt 18/18 Tests grün** (2 neue: Rate-Limit + Audit-Log-Überlebensfähigkeit).
- **⚠️ FUNDAMENTALER ARCHITEKTUR-BEFUND, NICHT in dieser Runde behoben (braucht
  René-Entscheidung, keine reine Code-Korrektur):** Die hash-verketteten Nachweis-
  Ketten der 3 neuen Module (BTM/Medizinprodukte/Wunden) UND des bereits länger
  bestehenden MD-Archivs sind **kein Schutz gegen die Person, die sie eigentlich
  lückenlos dokumentieren sollen.** Alle vier leben als Top-Level-Felder im selben
  mutable `AE`-JSON-Blob, der komplett (nicht append-only) via `PUT /api/blob`
  überschrieben wird. Jede Person mit der eigenen DEK (= jede eingeloggte Pflegekraft)
  kann den entschlüsselten Baum lokal verändern — Einträge löschen oder tauschen —,
  die Hash-Kette mit demselben, öffentlich bekannten Algorithmus neu durchrechnen und
  ganz normal hochladen. Der Server sieht nur neues, gültiges Chiffretext, keine
  Instanz prüft gegen einen externen Ankerpunkt. **Im Gegensatz dazu ist der
  Dienstplan (`dienst_eintraege`) tatsächlich manipulationssicher** — echte,
  server-seitige SQL-Tabelle, nur `INSERT`, kein Update-/Delete-Endpunkt. Bei einem
  BTM-Nachweisbuch, dessen gesetzlicher Zweck gerade die Tamper-Resistenz gegen den
  dokumentierenden Mitarbeiter selbst ist (§ 13/14 BtMVV), ist das kein kosmetischer
  Punkt. **Sofort behoben (Ehrlichkeits-Fix, keine Architektur-Entscheidung):** Die
  bisherige UI-Formulierung „hash-verkettet gegen nachträgliche Manipulation"
  überzeichnete den tatsächlichen Schutz — in allen 4 betroffenen Modulen (BTM,
  Medizinprodukte, Wunden, MD-Audit) auf eine ehrliche Formulierung korrigiert
  („erkennt nachträgliche Veränderung der gespeicherten Kette — kein Ersatz für eine
  serverseitige Non-Repudiation gegenüber der dokumentierenden Person selbst").
  **Echte Architektur-Lösung (z. B. die 3 neuen Module analog zum Dienstplan in echte
  Server-Tabellen statt in den mutable Blob verlagern) bewusst NICHT eigenmächtig
  umgesetzt** — das wäre ein substanzieller Eingriff in das bestehende Zero-Knowledge-
  Prinzip-Verständnis (Dienstplan-Metadaten liegen bereits bewusst unverschlüsselt
  serverseitig, dokumentiert in der Datenschutzerklärung — BTM-/Wunddaten sind
  deutlich sensibler als Dienstplan-Metadaten, dieselbe Kompromisslösung dafür wäre
  eine eigene, weitreichende Datenschutz-Entscheidung).
- Deploy: Version `2026-10-10-006`.

## Nachtrag 2026-10-10 (7) — Agenten-Prüfkette Runde 2, 3/11: legal-compliance — 1 objektiv falsche DSGVO-Aussage behoben, 1 bedeutender Rechts-Einordnungsfund korrigiert
> `legal-compliance` prüfte DSGVO-Abdeckung der 3 neuen Module + Tenant-Löschung,
> verifizierte §13/14 BtMVV und §13 MPBetreibV eigenständig gegen die Primärquelle.

- **✅ BEHOBEN — Datenschutzerklärung widersprach seit heute der echten
  Datenverarbeitung (Art. 13/14 DSGVO-Transparenzpflicht verletzt):** § 5 behauptete
  weiterhin „kein automatisierter Lösch-Mechanismus … für ein gesamtes Mandanten-
  Unternehmen" — das stimmt seit `DELETE /api/tenant` (Nachtrag 4) nicht mehr. Text
  korrigiert: Mandanten-Löschung existiert und funktioniert, Löschung EINZELNER
  Mitarbeiter-Accounts weiterhin nur Deaktivierung (ehrlich differenziert), Audit-Log
  ergänzt erwähnt.
- **✅ BEHOBEN — 3 neue Datenkategorien fehlten namentlich in § 2:** BTM-Bestände,
  Medizinprodukte-Daten und insbesondere Wunddokumentation (Art. 9 DSGVO-
  Gesundheitsdatum!) wurden nicht erwähnt. Ergänzt.
- **✅ VERIFIZIERT + UI KORRIGIERT — bedeutender Rechts-Einordnungsfund (eigene
  Primärquellen-Kette, nicht nur der Agentenbehauptung vertraut):** § 1 Abs. 3 BtMVV
  (Liste der nachweispflichtigen Einrichtungen) nennt Alten-/Pflegeheime (stationär),
  Arzt-/Zahnarztpraxen, Krankenhäuser, Hospize/SAPV — **ambulante Intensivpflege-
  dienste NICHT namentlich**. § 5 Abs. 9 (möglicher Einbezugspfad) erfasst nur
  Substitutionsmittel (Suchttherapie), nicht allgemeine Schmerz-/Sedierungsmedikation
  wie bei AKI üblich. Die bisherige BTM-Modul-Überschrift „Nachweis … nach § 13/§ 14
  BtMVV" suggerierte eine sichere, direkte gesetzliche Bindung, die primärquellen-
  geprüft NICHT eindeutig belegt ist. UI-Text korrigiert: Modul jetzt als „internes,
  an den Pflichtangaben orientiertes Kontrollinstrument" beschrieben, mit explizitem
  Hinweis auf die ungeklärte Institutions-Reichweite — ehrlicher als die vorherige
  unqualifizierte Rechtsbehauptung, ohne die fachliche Qualität des Moduls zu
  schmälern (die Pflichtangaben-Abdeckung selbst bleibt unverändert korrekt).
- **✅ VERIFIZIERT + UI ergänzt — MPBetreibV-Aufbewahrungsfrist:** § 13 Abs. 3
  MPBetreibV („fünf Jahre NACH Außerbetriebnahme") eigenständig bestätigt, bisher
  nirgends im Modul genannt. UI ergänzt, inkl. ehrlichem Hinweis: kein automatischer
  Lösch-Mechanismus — unproblematisch, da die Frist eine MINDEST-, keine Höchstdauer
  ist (dauerhaftes Aufbewahren erfüllt die Pflicht weiterhin).
- **⚠️ Noch offen, NICHT in dieser Runde umgesetzt (Feature-Build, kein reiner
  Text-/Honesty-Fix):** § 13 Abs. 2 BtMVV verlangt für die dort enumerierten
  Einrichtungen eine MONATLICHE Bestandsprüfung durch eine berechtigte Person,
  bestätigt durch Namenszeichen und Prüfdatum — im BTM-Modul nicht umgesetzt. Da die
  institutionelle Reichweite für ambulante AKI-Dienste selbst unklar ist (s. o.), ist
  unklar, ob diese spezifische Pflicht für AERIS' Zielgruppe überhaupt bindend greift
  — ein Feature dafür zu bauen, bevor die Grundfrage geklärt ist, hieße das falsche
  Problem zu lösen. Als sinnvolle künftige Ergänzung vorgemerkt (gute fachliche
  Praxis, unabhängig von der Rechtsfrage), nicht unter Zeitdruck in dieser Runde gebaut.
- **⚠️ Weiterhin offen:** Kein Lösch-/Fristen-Mechanismus für BTM/Medizinprodukte/
  Wunden (anders als `aeMdArchivBereinigen()` beim MD-Archiv) — bei BTM strukturell
  komplex (laufende Bestandsführung, nicht tageweise abschließbar wie MD-Archiv),
  nicht in dieser Runde gelöst. Datenschutzrechtlich entschärft durch die Tatsache,
  dass die gesetzlichen Fristen MINDEST- nicht Höchstfristen sind — kein akuter
  Art.-5-DSGVO-Verstoß allein durch unbegrenzte Aufbewahrung ohne weiteren
  Verarbeitungszweck, aber auf Dauer zu klären.
- Deploy: Version `2026-10-10-007`.

## Nachtrag 2026-10-10 (8) — Agenten-Prüfkette Runde 2, 4/11: pflege-diagnostik — 1 Doku-Übertreibung korrigiert, 2 echte Lücken geschlossen
> `pflege-diagnostik` verifizierte die ICW-Terminologie eigenständig gegen die
> Primärquelle (3/3 Stichproben bestätigt korrekt) und fand Konsistenz-/
> Verknüpfungs-Lücken zwischen dem neuen Wund-Register und bestehenden Bausteinen.

- **✅ BEHOBEN — Doku-Übertreibung korrigiert:** CLAUDE.md behauptete fälschlich, das
  ICW-Modul bilde „Wundgrund/Wundbelag/Wundoberfläche als drei GETRENNTE Begriffe" ab
  — tatsächlich umgesetzt sind nur zwei Felder (Wundgrund, Wundbelag), kein separates
  „Wundoberfläche"-Feld. Dokumentation korrigiert, kein neues Feld erzwungen (ICW
  definiert Wundoberfläche konzeptionell überlappend mit Wundgrund — ein drittes
  Feld hätte eher Verwirrung als fachlichen Mehrwert gebracht).
- **✅ BEHOBEN — Terminologie-Bruch zwischen TIME-Sektion (Abschnitt 10 im
  Assessment-Bogen) und neuem ICW-Modul:** Dieselbe Pflegefachkraft hätte je nach
  Formular unterschiedliches Vokabular für dieselbe Beobachtung benutzt — TIME fehlten
  „Hypergranulation"/„Epithel" bei Wundgrund und „reizlos"/„kallös" bei Wundrand
  (ICW-Modul hatte sie bereits), Exsudatmenge hieß dort „mittel/reichlich" statt
  „mäßig/stark". TIME-Sektion nachgezogen (gespeicherte `value`-Attribute bewusst
  unverändert gelassen, nur fehlende Optionen ergänzt bzw. sichtbare Label-Texte
  angeglichen — bestehende, bereits gespeicherte Assessment-Daten bleiben kompatibel
  lesbar). Per Live-DOM-Check verifiziert: alle 3 Selects zeigen jetzt identische
  Begriffe wie das ICW-Modul.
- **✅ BEHOBEN — keine Verknüpfung Wund-Register ↔ Braden-Skala/DNQP-
  Maßnahmenplan:** Ein Klient mit niedrigem Braden-Score UND einer im Wundregister
  dokumentierten Dekubitus-Wunde waren zwei isolierte Datensilos, obwohl der
  DNQP-Standard „Pflege von Menschen mit chronischen Wunden" bereits im
  SIS-Maßnahmenplan als Referenz hinterlegt ist. Gegenseitiger Hinweistext ergänzt
  (Braden-Abschnitt → Wundregister + DNQP-Maßnahmenplan; Wundregister-Lead-Text →
  Braden-Score + DNQP-Maßnahmenplan) — bewusst als Hinweistext, keine erzwungene
  Datenverknüpfung (beide Bausteine bleiben eigenständig bedienbar).
- **✅ Kleine Verbesserung:** Medizinproduktebuch-Lead-Text um AKI-typische Beispiele
  ergänzt (Trachealkanüle, Pulsoxymeter, Perfusor neben Beatmungs-/Absauggerät).
- **Geprüft und OK (von pflege-diagnostik bestätigt):** ICW-Terminologie 3/3
  Stichproben korrekt (Nekrose/Gangrän, Hypergranulation/Wildes Fleisch, Erosion/
  Ulcus), „gängige Praxis"-Kennzeichnung ehrlich, BTM-/Medizinprodukte-Freitext-
  Register bewusst offen (keine geschlossene Liste nötig).
- Deploy: Version `2026-10-10-008`.

## Nachtrag 2026-10-10 (9) — Agenten-Prüfkette Runde 2, 5/11: pflege-assessment — keine Regression, 2 Hinweis-Fixes, 3 größere Instrumenten-Lücken dokumentiert
> `pflege-assessment` bestätigte: keine Regression der bestehenden RASS/CPOT/BPS/
> NRS-2002/Braden-Berechnungen durch die heutige TIME-Terminologie-Angleichung
> (Nachtrag 8) — strikte `data-af`-Namespace-Trennung verhindert jede Überschneidung,
> per Code-Lektüre verifiziert (kein Browserzugriff in dieser Agentenrolle).

- **✅ Geprüft, keine Regression:** `updateAssessComputed` (`app.js:2147-2256`) liest
  RASS/CPOT/BPS über `schmerz.*`, NRS-2002 über `ernaehrung.*`, Braden über
  `dekubitus.*` — die TIME-Änderung betraf ausschließlich `wunde.*`, ein komplett
  getrennter Objektpfad. Alle Runde-1-Fixes (Braden-Cutoff ≤9, NRS-2002-Cutoff ≥3,
  CPOT/BPS-Alert-Schwellen) weiterhin intakt.
- **✅ BEHOBEN — Herstellerfristen-Hinweis fehlte bei der Medizinprodukte-
  Fälligkeits-Ampel:** `naechsteFaelligkeit` ist ein reines manuelles Datumsfeld
  (keine automatische Kollision mit kürzeren Herstellerfristen, wie befürchtet) —
  aber das Feld-Label gab keinen Hinweis, dass § 12 Abs. 1 MPBetreibV „spätestens
  alle 2 Jahre" eine gesetzliche OBERGRENZE ist, keine automatisch korrekte Frist.
  Hinweistext ergänzt: Herstellerangabe aus der Gebrauchsanweisung prüfen, falls kürzer.
- **✅ BEHOBEN — fehlende Verknüpfung BTM-Modul ↔ Schmerzassessment:** Eine hohe
  CPOT-/BPS-/NRS-Messung ließ sich innerhalb der App nicht einmal lose mit einer
  BTM-Abgabe desselben Tages in Verbindung bringen (`AE.btm` strukturell komplett
  isoliert von `AE.tage[iso].assessment.schmerz`, keine `iso`-Verknüpfung). Bewusst
  NICHT als Datenverknüpfung gelöst (kein Register-Umbau), sondern als Hinweistext
  im Bemerkung-Feld des BTM-Eintrag-Formulars ergänzt (aktuellen Schmerz-Score dort
  manuell vermerken).
- **⚠️ Größere, NICHT in dieser Runde umgesetzte Lücken (jeweils ein eigenes,
  primärquellen-pflichtiges Neu-Instrument vergleichbarer Größe zu den heutigen 3
  Modulen, keine Quick-Fixes):**
  - **MRC-Score** (Muskelkraft) fehlt komplett — hochrelevant für Langzeitbeatmung/
    Weaning (ICU-acquired weakness korreliert mit Weaning-Erfolg), aktuell nur ein
    Freitextfeld „Weaning-Toleranz".
  - **Dysphagie-Screening** (z. B. GUSS) fehlt komplett — trotz Trachealkanülen-
    Fokus kein strukturiertes Aspirationsrisiko-Screening beim Entblocken.
  - **Barthel-Index/FIM** (Selbstständigkeit) fehlt komplett — von MD/Kostenträgern
    oft als strukturierte Einstufung verlangt.
  Alle drei als empfohlene künftige Ergänzung vorgemerkt, nicht unter Zeitdruck in
  dieser Prüfrunde gebaut (Komplexität vergleichbar mit einem der 3 heutigen Module).
- **Geprüft und OK:** Sekret-/Absaugmanagement (Abschnitt 3) bereits strukturiert
  (kein Fund), Beatmungsparameter-Verlauf (Abschnitt 1, Soll/Ist mit Minicharts)
  bereits strukturiert, nicht nur Freitext (kein Fund).
- Deploy: Version `2026-10-10-009`.

## Nachtrag 2026-10-10 (10) — Agenten-Prüfkette Runde 2, 6/11: accessibility-a11y — 1 echte Lücke behoben, kein Kontrastfehler
> `accessibility-a11y` prüfte WCAG-Kontraste der heute neuen Hinweistexte (alle
> PASS, 4,67–6,78:1), aria-labels, Touch-Targets, Fokus-Reihenfolge der 3 neuen
> Module. Live-Tastaturtest war in der Agentenrolle technisch nicht möglich
> (Playwright nicht verfügbar) — von mir direkt nachgeholt, s. u.

- **✅ BEHOBEN — fehlendes `aria-live` auf allen „Kette prüfen"-Ergebnisanzeigen:**
  `#btm-pruefen-ergebnis`/`#mp-pruefen-ergebnis`/`#wunde-pruefen-ergebnis` (neu) UND
  `#dp-kette-ergebnis`/`#mdk-pruefen-ergebnis` (Altbestand, Dienstplanung/MD-Archiv —
  dieselbe Lücke wurde beim Bau der 3 neuen Module repliziert statt geschlossen) hatten
  kein `aria-live`. Ein Screenreader-Nutzer bekam beim Klick auf „Kette auf
  Manipulation prüfen" keine Ankündigung, ob die Prüfung bestanden oder fehlgeschlagen
  hat — inkonsistent zum selbst verwendeten `ae-inline-note`-Muster
  (`role="status" aria-live="polite"`), das bei allen Formular-Erfolgsmeldungen
  bereits korrekt gesetzt war. Alle 5 Stellen ergänzt, live verifiziert.
- **✅ Live-Tastaturtest nachgeholt (war in der a11y-Agentenrolle technisch nicht
  durchführbar):** Präparat per Tastatur angelegt (Tab-Navigation, Enter-Submit) —
  funktioniert. Tab-Reihenfolge im Eintrag-Formular vollständig und logisch
  verifiziert (`btm-praeparat-auswahl → typ → menge → einheit → datum → uhrzeit →
  gegenpart → …`) — native `date`/`time`-Felder haben mehrere interne Tab-Stopps
  (Tag/Monat/Jahr bzw. Stunde/Minute), das ist korrektes Browser-Standardverhalten,
  kein Bug. Kein Tab-Trap, keine übersprungenen Felder.
- **Geprüft und OK (von accessibility-a11y bestätigt):** Alle neuen `<small>`-
  Hinweistexte PASS gegen jeden `.ae-card`-Gradient-Stopp (4,67–6,78:1). Touch-
  Targets aller neuen Checkboxen (Mazeration/Erythem/Infektionszeichen/Tenant-
  Löschen-Bestätigung) ≥44px. Fokus-Reihenfolge bei SPA-Navigation korrekt
  (`<h1>` jeder neuen Sektion wird fokussiert). Select-Optionen aus Nachtrag 8
  strukturell identisch zugänglich wie die bisherigen.
- Deploy: Version `2026-10-10-010`.

## Nachtrag 2026-10-10 (11) — Agenten-Prüfkette Runde 2, 7/11: business-finance — 1 echte Lücke (teilweise) geschlossen
> `business-finance` fand: Medizinprodukte-Anschaffungskosten (Perfusor, Beatmungs-
> gerät u. a. — bereits als AKI-typisch im Medizinproduktebuch benannt) hatten keine
> Kategorie in AERIS Buch, obwohl das Medizinproduktebuch bereits ein Anschaffungsjahr
> als § 14 Abs. 2 MPBetreibV-Pflichtangabe erfasst — zwei Bausteine, die denselben
> Sachverhalt betreffen, sprachen nicht miteinander.

- **✅ Teilweise behoben — neue Belegkategorie „Medizinprodukte-Anschaffung &
  Instandhaltung"** (`buchhaltung/app.js`, `BELEG_KATEGORIEN`) ergänzt, GWG-Konten
  (SKR03 4855/SKR04 6260) als Default — **bewusst kein Blankoversprechen im Label**:
  bei hochpreisigen Anschaffungen (>800 € netto) ist statt Sofortabzug eine
  Aktivierung mit AfA-Plan nötig, das hängt vom Einzelfall ab, daher Verweis „mit
  Steuerbüro klären" direkt im Kategorie-Namen (analog dem bestehenden
  Umsatzsteuer-Befreiung-Muster dieser App). Gegen-Hinweis im Medizinproduktebuch
  selbst ergänzt (Lead-Text verweist jetzt auf AERIS Buch).
- **Bewusst NICHT umgesetzt (vom Agenten selbst als Feature-Build statt Fix
  eingeordnet):** Keine automatische Datenübernahme/-verknüpfung zwischen
  Medizinproduktebuch und AERIS Buch — beide Apps sind separate PWAs mit getrennten
  Datenmodellen, eine echte Verknüpfung wäre ein eigenständiger Architektur-Auftrag,
  kein Quick-Fix in dieser Prüfrunde.
- **Geprüft und bewusst korrekt getrennt:** BTM-Zugänge NICHT mit der Buchhaltung
  verknüpft — Betäubungsmittel laufen über Rezept/Kassenabrechnung (§ 37c SGB V),
  nicht über Pflegedienst-Betriebsausgaben, eine Finanzverknüpfung dort wäre fachlich
  falsch.
- **Geprüft und OK:** Pricing (115 €/Std. + Zuschläge) weiterhin konsistent in beiden
  Code-Kopien, SKR-Fix aus Runde 1 weiterhin intakt, Steuerberater-Export bewusst frei
  von Klientendaten, Audit-Log-Speicherverbrauch über Jahre hinweg vernachlässigbar
  (<<1 MB selbst bei tausenden Einträgen, 59 GB Disk bei 4 % Belegung).
- Deploy: AERIS Doku `2026-10-10-011`, AERIS Buch `2026-10-10-001` (eigenes,
  separates Versionsschema, erstmals seit dessen letztem Stand `2026-10-02-008`
  nachgezogen).

## Nachtrag 2026-10-10 (12) — Agenten-Prüfkette Runde 2, 8/11: brand-marketing — 2 echte Funde behoben
> `brand-marketing` fand: mein eigener Versions-Bump von AERIS Buch (Nachtrag 11) war
> unvollständig, und ein Sidebar-Kurztext widersprach der heute selbst korrigierten
> BTM-Rechtsaussage (Nachtrag 7).

- **✅ BEHOBEN — `buchhaltung/app.js`-Versionskonstante beim Bump übersehen:**
  `index.html`/`sw.js` wurden auf `2026-10-10-001` nachgezogen, die dritte kanonische
  Stelle (`APP_VERSION` in `app.js:19`) blieb bei `2026-10-02-008` stehen. Das ist
  kein kosmetischer Zahlendreher: `APP_VERSION` steuert live den Update-Vergleich
  (`app.js:1985`, `m[1] !== APP_VERSION`) — die App hätte dauerhaft fälschlich „Update
  verfügbar" angezeigt, weil Seiten-Version und Code-Konstante nie übereinstimmen
  konnten. Nachgezogen, live verifiziert: beide Werte jetzt identisch (`2026-10-10-001`).
- **✅ BEHOBEN — Sidebar-Kurztext widersprach der heute selbst gehedgten
  BTM-Rechtsaussage:** Nachtrag (7) stellte die BTM-Kopfzeile bewusst von einer
  unqualifizierten „nach § 13/14 BtMVV"-Behauptung auf eine gehedgte Formulierung um
  (ungeklärte Institutions-Reichweite bei ambulanter AKI) — der Sidebar-Navlink-
  Kurztext wurde dabei nicht mitgezogen und suggerierte weiterhin die feste
  gesetzliche Bindung. Auf „Zugang, Abgang, Bestand — an § 13/14 BtMVV orientiert"
  korrigiert, konsistent zur Lead-Text-Formulierung.
- **⚠️ Fragwürdig/unklar, keine neue Abweichung der heutigen Module (seit Längerem
  bestehende, nie dokumentierte Drift):** `accent-[#B8845A]` (Checkbox-Akzentfarbe,
  app-weit durchgängig) ist kein literaler Wert aus der gesealten Design-Token-
  Tabelle — wirkt wie eine abgeleitete Bronze-Variante, nie in die Masterübersicht
  eingetragen. Nicht in dieser Runde behoben (betrifft die GESAMTE App, nicht nur
  heutige Änderungen — eigene Prüfrunde nötig).
- **Geprüft und OK:** Manifeste (Root + `buchhaltung/`) weiterhin exakt `#131B27`/
  `#2B4570`. Sektions-Hintergründe der 3 neuen Module bit-identisch zu allen
  bestehenden Sektionen. Danger-Rot `#C0392B` der Tenant-Löschkarte konsistent zum
  bestehenden Verwendungsmuster. Icon-Stil (viewBox/stroke-width) konsistent. Tonalität
  der neuen Hinweistexte sachlich-professionell, kein Stilbruch.
- Deploy: AERIS Doku `2026-10-10-012`, AERIS Buch `2026-10-10-001` (jetzt an allen
  3 Stellen konsistent).

## Nachtrag 2026-10-10 (13) — Agenten-Prüfkette Runde 2, 9/11: devops-infra — 4 echte Funde behoben, 1 Lösung bewusst verworfen
> `devops-infra` fand per Read-only-SSH-Checks gegen den echten vServer: die
> Produktiv-DB hatte KEIN Backup — bei Festplattendefekt oder Fehlbedienung wäre
> alles unwiderruflich weg. Dringendster Fund der gesamten Runde-2-Kette bisher.

- **✅ BEHOBEN — kein Backup der Produktiv-DB:** Neues tägliches Backup via
  systemd-Timer (`server/aeris-backup.timer`, 03:30 UTC + Zufallsversatz,
  `Persistent=true` holt verpasste Läufe nach). `server/backup.sh` nutzt SQLites
  eingebaute Online-Backup-API (`.backup`, konsistent auch bei laufenden
  Schreibzugriffen im WAL-Modus, kein Service-Stop nötig), komprimiert, räumt
  Backups älter als 30 Tage automatisch ab. Kein `cron` auf dem vServer installiert
  (bestätigt) — bewusst systemd-Timer statt Zusatzpaket, konsistent zur bestehenden
  Infrastruktur. **Live getestet, nicht nur deployed:** manueller Lauf erzeugte echtes
  Backup, `PRAGMA integrity_check` → „ok", Tabellenabfrage gegen die entpackte
  Wiederherstellung erfolgreich — kein Blindvertrauen in ein ungeprüftes Skript.
- **✅ BEHOBEN — `AERIS_ALLOWED_ORIGIN` nur im Code-Default verankert, nicht
  sichtbar im Service-File:** Bei einer künftigen Domain-Migration (Punkt 6, Offene
  Entscheidungen) hätte diese Variable mit hoher Wahrscheinlichkeit vergessen werden
  können — identisches Muster wie der bereits einmal gefundene „nur Chat-Wissen"-
  Fehler. Jetzt explizit in `server/aeris-server.service` gesetzt, live verifiziert
  (`systemctl show -p Environment`).
- **✅ BEHOBEN — Haupt-App-Deploy (`/var/www/aeris`, inkl. `buchhaltung/`) war
  weiterhin unscripted,** identischer Fehler wie der am 2026-10-09 behobene
  `server/deploy.sh`-Fund, nur für den anderen Deploy-Pfad. Neues
  `deploy-www.sh` im Projekt-Root, getestet (erfolgreicher Lauf).
- **✅ BEHOBEN — verwaiste `server.js.bak`-Datei in Produktion:** Diff gegen die
  echte `server.js` bestätigte: alte, längst überholte Fassung (vor NODE_ENV/CORS/
  Rate-Limit-Fixes), nirgends referenziert — entfernt.
- **⚠️ Lösung erwogen, dann bewusst verworfen (kein Over-Engineering):** Ein
  permanenter zweiter systemd-Service (eigene Test-DB, Port 8789) für
  API-Tests gegen den Live-Server wurde entworfen, dann wieder gelöscht, NICHT
  deployed — der bestehende lokale `server/test/server.test.js`-Lauf (via
  `helpers.js`, eigene Wegwerf-DB pro Testlauf) löst genau dieses Problem für
  API-Level-Tests bereits vollständig (18/18 grün, heute mehrfach genutzt). Ein
  dauerhaft laufender zweiter Node-Prozess wäre redundante Infrastruktur gewesen.
  **Verbleibendes Restrisiko, bewusst nicht vollständig gelöst:** Browser-basierte
  Playwright-UI-Smoketests (wie in dieser Session durchgehend verwendet) brauchen
  TLS+Nginx+Basic-Auth+statische Dateien — ein echtes Test-Replikat dafür bräuchte
  eine zweite Subdomain/einen zweiten vHost+Zertifikat, das ist ein eigenständiges
  Infrastruktur-Projekt, kein Quick-Fix. Das neue tägliche Backup ist das
  Sicherheitsnetz für diesen verbleibenden Fall, nicht seine Auflösung — UI-Tests
  sollten weiterhin bevorzugt im lokalen PIN-Modus laufen (kein Server-Kontakt),
  nur wenn Server-Modus-Funktionen selbst getestet werden müssen, Live-Server
  nutzen und danach wie gehabt bereinigen.
- **Geprüft und OK:** `audit_log`-Schema-Migration läuft zuverlässig bei jedem
  Neustart (`CREATE TABLE IF NOT EXISTS`, idempotent). `DELETE /api/tenant`
  schreibt korrekt vor der Löschtransaktion ins Audit-Log. `buchhaltung/`-Deploy war
  trotz des fehlenden Skripts bereits synchron (Zufall der Befehlsdisziplin, jetzt
  durch `deploy-www.sh` strukturell abgesichert). journald-Rotation weiterhin korrekt.

## Nachtrag 2026-10-10 (14) — Agenten-Prüfkette Runde 2, 10/11: quality-management — 1 Wiederholungsfehler behoben
> `quality-management` fand: Root-`_MAINTENANCE-MANIFEST.md` wurde HEUTE erneut
> nicht aktualisiert — exakt derselbe Fund wie gestern (Nachtrag 2026-10-09 (13)),
> explizit als „Wiederholungsfall, keine Ausrede mehr möglich" benannt. Die
> gestrige Korrektur wurde nicht strukturell verinnerlicht, sondern beim nächsten
> umfangreichen Tag identisch wiederholt.

- **✅ BEHOBEN:** Neuer Root-Manifest-Eintrag `2026-10-10` nachgeholt (3 neue
  Module, Alles-Offene-Runde, komplette zweite 9-Agenten-Kette, Highlights je
  Agent inkl. des kritischen BTM-Bugs und des fehlenden DB-Backups). Wie bei
  Nachtrag 13 gestern: Datei selbst aktualisiert, aber NICHT im Root-Repo
  committed — dort liegt ein großer, unzusammenhängender Altbestand aus
  anderen Silos, ein Commit würde fremde Änderungen mit hineinziehen
  (Silo-Isolation).
- **Lektion für künftige Sessions (von quality-management selbst benannt):**
  Eine einmalige Korrektur reicht offenbar nicht — Manifest-Update künftig als
  festen Schritt VOR dem letzten Agenten der Kette einplanen, nicht erst nach
  einem erneuten Fund nachholen.
- **Geprüft und bestätigt eingehalten:** Vier-Augen-Prinzip bei allen 3 neuen
  Modulen (echte, eigenständige Funde durch mehrere unabhängige Agenten, kein
  Abnicken). Komplexitäts-Gate-Sequenzialität (Commit-Zeitstempel streng
  monoton, keine Überlappung). Offene-Punkte-Hygiene (8 Punkte sauber über alle
  Nachträge weitergetragen). **Zusatzauftrag „auch was fehlt prüfen" durchgängig
  bei 8 von 9 Agenten mit echten Fehlt-Funden umgesetzt** (nur bei
  `brand-marketing` schwächer ausgeprägt, aber auch dort ein Dokumentations-Gap
  benannt).
- **Fragwürdig/unklar, kein harter Verstoß:** Stichpunkt-Pflicht (formal nur für
  Manifest-Einträge bindend, nicht für Silo-CLAUDE.md) wird bei den eigenen
  Nachtrag-Einträgen im Geist weiterhin unterlaufen (4-8 Sätze pro Punkt statt
  1-2) — bei einem Tag mit 14 Nachträgen summiert sich das zu einem sehr langen
  Dokument. Nicht in dieser Runde gekürzt (würde den bereits dokumentierten
  Detailgrad/die Nachvollziehbarkeit reduzieren).

## Nachtrag 2026-10-10 (15) — Agenten-Prüfkette Runde 2, 11/11 (LETZTE Instanz): product-acceptance — SUCCESS MIT VORBEHALTEN, 2 echte Funde behoben
> Ganzheitliche Schlussabnahme der kompletten Runde-2-Kette gegen den Live-Server.
> **Verdikt: SUCCESS MIT VORBEHALTEN.** Kritischer BTM-Fix hält im echten Live-Test
> (Überzugang 999 ml korrekt abgelehnt, Bestand bleibt 95,00). Ein bisher von ALLEN
> 10 vorherigen Agenten übersehener, reproduzierbarer Layout-Bug gefunden.

- **❌ ECHTER FUND, BEHOBEN — `.md\:col-span-4`/`.md\:col-span-3` nirgends in
  `app.css` definiert, trotz 14 bzw. 4 Verwendungsstellen in `index.html`:**
  Die fünf Infektionszeichen-Checkboxen (Calor/Rubor/Tumor/Dolor/Functio laesa) im
  ICW-Wundregister überlappten sichtbar mit dem darunterliegenden Schmerz-Feld —
  per Screenshot belegt. Betraf potenziell alle 14 Stellen (u. a. Bemerkung-Felder/
  „Eintrag speichern"-Buttons aller drei neuen Module sowie das ältere
  Dienstplanung-Formular), dort kosmetisch unauffälliger ohne verschachteltes
  5-Spalten-Grid dahinter, aber strukturell derselbe Fehler. Ergänzt (`app.css`,
  analog zum bestehenden `.md\:col-span-2`). Per echtem Playwright-Screenshot
  verifiziert: Checkboxen jetzt sauber in einer Zeile, keine Überlappung mehr.
  **Neun vorherige Fachagenten-Runden (testing-qa bis quality-management) hatten
  das nicht gefunden** — ein Beleg dafür, dass die ganzheitliche, visuelle
  Schlussabnahme als letzte Instanz einen echten, eigenständigen Wert hat.
- **✅ Kleiner Fund behoben:** BTM-Präparat-Dropdown zeigte bei leerem
  Stärke-Feld „Präparatname ()" mit leeren Klammern — `renderBtmPraeparate()`
  zeigt die Klammer jetzt nur noch, wenn tatsächlich eine Stärke hinterlegt ist.
- **Geprüft und bestätigt:** Keine doppelten Navigationswege, Design-Stimmigkeit
  über alle drei neuen Module konsistent (Dark-Navy/Bronze-Palette, keine
  Insellösung), keine toten Buttons, kein neuer Konsolenfehler. Die dichten
  Rechts-/Fachhinweis-Absätze (BtMVV-Reichweiten-Hedge u. a.) wirken bei einem
  B2B-Dokumentationswerkzeug sachlich begründet, nicht überladen.
- **Weiterhin offen (nicht Teil dieser Abnahme):** Kein Fachagenten-Review der 3
  neuen Module außerhalb dieser Runde-2-Kette selbst — die Kette HAT heute
  stattgefunden (9 Agenten + diese Abnahme), das war genau der heutige Auftrag.
- Deploy: Version `2026-10-10-013`.

## Nachtrag 2026-10-10 (16) — KRITISCHER, bisher unentdeckter Fund: `renderMp()`-Namenskollision brach den SIS-Maßnahmenplan seit dem Bau des Medizinproduktebuchs
> Im Zuge des René-Auftrags „alle offenen Punkte lösen" (Architektur-Umbau Medizinprodukte,
> s. u.) beim Lesen der bestehenden Funktionen entdeckt: `function renderMp()` war
> **zweimal** im selben Scope definiert — einmal für den bereits lange bestehenden
> SIS-Maßnahmenplan (Zeile 4042, „mp" = Maßnahmenplan), einmal für das heute gebaute
> Medizinproduktebuch (Zeile 4924, „mp" = Medizinprodukte, reiner Namens-Zufall). In
> JavaScript gewinnt bei einer solchen Kollision die ZULETZT im Skript definierte Funktion
> — seit dem Bau des Medizinproduktebuchs riefen `addMpEntry()` (neue Maßnahme anlegen)
> und `showSisTab('mp')` (Tab-Wechsel) faktisch die FALSCHE Funktion auf.
- **✅ BEHOBEN:** Medizinprodukte-Funktion eindeutig auf `renderMedizinprodukte()`
  umbenannt (Definition + beide Aufrufstellen), SIS-`renderMp()` unverändert belassen.
  Per echtem Playwright-Lauf verifiziert: Maßnahmenplan-Tab öffnet sich, „Maßnahme
  hinzufügen" rendert korrekt die Eingabefelder (vorher hätte dieselbe Aktion die
  Medizinprodukte-Render-Logik auf SIS-DOM-Elemente losgelassen).
- **Tragweite:** SIS/Maßnahmenplan ist eine der zentralen, meistgenutzten Funktionen
  der App (Pflegeplanung) — diese Regression lief seit dem Medizinproduktebuch-Bau
  unbemerkt durch alle bisherigen 20 Agenten-Durchläufe (Runde 1 + Runde 2), weil keiner
  gezielt den SIS-Maßnahmenplan nach den Medizinprodukte-Änderungen erneut getestet hat
  — ein Beleg dafür, wie wichtig gezielte Regressionstests bei jeder neuen, thematisch
  ähnlich benannten Funktion sind.
- Deploy: Version `2026-10-10-014`.

## Nachtrag 2026-10-10 (17) — BTM-Nachweisbuch: Architektur-Umbau auf echte Server-Tabelle (René-Entscheidung, 1/3 Module)
> René-Entscheidung nach Vorlage der Optionen: echte Tamper-Resistenz hat Vorrang vor
> vollständigem Zero-Knowledge für BTM/Medizinprodukte/Wunden — analog zum bereits
> bestehenden Dienstplan-Kompromiss (Metadaten unverschlüsselt server-seitig, dafür
> echte Manipulationssicherheit auch gegen die dokumentierende Person selbst).

- **Neue Server-Tabellen** (`server/db.js`): `btm_praeparate`, `btm_eintraege`,
  `btm_monatspruefungen` — append-only, Hash wird SERVERSEITIG berechnet (nicht vom
  Client übernommen), kein UPDATE/DELETE-Endpunkt. Bestand wird server-seitig aus der
  Historie nachgerechnet — ein manipulierter Client kann keinen falschen `bestandNachher`
  mehr einschleusen (das war der eigentliche Kern der security-privacy-Lücke).
- **Neue Endpunkte**: `GET/POST /api/btm/praeparate`, `GET/POST /api/btm/eintraege`
  (inkl. serverseitiger Überzugangs-Prüfung, identisch zum client-seitigen Fix aus
  Runde 2), `GET /api/btm/kette-pruefen`, `GET/POST /api/btm/monatspruefungen`.
- **§ 13 Abs. 2 BtMVV umgesetzt:** Neue Karte „Monatsprüfung" — je Präparat Status
  (✓ geprüft / ⚠ noch zu prüfen / — keine Änderung), Formular mit Namenszeichen +
  Prüfdatum. Nur im Team-/Server-Modus verfügbar (mehrbenutzerfähige Gegenzeichnung
  ergibt im Einzelplatz-Modus keinen Sinn).
- **Client** (`app.js`): alle `aeBtm*`-Funktionen verzweigen jetzt auf `AE_SERVER_MODE`
  — Server-Modus ruft die neuen Endpunkte auf (`aeServerApi()`-Helper), lokaler
  PIN-Modus bleibt unverändert bei der bisherigen, rein client-seitigen Kette (s. Punkt
  9 „Offene Entscheidungen" — dort bleibt der Zero-Knowledge/Tamper-Resistenz-
  Zielkonflikt bestehen, weil kein Server vorhanden ist). UI-Text zurück auf direkte
  BtMVV-Bindung gestellt (René-Entscheidung, Sidebar + Lead-Text).
- **❌ 3 ECHTE BUGS während der Umsetzung gefunden und behoben, alle live verifiziert:**
  1. **KRITISCH, bereits separat dokumentiert (Nachtrag 16):** `renderMp()`-
     Namenskollision mit dem bestehenden SIS-Maßnahmenplan — SIS war seit dem
     Medizinproduktebuch-Bau kaputt, unabhängig vom heutigen Architektur-Umbau
     entdeckt und behoben.
  2. **`DELETE /api/tenant` schlug mit „FOREIGN KEY constraint failed" fehl (500),
     Tenant blieb unlöschbar stehen:** Die Löschtransaktion kannte die 8 neuen
     Tabellen nicht. Live reproduziert (echter Testlauf, Tenant steckengeblieben),
     behoben (Kind-Tabellen vor den zugehörigen Stammdaten-Tabellen gelöscht), erneut
     live verifiziert (alle 9 relevanten Tabellen auf 0 Zeilen nach Löschung) + 2 neue
     automatisierte Tests ergänzt (jetzt 20/20 grün).
  3. **Kettenprüfung zeigte im Server-Modus fälschlich „0 Einträge geprüft":** Die
     Erfolgsmeldung griff hart auf `AE.btm.eintraege.length` zu (immer leer im
     Server-Modus) statt auf den richtigen Cache — behoben.
- Deploy: Version `2026-10-10-015` (Client), Server über `server/deploy.sh`.

## Nachtrag 2026-10-10 (18) — Medizinprodukte: Live-Nachtest deckt echten Feldnamen-Bug auf (René-Entscheidung, 2/3 Module)
> Der Medizinprodukte-Client-Umbau aus Nachtrag 17 war VOR diesem Eintrag nur
> syntaxgeprüft, NICHT live getestet — genau das wird hier nachgeholt, weil
> „fertig" ohne echten Testlauf nach der Lektion aus Nachtrag 16 (SIS kaputt,
> 20 Agenten-Durchläufe lang unentdeckt) keine belastbare Aussage ist.
- **❌ ECHTER BUG beim ersten Live-Test gefunden:** Server lehnte JEDEN
  Medizinprodukte-Eintrag mit 400 „geraetId, typ, datum erforderlich" ab —
  der Client sendet das Feld historisch als `geraeteId` (Plural-Altlast aus
  der lokalen Blob-Struktur), die Server-API (`server/server.js`,
  `rowToMpEintrag`) erwartet durchgängig `geraetId`. BTM (`praeparatId`) und
  Wunden (`wundeId`) sind auf beiden Seiten konsistent benannt — nur
  Medizinprodukte hatte diesen Mismatch, grep-geprüft, kein weiteres
  Vorkommen gefunden.
- **Fix** (`app.js`): neue `aeMpNormalizeEintrag(e)`-Hilfsfunktion
  (`e.geraeteId = e.geraeteId || e.geraetId`) an beiden Stellen, an denen
  Server-Antworten in `AE_MP_CACHE` einfließen (POST-Response, GET-Liste in
  `renderMedizinprodukte()`); beim Senden wird `geraetId: daten.geraeteId`
  explizit mitgegeben, statt das Objekt unübersetzt durchzureichen.
- **Live-Test (Playwright, echter Server) nach dem Fix:** Gerät angelegt ✓,
  2 Einträge (STK + Funktionsprüfung/Einweisung) gespeichert und in der
  Liste sichtbar ✓, Server-Kettenprüfung zeigt korrekt „2 Einträge geprüft"
  (vorher fälschlich „0") ✓, Tenant-Aufräumung 200 ✓, 0 echte
  Konsolenfehler (2 SSL-Warnungen bekannt/unschädlich).
- Deploy: Version `2026-10-10-017` (Client via `deploy-www.sh`). Kein
  Server-Code betroffen (der Server-Vertrag war immer korrekt — der Bug lag
  ausschließlich im Client).
- **Lektion:** Dieselbe Disziplin, die Nachtrag 16 erzwungen hat, hat hier
  gegriffen, bevor der Fehler ungeprüft als „fertig" dokumentiert wurde —
  live testen vor dem Haken, nicht nach dem Syntax-Check.

## Nachtrag 2026-10-10 (19) — Wunden-Dokumentation: Architektur-Umbau auf echte Server-Tabelle (René-Entscheidung, 3/3 Module)
> Identisches Muster wie Nachtrag 17 (BTM) — Server-Tabellen/Endpunkte (`wunden`,
> `wunde_eintraege`, `/api/wunden*`) waren bereits in derselben Session als Teil des
> gemeinsamen db.js/server.js-Umbaus angelegt; dieser Nachtrag schließt den fehlenden
> Client-Umbau ab.
- **Client** (`app.js`): `aeWundeHinzufuegen`/`aeWundeEintragHinzufuegen`/
  `aeWundeKettePruefen` verzweigen jetzt auf `AE_SERVER_MODE` (neuer
  `AE_WUNDE_CACHE`), `renderWunden`/`renderWundeEintraege`/`renderWunde` lesen
  modusabhängig aus Cache vs. lokalem Blob, Hash-Anzeige normalisiert über
  `e.kettenHash || e.hash`. `wunde-form`-Handler auf `.then()/.catch()`
  umgestellt (vorher ohne Fehlerbehandlung), `wunde-pruefen-btn`-Handler-Zähler
  proaktiv auf denselben Bug-Fix wie BTM (Nachtrag 17, Punkt 3) vorgezogen.
- **Live-Test (Playwright, echter Server, 212.132.117.130):** Wunde über
  Server-API angelegt ✓, 2 chronologische Verlaufseinträge (Heilungstrend)
  gespeichert und korrekt angezeigt ✓, Server-Kettenprüfung intakt ✓,
  Test-Tenant per `DELETE /api/tenant` vollständig aufgeräumt (Status 200) ✓.
  0 echte Konsolenfehler (2 SSL-Zertifikat-Warnungen sind das bekannte,
  bewusste selbstsignierte Zertifikat, kein App-Fehler, s. René-Entscheidung
  „Nein, privat/selbstsigniert bleibt bewusst so").
- **2 neue automatisierte Tests** (`server/test/server.test.js`): Wunden-API
  Grundfunktion (Wunde anlegen, 2 Einträge, Kette intakt) **plus** ein
  gezielter Manipulationstest (direkter DB-Schreibzugriff auf `laenge` eines
  bestehenden Eintrags, danach `kette-pruefen` → `intakt:false` erwartet) —
  verifiziert, dass die Server-Kette eine nachträgliche Datenbank-Manipulation
  tatsächlich erkennt, nicht nur dass sie bei unveränderten Daten „grün" meldet.
  Alle 21/21 Tests grün (vServer, `npm test`).
- Deploy: Version `2026-10-10-016` (Client via `deploy-www.sh`), Server
  unverändert (Endpunkte bereits mit Nachtrag 17 live). Produktions-DB nach
  Testlauf bereinigt (`systemctl stop && rm aeris.db* && systemctl start`).
- Nächster Schritt: MD-Archiv-Kette (Task #57, letztes der 3 Module) — dort
  reicht ein leichterer „Checkpoint-only"-Ansatz (nur Hash-Anker server-seitig,
  nie Klardaten), Endpunkte bereits live.

## Nachtrag 2026-10-10 (20) — MD-Archiv-Kette: Server-Checkpoint-Verankerung (René-Entscheidung, 3/3 — letztes Modul)
> Leichteres Muster als BTM/MP/Wunden (bewusst KEINE eigene Server-Tabelle mit
> Klardaten-Feldern, s. db.js-Kommentar bei `md_archiv_checkpoints`): der Server
> bekommt ausschließlich den täglichen Ketten-Hash als externen Zeugen, nie den
> eigentlichen Inhalt — Zero-Knowledge für die klinischen MD-Audit-Inhalte
> bleibt dadurch vollständig erhalten, nur die Tamper-Resistenz-Lücke wird
> geschlossen (eine komplette Neuberechnung der LOKALEN Kette durch die
> dokumentierende Person selbst sähe sonst in sich konsistent aus).
- **Client** (`app.js`): neue `aeMdArchivCheckpointSetzen(iso, kettenHash)` —
  im Server-Modus POST an das bereits deployte `/api/md-archiv/checkpoints`
  direkt nachdem `aeMdArchivNachfuehren()` einen neuen Tag lokal verkettet
  hat; ein 409-Konflikt (serverseitig abweichender Hash für einen bereits
  verankerten Tag) wird am Eintrag als `checkpointKonflikt` vermerkt, nicht
  verschluckt. `aeMdKettePruefen()` gleicht im Server-Modus zusätzlich die
  GESAMTE lokale Kette gegen die Server-Checkpoint-Liste ab: abweichender
  Hash → „mögliche Manipulation", beim Server verankerter Tag, der lokal
  fehlt → „mögliche Löschung" (Aufbewahrungsfrist-bedingte, legitime lokale
  Löschung alter Tage wird dabei korrekt ausgenommen, s. Vergleich gegen
  `aufbewahrungJahre`-Grenze — sonst hätte jede normale Retention-Löschung
  fälschlich als Manipulationsverdacht aufgeschlagen).
- **`index.html`-Lead-Text korrigiert:** Der MD-Audit-Abschnitt behauptete
  bisher wörtlich „kein Ersatz für eine serverseitige Non-Repudiation
  gegenüber der dokumentierenden Person selbst" — das war nach diesem
  Nachtrag im Server-Modus nicht mehr zutreffend und wurde korrigiert (klare
  Unterscheidung Server-Modus mit Zusatzschutz vs. lokaler PIN-Modus ohne).
- **Live-Test (Playwright, echter Server):** MD-Audit-View rendert fehlerfrei
  (inkl. neuem Server-Checkpoint-Abgleich-Codepfad bei 0 lokalen Einträgen) ✓,
  Checkpoint direkt über die API angelegt (200) ✓, abweichender Hash für
  denselben Tag korrekt mit 409 + `manipulationVerdacht:true` abgelehnt ✓,
  Original-Anker bleibt beim Konfliktversuch unverändert ✓, Tenant-Aufräumung
  200 ✓. 0 echte Konsolenfehler (2 SSL-Warnungen bekannt/unschädlich, 1
  erwarteter 409-Resource-Log durch den absichtlich ausgelösten Konflikttest).
- **Neuer automatisierter Test** (`server/test/server.test.js`): Anker
  setzen, identischer Re-Post ist idempotent (kein Konflikt), abweichender
  Hash löst 409 aus, Original-Eintrag bleibt dabei unverändert. 22/22 Tests
  grün (vServer, `npm test`).
- Deploy: Version `2026-10-10-018` (Client via `deploy-www.sh`). Server
  unverändert (Endpunkte bereits mit Nachtrag 17 live). Produktions-DB nach
  Testlauf bereinigt.
- **Damit sind alle 3 von René beauftragten Architektur-Module (BTM,
  Medizinprodukte, Wunden, MD-Archiv-Checkpoints) umgesetzt, live verifiziert
  und automatisiert abgesichert.** Task #54-#57 abgeschlossen.
- Nächster Schritt: Task #58 (lokaler-PIN-Modus-Kompromiss explizit
  dokumentieren — dort bleibt der Zero-Knowledge/Tamper-Resistenz-
  Zielkonflikt bewusst bestehen, weil kein Server vorhanden ist), danach #59
  (Datenschutzerklärung an die neue Server-Architektur anpassen).

## Nachtrag 2026-10-10 (21) — Datenschutzerklärung: 3 Architektur-Module offengelegt + lokaler-Modus-Kompromiss erklärt (Task #58+#59)
> Beide Tasks zusammen erledigt (dieselbe Stelle in `index.html`, Abschnitt
> „3. Technische Architektur" der Datenschutz-Sektion, direkt neben der
> bereits bestehenden, analogen Dienstplan-Offenlegung).
- **§3-Absatz „Team-/Mandanten-Modus" erweitert:** Die bisher nur für die
  Dienstplanung dokumentierte Ausnahme (unverschlüsselte Metadaten auf dem
  Server wegen der manipulationssicheren Hash-Verkettung) jetzt explizit auch
  für BTM-Nachweisbuch, Medizinproduktebuch und Wunddokumentation (Metadaten:
  Präparat-/Gerätebezeichnung, Mengen/Zeitpunkte, Wundmaße/-befunde,
  beteiligte Pflegekräfte) sowie für das MD-Audit-Archiv (dort NUR der
  tägliche Ketten-Hash als reiner Prüfwert, kein Klartext) benannt. Klarstellung
  ergänzt: Wund-/BTM-Dokumentation sind Gesundheitsdaten der Klientin/des
  Klienten nach Art. 9 Abs. 1 DSGVO (anders als die Dienstplan-Metadaten, die
  Gesundheitsdaten der Mitarbeiterin/des Mitarbeiters betreffen).
- **Neuer eigener Absatz „Tamper-Resistenz-Unterschied zwischen den beiden
  Modi":** Erklärt wortgetreu den Zielkonflikt — im lokalen Geräte-Modus ist
  die Hash-Kette rein client-seitig, kein externer Zeuge vorhanden, eine
  technisch versierte Person mit Gerätezugriff könnte die Kette in sich
  konsistent neu berechnen (bewusstes Restrisiko für volle Datenhoheit auf
  dem Gerät, keine versehentliche Lücke); im Team-/Mandanten-Modus übernimmt
  der Server diese Zeugenfunktion und schließt die Lücke, zum Preis der
  beschriebenen Metadaten-Offenlegung.
- **Live-Test (Playwright):** Datenschutz-Overlay öffnet, alle 4 neuen
  Textbausteine sind wortgetreu vorhanden, 0 echte Konsolenfehler.
- Deploy: Version `2026-10-10-019` (Client via `deploy-www.sh`). Kein
  Server-/Code-Fix in diesem Nachtrag, reine Text-/Offenlegungsänderung.
- Nächster Schritt: Korrektur-Potenzial-Assessments (#60-63), danach das
  QM-Handbuch (#64, finales Deliverable).

## Nachtrag 2026-10-10 (22) — Korrektur-Potenzial: MRC-Score ergänzt (Abschnitt 16, Task #60)
> Fehlendes Assessment-Instrument aus dem Korrektur-Potenzial der 11-Agenten-
> Review-Kette. Primärquelle verifiziert (WebSearch, mehrere unabhängige
> Treffer konsistent): MRC Muscle Power Scale, 6 Muskelgruppen beidseits
> (Schulterabduktion/Ellenbogenflexion/Handgelenkextension/Hüftflexion/
> Knieextension/Fußheber-Dorsalextension), je 0-5, Summe 0-60, Cutoff <48 =
> ICU-acquired weakness (De Jonghe et al. 2002/2007, etabliertes
> Standardinstrument in der Intensivmedizin).
- Als neues Abschnitt 16 nach dem etablierten Muster der Abschnitte 8-15
  (Auftrag René 2026-09-20) integriert — identisch in `#verlauf-assessment`
  UND `#heute-assessment` (beide DOM-Instanzen teilen dieselbe Datenquelle
  `AE.tage[iso].assessment.mrc`, s. Kommentar bei `renderAssessmentForm`).
  Live-Scoring, eigene Protokollformular-Funktion (`buildMrcProtokoll`,
  druckbar über „Weitere Protokollformulare"), `AE_ASSESS_MAPPING`- und
  Maßnahmen-Legend-Eintrag ergänzt — vollständig analog zu Abschnitt 15.
- Default 5/5 je Muskelgruppe (normale Kraft), nicht 0 — anders als Braden
  (dort ist der Mittelwert der neutrale Default), weil ein MRC-Score nur bei
  tatsächlich durchgeführtem Test sinnvoll ist, der Default also „noch nicht
  auffällig" statt „schon pathologisch" bedeuten soll.
- Hinweistext macht die Erhebungsvoraussetzung explizit: setzt aktive
  Kooperation voraus, bei Sedierung/fehlender Kooperationsfähigkeit nicht
  valide erhebbar (keine falsche Sicherheit durch einen unkritisch
  übernommenen Default-Wert).
- **Live-Test (Playwright):** Abschnitt 16 rendert in Verlauf-Tagesdetail,
  Default-Summe 60/60 korrekt, nach Testfigurierten 7 Nullwerten korrekte
  Summe 25/60, Alert-Klasse UND Cutoff-Hinweistext greifen korrekt unter 48.
  0 echte Konsolenfehler.
- Deploy: Version `2026-10-10-020` (Client via `deploy-www.sh`, reines
  Client-Feature, kein Server-Bezug).
- Nächster Schritt: #61 Dysphagie-Screening (GUSS-ICU — bewusst die
  ICU-spezifische Variante von Claudia Troll et al. 2023 statt des
  klassischen Trapl-2007-GUSS, weil sie besser zur Zielgruppe außerklinische
  Intensivpflege passt, Primärquelle bereits vollständig ausgewertet).

## Nachtrag 2026-10-10 (23) — Korrektur-Potenzial: GUSS-ICU-Dysphagie-Screening ergänzt (Abschnitt 17, Task #61)
> Primärquelle: „Anleitung und Durchführung des Gugging Swallowing Screen für
> die Intensivstation (GUSS-ICU)", Claudia Troll MSc / PhDr. Michaela
> Trapl-Grundschober MAS MSc, 2023 — vollständig per PDF ausgewertet
> (donau-uni.ac.at), inkl. aller Punktwerte, Abbruchregeln und
> Diätempfehlungen. Bewusst die ICU-Variante statt des klassischen
> Trapl-2007-GUSS gewählt, da für außerklinische Intensivpflege (häufig
> post-Extubation/tracheotomiert) klinisch passender.
- **Struktur 1:1 nach Primärquelle:** Voruntersuchung (6 binäre Items: RASS
  0 bis +2, kein Stridor, Husten/Räuspern effektiv, Speichelschlucken
  möglich, kein Drooling, keine Stimmänderung) muss vollständig 6/6 bestanden
  sein, sonst Abbruch (NPO). Direkter Schluckversuch (4 sequenzielle
  Subtests: breiig/flüssig/fest/fest&flüssig) nur bei vorangegangenem
  Subtest unauffällig freigeschaltet — exakte Abbruch-bei-erstem-Auffälligen-
  Logik der Quelle nachgebildet (`toggleWrap`-Kaskade, kein Überspringen
  möglich). Gesamtsumme 0-10.
- **Diätempfehlungs-Bänder** (alle aus der Primärquelle zitiert/abgeleitet,
  bis auf eine bewusst dokumentierte Lücke): 0-5 → NPO + logopädische
  Abklärung ggf. FEES; 6 → NPO; 7 → mittelgradige Schluckstörung, IDDSI 3-4
  Speisen/2-3 Flüssigkeiten; 8 → leichtgradige Schluckstörung, IDDSI 6/7
  Speisen/0 Flüssigkeiten; 10 → minimale/keine Schluckstörung, IDDSI 7
  Speisen/0 Flüssigkeiten. **Für den Zwischenwert 9** (Fest bestanden,
  Fest&Flüssig-Kombination nicht) enthielt die ausgewertete Quelle keinen
  eindeutigen Diätempfehlungs-Text (ein Querverweis „(Punkte 9)" an anderer
  Stelle der Quelle blieb widersprüchlich zur arithmetisch korrekten Summe) —
  bewusst KEINE erfundene IDDSI-Stufe eingetragen, stattdessen ein
  konservativer, klinisch sicherer Hinweistext („kombinierte Aufnahme nicht
  sicher, ärztliche/logopädische Bestätigung vor kombinierter Kostform
  einholen"). Dokumentierte Lücke statt stillschweigender Annahme —
  grimmiges Framing verlangt das Benennen der Unsicherheit, nicht ihr
  Verstecken hinter einer plausibel klingenden Zahl.
- Felder bewusst so benannt, dass `true` immer die unauffällige/sichere
  Antwort ist (vermeidet Vorzeichenfehler bei additiver Summenbildung).
  Default `false` (noch nicht durchgeführt) — NICHT mit „unauffällig"
  verwechselbar, anders als z. B. der MRC-Default.
- Nach demselben Abschnitt-8-15/16-Muster integriert: beide DOM-Scopes,
  eigenes Protokollformular (`buildGussProtokoll`, zeigt „nicht getestet"
  für nicht erreichte Subtests statt eines irreführenden Nein), Mapping-/
  Legend-Eintrag (als `k: true` kritisch markiert — Aspirationsrisiko).
- **Live-Test (Playwright):** sequenzielle Freischaltung korrekt (5/6
  Voruntersuchung hält direkten Test verborgen, erst bei 6/6 sichtbar),
  Summe korrekt bei jedem Zwischenschritt (6→7→10), Diätempfehlungstext
  korrekt pro Stufe, keine Alert-Klasse bei vollen 10 Punkten. 0 echte
  Konsolenfehler.
- Deploy: Version `2026-10-10-021` (Client via `deploy-www.sh`).
- Nächster Schritt: #62 Barthel-Index/FIM.

## Nachtrag 2026-10-10 (24) — Korrektur-Potenzial: Barthel-Index ergänzt (Abschnitt 18, Task #62)
> Entscheidung Barthel-Index statt FIM: FIM (Functional Independence Measure,
> 18 Items, 7-stufig) erfordert eine zertifizierte Schulung zur validen
> Anwendung und ist primär für den US-amerikanischen Reha-Kontext ausgelegt —
> für die direkte Pflegedokumentation in der außerklinischen Intensivpflege
> ohne FIM-Zertifizierung weniger geeignet als der etablierte, frei
> anwendbare Barthel-Index. Primärquelle: Mahoney FI, Barthel DW. Functional
> Evaluation: The Barthel Index. Maryland State Medical Journal 1965;14:61-65
> (Originalpublikation, Item-/Punktwerte per WebSearch kreuzverifiziert,
> zusätzlich das BfArM-gehostete „Hamburger Einstufungsmanual zum
> Barthel-Index" als deutsche Operationalisierungsgrundlage ausgewertet —
> bestätigt ausdrücklich, dieselbe Item-/Punktstruktur zu verwenden, keine
> eigene neue Version).
- **10 Items, additive Summe 0-100** (Essen und Trinken 0/5/10, Baden/Duschen
  0/5, Körperpflege 0/5, An-/Ausziehen 0/5/10, Stuhlkontrolle 0/5/10,
  Harnkontrolle 0/5/10, Toilettenbenutzung 0/5/10, Bett-/Stuhltransfer
  0/5/10/15, Mobilität 0/5/10/15, Treppensteigen 0/5/10) — exakt nach
  Originalpublikation.
- **Interpretations-Bänder bewusst als Sekundärquelle gekennzeichnet**
  (0-30 weitgehend pflegeabhängig, 35-80 hilfsbedürftig, 85-95 punktuell
  hilfsbedürftig, 100 weitgehend selbständig) — anders als die Item-/
  Punktstruktur selbst sind diese Bänder NICHT Teil der Originalpublikation
  von 1965, sondern eine verbreitete, aber nicht einheitlich zitierte
  Sekundärquellen-Konvention (identisches Transparenz-Muster wie bereits bei
  Braden, Abschnitt 12, dokumentiert) — Hinweistext benennt das explizit bei
  jeder Anzeige, kein stillschweigendes Übernehmen einer Zahl als vermeintlich
  „offizieller" Grenzwert.
- Default = volle Punktzahl je Item (100/100, vollständige Unabhängigkeit),
  analog zum MRC-Default — kein Pathologie-Default.
- Nach demselben Abschnitt-16/17-Muster integriert: beide DOM-Scopes, eigenes
  Protokollformular (`buildBarthelProtokoll`), Mapping-/Legend-Eintrag.
- **Live-Test (Playwright):** Default 100/100 korrekt, alle Items auf 0 →
  0/100 mit Alert-Klasse, Grenzfall 30/100 korrekt „weitgehend
  pflegeabhängig", 40/100 korrekt „hilfsbedürftig". 0 echte Konsolenfehler.
- Deploy: Version `2026-10-10-022` (Client via `deploy-www.sh`).
- **Damit sind alle 3 fehlenden Assessment-Instrumente aus dem
  Korrektur-Potenzial ergänzt** (Abschnitte 16-18: MRC-Score, GUSS-ICU,
  Barthel-Index). Nächster Schritt: #63 Design-Token-Drift
  (accent-#B8845A), danach #64 QM-Handbuch (finales Deliverable).

## Nachtrag 2026-10-10 (25) — Korrektur-Potenzial: Design-Token-Drift accent-#B8845A behoben (Task #63)
> Fund: `#B8845A` (mattes Tan-Bronze) wurde ausschließlich für die
> `accent-color` aller Checkboxen verwendet (97 Vorkommen in `index.html`,
> 1 generierte CSS-Regel in `app.css`) — abweichend vom kanonischen
> AERIS-Bronze-Token `#B87333` (Root-CLAUDE.md § Design-Token-Masterübersicht
> „AERIS_BRONZE_GRADIENT", bestätigt an 9 weiteren Stellen in `app.css`:
> `.ae-btn-primary`-Gradient, aktive Tabs/Navlinks/Kalendertage, Druck-
> Trennlinien). Ein isolierter, aber durch 97 Vorkommen weit gestreuter
> Drift-Punkt — vermutlich entstanden, weil Checkboxen in einer früheren
> Session mit einem ähnlichen, aber nicht identischen Bronzeton neu angelegt
> wurden, ohne gegen die Design-Token-Masterübersicht zu prüfen.
- **Fix:** `index.html` — alle 97 `accent-[#B8845A]`-Klassenattribute auf
  `accent-[#B87333]` umbenannt (`sed`, projektweit). `app.css` — die
  generierte Utility-Regel entsprechend umbenannt
  (`.accent-\[\#B87333\]{accent-color:#B87333;}`). Kein Tailwind-Build-Schritt
  im Projekt vorhanden (`package.json` enthält nur Capacitor-Dependencies,
  `app.css` ist eine statische, handgepflegte Datei) — direkte Textersetzung
  ist daher der korrekte, nicht durch einen Rebuild überschreibbare Fix.
- Keine weiteren `#B8845A`-Vorkommen in `index.html`/`app.css`/`app.js`/
  `aeris-fx.css`/`aeris-ui.css` gefunden (grep-verifiziert) — Drift war auf
  genau diesen einen Token beschränkt, keine Geschwister-Abweichungen.
- **Live-Test (Playwright):** berechneter `accentColor` einer echten
  Checkbox im Verlauf-Assessment ist jetzt `rgb(184, 115, 51)` =
  `#B87333` exakt. 0 echte Konsolenfehler.
- Deploy: Version `2026-10-10-023` (Client via `deploy-www.sh`).
- **Damit ist das gesamte Korrektur-Potenzial aus der 11-Agenten-Review-Kette
  abgearbeitet** (Tasks #60-63). Nächster Schritt: #64 QM-Handbuch
  (Agenten-Prüfschema für offizielle Prüfungen/MD/Kasse) — finales,
  explizit von René beauftragtes Deliverable dieser gesamten Session.

## Nachtrag 2026-10-10 (26) — QM-Handbuch: Agenten-Prüfschema (Task #64, finales Deliverable der Session)
> René-Auftrag wortgetreu: „QM - Handbuch: Agenten, selbes Prüfschema, es
> muss Wasserdicht (Prüfsicher)sein für die offiziellen Unternehmens Prüfungen
> und MD/Kasse". Als echtes AERIS-Eigendokument im Brand-Template erstellt
> (nicht nur als interne Session-Notiz) — damit es im realen Audit-Fall
> tatsächlich vorlegbar ist, nicht nur in diesem Protokoll beschrieben wird.
- **Neues Dokument** `dokumente/qm-agenten-pruefschema-handbuch.html`
  (identisches Brand-Template wie alle übrigen AERIS-Eigendokumente), in
  `app.js` (`AE_DOC_QM`-Array) registriert und damit über die Dokumente-Liste
  der App erreichbar.
- **Inhalt (7 Abschnitte):** (1) Prüfarchitektur/Rollentrennung, (2)
  Vier-Augen-Prinzip mit Prüfung gegen die reale Primärquelle statt gegen den
  Bericht der ausführenden Instanz, (3) Primärquellen-Pflicht, (4)
  dreistufige Nachweisführung (Git-Historie, datiertes CLAUDE.md-
  Änderungsprotokoll, automatisierte Tests + Live-Verifikation), (5)
  **Wirksamkeitsnachweis mit echten, nicht beschönigten Funden** (das
  4-Agenten-Audit vom 2026-10-02 mit 3 echten Buchhaltungsfehlern + fehlenden
  Pflichtangaben, UND der heutige Live-Testlauf mit der renderMp-
  Namenskollision + dem FK-Constraint-Löschfehler), (6) **offen benannte
  Grenzen** (lokaler-Modus-Tamper-Resistenz-Kompromiss, PIN-Entropie-
  Schwäche, Sekundärquellen-Charakter der Barthel-/GUSS-Interpretations-
  Bänder, kein Ersatz für zertifiziertes externes QM-System/externe
  Fachprüfung), (7) Bezug zu § 114 SGB XI MD-Qualitätsprüfungsrichtlinien.
- **Grimmiges Framing konsequent angewendet:** das Handbuch behauptet nicht
  pauschal „alles geprüft, alles korrekt" — es belegt die Wirksamkeit des
  Prüfschemas gerade DURCH die dokumentierten echten Funde und benennt die
  verbleibenden Schwächen explizit, statt sie zu verschweigen. Ein Prüfschema,
  das nie etwas findet, beweist nichts — diese Einsicht ist Teil des
  Dokuments selbst (Abschnitt 5, letzter Satz).
- **Live-Test (Playwright):** Direktaufruf des Dokuments rendert korrekt
  (Titel/H1/alle Kern-Abschnitte vorhanden, 0 Konsolenfehler), Dokument ist
  in der App-Dokumentenliste (`#ae-doc-qm-list`) sichtbar und auffindbar.
- Deploy: Version `2026-10-10-024` (Client via `deploy-www.sh`).
- **Damit ist der gesamte René-Auftrag dieser Session vollständig
  abgearbeitet:** alle 8 offenen Entscheidungspunkte geklärt (Nachtrag
  12-15), alle 3 Architektur-Module auf Server-Verankerung umgestellt
  (Nachtrag 17-20), Datenschutzerklärung aktualisiert (Nachtrag 21), alle 4
  Korrektur-Potenzial-Punkte behoben (Nachtrag 22-25), QM-Handbuch erstellt
  (dieser Nachtrag). Tasks #50-#64 vollständig abgeschlossen.

## Nachtrag 2026-10-10 (27) — Weiterer offener Punkt geschlossen: PIN-Entropie/Trivial-PINs (René-Direktive „alle offenen... im Loop mit erledigen")
> Im GOAL-FINALIZATION-REPORT noch als offen geführt: „PIN-Entropie-Schwäche
> im lokalen Modus (4-6-stellig)". Bei der Prüfung zeigte sich: die
> Längen-Schwäche selbst war bereits am 2026-10-09 behoben (René-Direktive,
> neue PINs müssen genau 6 Ziffern haben, s. `aeris-login.js`/`app.js`) — der
> im Bericht übernommene Hinweis war ein veralteter Memory-Stand. Verbleibende
> echte Lücke: eine formal 6-stellige PIN wie „111111"/„123456"/„987654" hat
> real kaum mehr Entropie als eine 1-2-stellige PIN.
- **Fix:** neue Hilfsfunktion `aePinIstTrivial()` (`app.js`) blockt bei NEUER
  PIN (Setup/Migration) alle 6 gleichen Ziffern sowie die auf-/absteigende
  10er-Zahlenreihe. Identische Prüfung dupliziert in `aeris-login.js`
  (`istTrivial()`, UX-Vorverlagerung vor dem eigentlichen Formular-Submit)
  und in `aeris-server.js` (`pinIstTrivial()`, für „Eigene PIN ändern" und
  neue Team-Start-PINs). Bestehende, bereits verschlüsselnde PINs (auch
  kürzere Alt-PINs) bleiben bewusst unverändert entsperrbar — sonst würden
  eigene Geräte ohne Reset-Option ausgesperrt.
- **❌ ECHTER BUG beim ersten Live-Test gefunden:** Die neue Fehlermeldung kam
  im lokalen 2-Schritt-Einrichtungsdialog nie an — der Schritt-1→2-Übergang
  läuft NICHT über das `submit`-Event (das Pflichtfeld „confirm" ist bei
  leerem Wert immer ungültig, native Formularvalidierung unterdrückt das
  Event komplett), sondern über einen `focus`-Handler, den der Browser beim
  blockierten Submit-Versuch auf das Confirm-Feld auslöst. Nur die
  (tatsächlich kaum erreichbare) `onSubmitCapture`-Stelle war ursprünglich
  gefixt, der tatsächlich wirksame `focus`-Handler zeigte weiterhin die alte,
  irreführende Meldung „Bitte eine PIN aus genau 6 Ziffern eingeben." an —
  live per Playwright reproduziert (0 `submit`-Events feuerten überhaupt),
  dann auf die gemeinsame Hilfsfunktion `pinFehlerText()` konsolidiert und an
  beiden Stellen (Submit-Capture UND Fokus-Handler) verdrahtet.
- **Live-Test (Playwright, alle 3 PIN-Erstellungspfade):** lokaler
  2-Schritt-Dialog (trivial „111111"/„123456" abgelehnt, echte PIN „472918"
  führt zu vollständig abgeschlossener Einrichtung + entsperrtem Gate),
  Server-Modus „Eigene PIN ändern" (trivial „999999" abgelehnt, echte PIN
  „384726" angenommen + funktionsfähig — Tenant-Löschung mit der NEUEN PIN
  danach erfolgreich), Server-Modus Team-Start-PIN (trivial „111111"/
  „123456" abgelehnt, echte PIN „693410" akzeptiert). 0 echte Konsolenfehler
  in allen drei Testläufen.
- Deploy: Version `2026-10-10-027` (Client via `deploy-www.sh`, reines
  Client-Feature, kein Server-Code betroffen). Produktions-DB nach allen
  Testläufen bereinigt.
- **Lektion (erneut, wie schon bei Nachtrag 16/17):** „sollte funktionieren,
  Logik ist korrekt" ersetzt keinen echten Testlauf — die Submit-vs-Focus-
  Verzweigung war beim reinen Code-Lesen nicht offensichtlich, erst die
  Playwright-Reproduktion (0 `submit`-Events) legte den tatsächlichen Pfad offen.

## Nachtrag 2026-10-10 (28) — Korrektur-Potenzial geschlossen: GUSS-ICU-Score-9-Lücke + echter IDDSI-Fehler bei Score 8 behoben
> Im GOAL-FINALIZATION-REPORT als Korrektur-Potenzial genannt: „GUSS-ICU-
> Zwischenwert 9 ... mit einer zweiten Fachquelle gegenprüfen". Weitergehende
> Primärquellen-Recherche fand die vollständige, bislang nicht ausgewertete
> OFFIZIELLE Rückseiten-Tabelle „GUSS-ICU-EVALUATION" (`GUSS_ICU_English.pdf`,
> donau-uni.ac.at, Troll C, Trapl-Grundschober M, Teuschl Y, Cerrito A, Compte
> MG, Siegemund M. A bedside swallowing screen for the identification of
> post-extubation dysphagia on the intensive care unit — validation of the
> Gugging Swallowing Screen (GUSS)-ICU. BMC Anesthesiol. 2023;23:122) — exakt
> dieselbe Publikation, die schon als Primärquelle für Abschnitt 17 diente,
> nur bisher nicht vollständig (inkl. Rückseite) ausgewertet.
- **Score 9 jetzt vollständig belegt** (vorher bewusst dokumentierte Lücke mit
  konservativem Platzhaltertext): „Semisolids passed, fluids passed, solids
  passed, mixed textures failed (mild dysphagia, low risk)" → Kost weich/
  mundgerecht oder leicht kaubar (IDDSI 6 oder 7 EC), gemischte/schwer
  kaubare Konsistenzen vermeiden, Flüssigkeiten IDDSI 0.
- **❌ Dabei zusätzlich echten Fehler bei Score 8 gefunden:** die bisherige
  Implementierung nannte „IDDSI 6/7", die offizielle Tabelle nennt „IDDSI 5
  oder 6" (fein passiert/weich, mundgerecht) — ein eigenständiger,
  unabhängig von der Score-9-Lücke bestehender Korrektheitsfehler, der ohne
  diese vertiefte Recherche unentdeckt geblieben wäre.
- **Alle Stufen (0-6/7/8/9/10) auf den wörtlichen offiziellen Text
  umgestellt**, inkl. bisher fehlender klinisch relevanter Details: „keine
  flüssigen Medikamente" bei Score 7, „Tabletten zerkleinert in Püree" bei
  Score 7, Wiederholungsempfehlung „frühestens nach 4 Stunden" bei
  NPO-Stufen, „erste normale Mahlzeit unter Aufsicht" bei Score 10.
- **Code-Konsolidierung:** neue gemeinsame Funktion `aeGussStufe(vorSumme,
  vorBestanden, gesamt)` ersetzt die bisher zweifach (Live-Anzeige UND
  Druckprotokoll) duplizierte Stufentext-Logik — verhindert strukturell ein
  künftiges Auseinanderlaufen beider Stellen (genau die Fehlerklasse, die bei
  Score 8 schon einmal unbemerkt hätte entstehen können).
- **Live-Test (Playwright):** Score 9 zeigt jetzt die vollständige, nicht
  mehr gehedgte Empfehlung; Score 10 korrekt. Druckprotokoll nutzt dieselbe
  Funktion, daher strukturell identisch (Button-Klick im Test an einem
  eingeklappten `<details>`-Element gescheitert — Testnavigationsproblem,
  kein App-Fehler, durch die Code-Konsolidierung ohnehin redundant
  geworden). 0 echte Konsolenfehler.
- Deploy: Version `2026-10-10-028` (Client via `deploy-www.sh`).
- **Lektion:** Eine als „aus der Primärquelle nicht eindeutig zu entnehmen"
  dokumentierte Lücke ist ein Signal, noch einmal gezielter nach der
  vollständigen Quelle zu suchen (hier: das offizielle Rückseitenformular
  als separates PDF), nicht ein Dauerzustand — und eine solche vertiefte
  Nachrecherche kann nebenbei eigenständige, bis dahin unbemerkte Fehler
  aufdecken.

## Nachtrag 2026-10-10 (29) — Korrektur-Potenzial geschlossen: Barthel-Interpretationsbänder zweitquellen-gegengeprüft
> Letztes im GOAL-FINALIZATION-REPORT genanntes Korrektur-Potenzial-Item:
> „Barthel-Interpretationsbänder mit einer zweiten Fachquelle gegenprüfen".
- Eine zweite, von der ursprünglich verwendeten unabhängige Quelle liefert
  identische Grenzwerte (0-30 weitgehend pflegeabhängig, 35-80
  hilfsbedürftig, 85-95 punktuell hilfsbedürftig, 100 weitgehend
  selbständig) — Zweitquellen-Gegenprüfung damit erledigt, keine
  Code-/Text-Änderung nötig (die bereits implementierten Bänder waren
  bereits korrekt, jetzt nur zusätzlich bestätigt).
- **Zusätzlicher Fund, bewusst NICHT übernommen:** das offizielle
  BAR-Phasenmodell (Bundesarbeitsgemeinschaft für Rehabilitation) nutzt für
  die neurologische Reha-Phaseneinteilung (Phase B/C/D/E) andere
  Barthel-Bänder (0-25/30-70/75-100) — das ist ein zweckgebundenes
  Klinik-Aufnahmekriterium für eine andere Fragestellung (stationäre
  Reha-Phasenzuordnung), kein allgemeiner Pflegeabhängigkeits-Maßstab für
  die laufende häusliche AERIS-Dokumentation. Bewusst nicht als
  Verwirrungsquelle zusätzlich in die App übernommen, aber als
  Code-Kommentar dokumentiert, falls künftig relevant.
- Deploy: Version `2026-10-10-029` (reine Kommentar-/Dokumentationsänderung,
  kein Nutzerverhalten betroffen, kein eigener Live-Test nötig).
- **Damit sind alle Punkte aus dem [OFFEN]- UND [KORREKTUR-POTENZIAL]-
  Abschnitt des vorherigen GOAL-FINALIZATION-REPORTs abgearbeitet.**

## Offene Entscheidungen (an René)
1. Soll `aeris-web` (Landingpage) ebenfalls importiert und demselben Silo zugeordnet werden?
2. Eigentumsklärung ggü. GitHub-Org (`Renekrieg1401` persönlich vs. `YNA-Digital`)?
3. ~~Gilt die globale Logo-Governance-Pflicht für AERIS noch?~~ — **GESCHLOSSEN,
   2026-10-10, René-Entscheidung:** AERIS ist markenrechtlich eigenständig (eigene
   3-stufige GmbH-Holding) — die IRIS-Digital-Logo-Governance-Pflicht gilt hier
   NICHT. Die bestehende Abwesenheit jeder „IRIS Digital"-Erwähnung im AERIS-Code
   (0 Treffer) ist damit korrekt, keine Nachbesserung nötig.
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
6. ~~Echtes CA-Zertifikat statt selbstsigniert~~ — **GESCHLOSSEN, 2026-10-10,
   René-Entscheidung:** Bleibt bewusst privat/selbstsigniert, keine öffentliche
   Domain. Bekannte, akzeptierte Konsequenz: Service Worker (`sw.js`) registriert
   sich bei keinem echten Besucher (Browser verweigern SW bei selbstsignierten
   Zertifikaten ausnahmslos), Offline-Caching bleibt wirkungslos — App funktioniert
   davon unabhängig normal weiter (Fehler ist abgefangen).
7. **Echte Tamper-Resistenz für BTM-/Medizinprodukte-/Wunden-/MD-Archiv-Hash-Ketten**
   (`security-privacy`-Fund Runde 2, 2026-10-10, Nachtrag 6) — alle vier Module liegen
   im mutable, client-seitig vollständig kontrollierbaren Blob, nicht wie der
   Dienstplan in einer echten Server-Tabelle. Jede dokumentierende Person kann die
   eigene Historie lokal umschreiben und neu hochladen, ohne dass der Server das
   erkennt. Bei BTM besonders relevant (§ 13/14 BtMVV verlangt gerade Tamper-
   Resistenz gegen die dokumentierende Person). Eine echte Lösung (z. B. Server-
   Tabellen analog `dienst_eintraege`) würde BTM-/Wunddaten unverschlüsselt
   server-seitig ablegen müssen — ein erheblicher Eingriff in das Zero-Knowledge-
   Prinzip, keine reine Technik-Entscheidung. UI-Formulierungen wurden bereits ehrlich
   korrigiert (kein Fix der Lücke selbst, nur der vorher überzeichneten Behauptung).
8. **Institutionelle Reichweite von § 13 BtMVV für ARIS' konkreten Betrieb klären**
   (`legal-compliance`-Fund Runde 2, 2026-10-10, Nachtrag 7) — § 1 Abs. 3 BtMVV listet
   namentlich Alten-/Pflegeheime, Arzt-/Zahnarztpraxen, Krankenhäuser, Hospize/SAPV,
   NICHT ambulante Intensivpflegedienste allgemein. § 5 Abs. 9 (möglicher Einbezug)
   gilt nur für Substitutionsmittel (Suchttherapie), nicht allgemeine Schmerz-/
   Sedierungsmedikation. Ob der konkrete AERIS-Betrieb über einen anderen Weg erfasst
   ist (z. B. Hospiz-/SAPV-Status, eine bestehende Vereinbarung mit einer
   verordnenden Praxis o. Ä.), kann nur René/der Betrieb selbst beurteilen — reine
   Primärquellen-Lektüre reicht dafür nicht. UI wurde bereits ehrlich auf „internes,
   orientiertes Kontrollinstrument" statt unqualifizierter Rechtsbehauptung
   korrigiert, bis diese Frage geklärt ist.

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
