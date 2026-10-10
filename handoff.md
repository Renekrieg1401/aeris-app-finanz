# Handoff — AERIS (2026-10-09, Multi-User-/Mandanten-Server-Backend)

## Session 2026-10-09 — AERIS Doku: Multi-User-/Mandanten-Architektur (neues Server-Backend)
- **Auftrag:** René-Direktive nach PIN-Screenshot-Fund — mehrere Mitarbeiter müssen sich vor Ort
  eigenständig einloggen, isoliert dokumentieren (eigener Export ohne fremde Namen), Software muss
  mandantenfähig sein (mehrere Unternehmen, keine Datenvermischung), Dienstplan mehrbenutzerfähig
  mit „nächster Dienst"/Krankmeldung/Ausfallmanagement, manipulationssicher bei Firmen-Nutzung.
- **Architekturentscheidung (per AskUserQuestion geklärt):** echtes Server-Backend auf dem
  bestehenden privaten vServer (212.132.117.130) statt nur lokaler Geräte-Profile — einzige
  Variante mit echter Zugriffskontrolle statt bloßer Obfuskation.
- **Vollständige Details:** `CLAUDE.md` § „Multi-User-/Mandanten-Architektur" (Datenmodell,
  Krypto-Prinzip, alle bestandenen Verifikationen inkl. Cross-Tenant-Isolationstest).
- **Kurzfassung ERLEDIGT:** `server/` (Express/SQLite/JWT, systemd-Service `aeris-server`),
  `aeris-server.js` (Login-Umschaltung, Team-Verwaltung, Mehrbenutzer-Dienstplan,
  Krankmeldung+Ausfallmanagement, „Meine Dokumentation"-Export, „Eigene Dokumente" pro Mandant).
  Nginx-Fix: `/api/*` kollidierte mit Basic-Auth (gefunden+behoben). Alles per echtem
  Playwright-Lauf gegen den Live-Server verifiziert, nicht nur Code-Review.
- **OFFEN (ehrlich, nicht vergessen):** Admin-Passwort-Reset-UI (Server-Endpoint existiert,
  Oberfläche fehlt), Offline-Nutzung im Server-Modus ungelöst, „Eigene Dokumente" nur Text
  (kein PDF-Upload), kein Server-seitiges Theming/Weißlabel (nur Firmendaten+Dokumente anpassbar).
- **Nächster Schritt:** Commit+Push (folgt direkt im Anschluss an diesen Eintrag), danach echter
  Gerätetest mit René als erstem Admin-Account auf einem echten Tablet/Telefon vor Ort.

## Nachtrag 2026-10-09 (2) — Offene Punkte erledigt
Admin-Passwort-Reset-UI + Selbstbedienung "Meine PIN ändern", PDF-Upload für Eigene
Dokumente (+ Nginx-`client_max_body_size`-Bug behoben), Mandanten-Branding (Kurzname+Logo,
bewusst ohne Akzentfarbe), zweigeteilter Offline-Modus (Sync-Retry bei Verbindungsabbruch
+ schreibgeschützter Kaltstart-Fallback). Details: `CLAUDE.md` § Nachtrag 2026-10-09 (2).
Alles per echtem Playwright-Lauf verifiziert.

`security-privacy`-Gegenprüfung (unabhängiger Agentenlauf) durchgeführt: 5/7 Punkte ✅,
2 echte Funde (kein Rate-Limiting gegen Login-Brute-Force / Token im Offline-Cache)
— beide noch am selben Tag behoben und per echtem Lasttest bzw. Playwright-Lauf
verifiziert. Details: `CLAUDE.md` § Nachtrag 2026-10-09 (3).

## Nachtrag 2026-10-09 (4) — Korrektur-Potenziale erledigt + 2 neue Funde + Bugreport
- Rate-Limiting jetzt persistent (SQLite), committete Testsuite + CI (`server/test/`,
  13 Tests, `.github/workflows/server-test.yml`) -- schließt beide vorherigen
  Korrektur-Potenziale. Dabei gefunden+behoben: Schema-Migrationslücke (neue Spalten
  kamen auf bereits existierenden DB-Dateien nicht an, jetzt additive Auto-Migration).
- **Pflicht-PIN-Wechsel** (René-Direktive): Admin-vergebene/zurückgesetzte PIN ist
  Einmal-PIN, MA muss sie beim ersten Login sofort selbst ändern, kein Umgehen möglich,
  kein Datenverlust (DEK bleibt gleich). Verifiziert.
- **Akuter Bugreport behoben:** Mac-Desktop-App sprang beim Fenster-Resize/Vollbild auf
  die Login-Maske (macOS/Electron-`visibilitychange`-Eigenart) UND hätte dabei laufende,
  ungespeicherte Formular-Eingaben gelöscht (`aeRunInit()` lief fälschlich bei jedem
  Relock). Beide Ursachen behoben + verifiziert. Mac-App neu gebaut/installiert.
- Details: `CLAUDE.md` § Nachtrag 2026-10-09 (4).

## Nachtrag 2026-10-09 (5) — Login = Dienstbeginn + persönliche Zeiterfassung
Login stempelt jetzt automatisch Dienstbeginn (Server-Modus), Dienstende bleibt manuell
wie bisher. Dabei echten Architektur-Fund behoben: der bisherige geteilte Von/Bis-Slot
pro Kalendertag hätte eine zweite Person am selben Tag leer ausgehen lassen -- neues
`tag.zeiterfassung`-Array mit echtem Eintrag pro Person. Neue Karte „Meine
Zeiterfassung" in der Dienstplanung (Letzte 30 Tage / bestimmter Monat, mit
Stundensumme). Per echtem Zwei-Nutzer-Test verifiziert. Details: `CLAUDE.md` §
Nachtrag 2026-10-09 (5).

## Nachtrag 2026-10-09 (6) — Update-Button im Header
Alter sofort aufpoppender Update-Banner entfernt, ersetzt durch grauen Header-Button, der
erst bei erkannter neuer Version golden aufpoppt. Klick öffnet Overlay mit echten
Änderungen (neue Datei `changelog.json`), Annehmen lädt neu, Ablehnen schließt folgenlos.
Dabei Versions-Drift behoben (`AKTUELLE_VERSION`/`APP-VERSION` hingen seit dem
02.10. hinterher, jetzt auf `2026-10-09-016` vereinheitlicht — künftig bei jedem
Versions-Bump mitziehen). Details: `CLAUDE.md` § Nachtrag 2026-10-09 (6).

## Nachtrag 2026-10-09 (7) — Genau 6 Ziffern PIN-Pflicht
Neue PINs (Einrichtung/Reset/Änderung) brauchen jetzt exakt 6 Ziffern, client- und
serverseitig. Bestehende PINs (Login/Entsperren, Backup-Wiederherstellung) bleiben bewusst
4-6-stellig kompatibel, sonst wären ältere kürzere PINs ohne Reset-Möglichkeit ausgesperrt
gewesen. Dabei echten UX-Fund entdeckt+behoben: der Schritt-1→2-Wechsel im PIN-Ziffernblock
zeigte bei ungültiger Eingabe bisher gar keinen Hinweis, sprang nur stumm zurück. Details:
`CLAUDE.md` § Nachtrag 2026-10-09 (7).

**Einzig noch offen: Real-Device-Test (iPhone) mit René selbst** — aus dieser Umgebung
weder per USB noch WLAN erreichbar, braucht René aktiv am Gerät.

---

# Handoff — AERIS (2026-10-04)

## Nachtrag 2026-10-04 — PDF-Links + 4 UI/Logik-Fixes nach René-Screenshots
- **Dokumente: echte PDF-Links statt Text-Quelle (René-Fund „keine Dokumente zur
  Einsicht vorhanden"):** 30 reale Original-PDFs aus der AKI-Dokumentenablage
  (iCloud) nach `dokumente/` im Repo kopiert (37 MB), `renderDocList()` zeigt
  jetzt „Original öffnen (PDF) →" als echten Link statt reinem Dateinamen-Text.
  Die eine selbst erstellte Datei (B2B-Übergabeblatt) bleibt ohne Link (kein
  Original vorhanden). Alle 30 Links per Playwright gegen echten HTTP-Request
  geprüft (200, gültiges PDF-Signatur-Byte) — 0 Fehler.
- **Dienstbeginn/-ende fälschungssicher:** `<input type="time">` (frei
  editierbar) ersetzt durch Button „Jetzt stempeln" — übernimmt beim Klick die
  Systemzeit (`nowHm()`), sperrt sich danach (Anzeige statt Eingabefeld).
  Korrektur weiterhin nur über Verlauf → Tagesdetail möglich (bestehender,
  unveränderter Pfad). Betrifft nur die „Heute"-Live-Erfassung, nicht die
  Verlauf-Nacherfassung vergangener Tage.
- **Fahrt-Zweck als Dropdown:** freies Textfeld ersetzt durch Auswahl
  (Pflegeeinsatzort/Arztgespräch/Materialbeschaffung/Apotheke/Budget-
  konferenz/Behördengang/Fortbildung/Teamübergabe/Sonstiges), bei „Sonstiges"
  erscheint ein Freitextfeld.
- **Stundensatz-Default 105→115 €:** war im Code-Default noch der alte Wert
  (Rechnung zeigte 105,00 €) — auf den seit der Honorarbegründung/Business-
  plan-Arbeit etablierten Satz 115 €/Std. korrigiert (Settings-Default +
  Fallback-Parsing). Bereits bestehende lokale Testdaten mit 105 € müssen
  einmalig manuell in Einstellungen nachgezogen werden.
- **Leistungsnachweis-Tabelle bereinigt:** Spalten „Zeitraum" (Von–Bis) und
  „Status" (Offen/Gegengezeichnet/Versiegelt) entfernt — Status ist ein
  interner Gegenzeichnen-Workflow, kein sinnvoller Inhalt für ein
  Kostenträger-/MD-Dokument; Zeitraum war redundant zur Std.-Spalte.
  Stundenberechnung (`shiftStunden`) unverändert, weiterhin echt zeitbasiert.
- Alle fünf Punkte gemeinsam per Playwright verifiziert, 0 Fehler.

## Dokumente-Bereich (AERIS Doku) — neu
Neue Homepage-artige Übersichtsseite (`#dokumente`, Nav: Sidebar + Desktop-
Rail „Wissen") mit 3 Kategorie-Overlays im bestehenden DNQP-Akkordeon-Muster:
Expertenstandards/Leitlinien (12), QM/Sicherheit (16), Klinisches
Nachschlagewerk/Doku-System (3) — 31 Einträge gesamt, kuratierte Kernpunkte
+ Quellenverweis statt Volltext-Dump. Dateiauswahl per Fork inhaltlich aus
der AKI-Dokumentenablage (iCloud) trianger, nicht nur nach Dateinamen.
AWMF-Leitlinie 001-025 primärquellen-geprüft (V4.1, gültig bis 08/2026,
Überarbeitung angemeldet, sichtbar markiert) — 001-016 bewusst
ausgeschlossen (falsche Zielgruppe: Herzchirurgie statt außerklinische
Intensivpflege). `AERIS_B2B_Schnittstellen_Uebergabeblatt.pdf` fehlte als
Datei trotz Master-Index-Referenz — Inhalt neu erstellt (abgeleitet aus dem
bestehenden Schicht-Übergabeprotokoll, auf 1 Seite verdichtet).

René-Fund per Screenshot: Titel zeigten literal „&amp;" statt „&"
(Doppel-Escaping — escapeHtml() lief über bereits manuell escapte Strings).
Behoben (Commit `a044b5d`), per Playwright erneut bestätigt (kein
literales „&amp;" mehr im gerenderten Text).

Alle Commits gepusht (`bec1d66`, `8c2d176`, `a044b5d`).

## Stand
Steuerberater-Lesezugang in AERIS Buch (`buchhaltung/`) fertig implementiert
und per echtem End-to-End-Playwright-Lauf verifiziert (0 Konsolenfehler):
echte AERIS-Doku-PIN angelegt → AERIS Buch entsperrt → Steuerberater-PIN in
Einstellungen gesetzt → App gesperrt → Steuerberater-PIN am normalen Gate
eingegeben → Haupt-Entschlüsselung schlägt korrekt fehl, Fallback öffnet
isolierte Lese-Ansicht (`#stb-view`/`#stb-frame`), Haupt-App (`#app`) bleibt
dabei nachweislich verborgen. „Abmelden" kehrt korrekt zum Gate zurück.

## Architektur
- Separate, unabhängig verschlüsselte STATISCHE Momentaufnahme
  (`KEY_STB='ae-buchhaltung-stb-v1-enc'`, eigenes Salt/PIN, PBKDF2 150k +
  AES-256-GCM) — kein Zugriff auf Live-Daten oder AERIS Doku.
- Inhaber setzt PIN unter Einstellungen → Steuerberater-Zugang, teilt sie
  selbst mit (Mail/Telefon) — kein automatischer Mailversand gebaut (nicht
  gefordert).
- GmbH-Ebene (Grundgehalt/bAV/Firmenwagen/Hebesatz/Rentenziel) ist in der
  Momentaufnahme enthalten und auch im Demo-Modus funktionsfähig
  (`demoDaten()` befüllt `fin.settings.gmbh`).

## Nachtrag 2026-10-03
- Sichtbarer Gate-Button „Ich bin Steuerberater/-in →" ergänzt (vorher nur
  stiller PIN-Fallback — René-Fund per Screenshot).
- „Zugang per E-Mail anfragen"-Mailto-Link im Steuerberater-Gate-Modus
  (an `r.krieg.home@gmail.com`, kein neuer Server).
- PIN-Übergabe läuft jetzt über eine separate, mit einem frei wählbaren
  Mandats-Aktenzeichen verschlüsselte HTML-Datei (nicht mehr nur
  mündlich/Mail-Klartext) — Datei und Aktenzeichen getrennt übermitteln.
- Alle drei Punkte per Playwright verifiziert (inkl. Standalone-Datei
  isoliert über `file://`).
- **Umbau zu echten Zwei-Funktionen-Tabs (René-Vorgabe):** Steuerberater-
  Bereich auf dem Gate ist jetzt ein Segment „Login | Anfrage" statt eines
  einzelnen Umschalters. „Anfrage" hat ein eigenes E-Mail-Feld, baut daraus
  den Mailto-Text (inkl. Absender-Mail), „Login" ist die bestehende
  Keypad-Eingabe. Steuerberater-PIN jetzt zwingend genau 6-stellig (vorher
  4–6, wie die Haupt-PIN) — Validierung an beiden Stellen (Einrichtung +
  Login) verschärft. End-to-End per Playwright bestätigt (0 Fehler).
- **PIN-Generator in den Einstellungen (René-Vorgabe):** Button „PIN
  automatisch generieren" in der Steuerberater-Zugang-Karte —
  kryptografisch unverzerrte 6-stellige PIN (`randomSechsstelligePin()`,
  Rejection-Sampling gegen Modulo-Bias), füllt beide PIN-Felder sichtbar.
  Beim Absenden wird sie wie gehabt automatisch im System hinterlegt
  (`steuerberaterZugangSpeichern`) UND in die herunterladbare, mit dem
  Mandats-Aktenzeichen verschlüsselte Übergabe-Datei eingebettet. End-to-
  End per Playwright bestätigt: generierte PIN funktioniert direkt für den
  Steuerberater-Login UND steckt exakt so in der Übergabe-Datei — 0 Fehler.
- **Kanzlei-E-Mail-Feld (René-Vorgabe, nach Rückfrage zum mailto-Limit
  geklärt):** mailto: kann grundsätzlich keine Datei anhängen (Browser-
  Sicherheitsgrenze, kein Claude-Limit) — daher: neues Feld
  `#stb-kanzlei-email` (persistiert in `S.fin.settings.stbEmail`), beim
  Absenden wird wie gehabt die verschlüsselte Datei heruntergeladen UND
  automatisch ein Mail-Entwurf an die Kanzlei-Adresse geöffnet (Betreff/Text
  vorausgefüllt, Hinweis zum manuellen Anhängen). Playwright-bestätigt:
  0 Fehler, App bleibt stabil, E-Mail-Adresse bleibt über Sitzungen hinweg
  gespeichert/vorausgefüllt.

## Offen
- Kein Commit/Push dieser Änderungen bisher (nur lokal).
- `legal-compliance`/`security-privacy`-Gegenprüfung des neuen Features noch
  nicht angefordert (Komplexitäts-Gate: nur auf explizite René-Freigabe).
- Vier-Augen-Prinzip für `app.js`/`index.html`-Änderungen noch nicht über
  einen separaten Agenten gelaufen — Verifikation bisher direkt durch Claude
  via Playwright.

## Nachtrag 2026-10-09 (9) — Agenten-Prüfkette 6/11: accessibility-a11y
2 echte WCAG-AA-Kontrastfehler behoben (Bronze-Links `#B87333`→`#E8C39E` an 4 Stellen,
Update-Button-Text bekam Halo statt des unvollständigen Agentenvorschlags — Details inkl.
eigener Nachrechnung: `CLAUDE.md` § Nachtrag (9)). Deploy `2026-10-09-023`, commit+push folgt.
Nächster Schritt: Agenten-Review 7/11 (business-finance), strikt sequenziell weiter.

## Nachtrag 2026-10-09 (10) — Agenten-Prüfkette 7/11: business-finance
1 echter Fund behoben: SKR-Kontenfehler (Privatleistungen/Reisekosten) lebte in
app.js unabhängig von der buchhaltung/app.js-Korrektur vom 2026-10-02 weiter —
der damalige Gegenprüf-Abschluss "4/4 ✅" war unvollständig. Details: CLAUDE.md
§ Nachtrag (10). Deploy 2026-10-09-024, commit+push folgt.
Nächster Schritt: Agenten-Review 8/11 (brand-marketing), strikt sequenziell weiter.

## Nachtrag 2026-10-09 (11) — Agenten-Prüfkette 8/11: brand-marketing
1 Fund behoben (Theme-Color-Abweichung buchhaltung/manifest.json). 1 echte
Markenfrage NICHT eigenmächtig entschieden: fehlt IRIS-Digital-Fußzeilen-
Attribution gewollt (Eigentumslage AERIS vs. IRIS Digital ungeklärt) oder
Lücke? Neuer Punkt 3 in "Offene Entscheidungen an René". Details: CLAUDE.md
§ Nachtrag (11). Deploy 2026-10-09-025, commit+push folgt.
Nächster Schritt: Agenten-Review 9/11 (devops-infra), strikt sequenziell weiter.

## Nachtrag 2026-10-09 (12) — Agenten-Prüfkette 9/11: devops-infra
3 echte Funde behoben (NODE_ENV=production, globaler Error-Handler+Graceful-
Shutdown in server/server.js, neues server/deploy.sh inkl. .service-Datei-Sync
nach /etc/systemd/system/ — wurde bisher übersehen). 1 Fund offen (macOS-Code-
Signing braucht Apple-Developer-Account von René, neuer Punkt 4 in "Offene
Entscheidungen"). Nebenbefund: lokales npm test kaputt (Node v26.4.0 lokal vs.
v22.23.3 auf dem Server, better-sqlite3-Kompilierungsproblem) — Produktivserver
unbetroffen. Details: CLAUDE.md § Nachtrag (12). Alles live am Server verifiziert
(systemctl-Logs bestätigen SIGTERM-Handler).
Nächster Schritt: Agenten-Review 10/11 (quality-management), strikt sequenziell weiter.

## Nachtrag 2026-10-09 (13) — Agenten-Prüfkette 10/11: quality-management
2 echte Prozessverstöße gefunden, beide behoben: Root-_MAINTENANCE-MANIFEST.md
war seit 2026-10-04 nicht aktualisiert (nachgeholt), "Real-Device-Test iPhone"
war stillschweigend aus der Offene-Punkte-Liste gefallen (wiederhergestellt,
Punkt 5). Details: CLAUDE.md § Nachtrag (13).
Nächster Schritt: Agenten-Review 11/11 (product-acceptance) — letzter, ganzheitlicher
Agent der Kette.

## Nachtrag 2026-10-09 (14) — Agenten-Prüfkette 11/11 (LETZTE Instanz): product-acceptance
VERDIKT: SUCCESS MIT VORBEHALTEN, kein Blocker. Wichtigster Fund: Service Worker
registriert sich auf dem aktuellen Deployment bei NIEMANDEM (selbstsigniertes
Zertifikat, Browser-Sicherheitsregel ohne Ausnahme) -- korrigiert eine frühere
"0 Konsolenfehler"-Aussage, App läuft trotzdem normal (Fehler abgefangen). Neuer
Punkt 6 in "Offene Entscheidungen an René". 2 kleinere Design-Nuancen geprüft,
bewusst nicht geändert (Zeiterfassung nur im Server-Modus, AERIS-Buch-Link-Icon).
Details: CLAUDE.md § Nachtrag (14).

## DAMIT IST DIE VOLLSTÄNDIGE 11-AGENTEN-PRÜFKETTE ABGESCHLOSSEN (2026-10-09)
testing-qa, security-privacy, legal-compliance, pflege-diagnostik, pflege-assessment,
accessibility-a11y, business-finance, brand-marketing, devops-infra, quality-management,
product-acceptance -- alle 11 strikt sequenziell gelaufen, jeder mit echten Funden,
alle Code-Fixes sofort behoben+deployed+committed+gepusht. Offene Punkte (nicht
eigenmächtig entscheidbar) in CLAUDE.md § "Offene Entscheidungen an René" gesammelt
(6 Punkte, u. a. AVV-Vertrag, Tenant-Löschmechanismus, IRIS-Digital-Markenfrage,
Apple-Developer-ID, Real-Device-Test, echtes CA-Zertifikat).

## Nachtrag 2026-10-09 (15) — Apple-Dev-Account-Korrektur + Icon-Fix
René-Korrektur übernommen: Apple-Developer-Account-Eskalation war überzogen
(AERIS ist primär PWA, Electron-Wrapper nur für Renés eigenen Mac, dort schon
per xattr gelöst) — Punkt in "Offene Entscheidungen" geschlossen. AERIS-Buch-
Link-Icon auf neutralen Chevron geändert (vorher faelschlich "extern"-Symbol
bei tatsaechlich Same-Tab-Navigation). Version 2026-10-09-026.

## Nachtrag 2026-10-10 (1) — BTM-Nachweisbuch als eigenständiges digitales Modul
Erstes von drei fehlenden Modulen (BTM-Nachweisbuch, ICW-Wunddokumentation,
Medizinproduktebuch — René-Auftrag) umgesetzt. Primärquelle §13/14 BtMVV
verifiziert, Präparate-Verwaltung + Bestandsführung + hash-verkettete
Nachweis-Kette (gleiche Technik wie MD-Archiv) gebaut. Echter Playwright-Test
bestätigt: Bestand korrekt berechnet, Kette intakt, Typ-Umschaltung
funktioniert. Ein Bug beim Bauen selbst gefunden+behoben (ReferenceError bei
fehlendem Präparat). Version 2026-10-10-001. Details: CLAUDE.md § Nachtrag.
Nächster Schritt: Medizinproduktebuch (2. von 3, MPBetreibV), dann
ICW-Wunddokumentation (3. von 3).
