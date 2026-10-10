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

## Nachtrag 2026-10-10 (2) — Medizinproduktebuch als eigenständiges digitales Modul
Zweites von drei Modulen fertig. Primärquelle §12/13/14/15 MPBetreibV verifiziert
-- dabei DURCHGÄNGIG falsche Paragraphenzitate in der bestehenden statischen
Vorlage-Datei gefunden (gegen ältere MPBetreibV-Fassung geschrieben) und auf
6 Stellen korrigiert. Neues Modul: Bestandsverzeichnis + 5 Eintrag-Typen +
automatische Fälligkeits-Ampel (STK/MTK überfällig-Erkennung) + Hash-Kette.
Echter Playwright-Test bestätigt alle Funktionen. Version 2026-10-10-002.
Details: CLAUDE.md § Nachtrag.
Nächster Schritt: ICW-Wunddokumentation (3/3, letztes Modul).

## Nachtrag 2026-10-10 (3) — ICW-Wunddokumentation: alle 3 Module fertig
Drittes und letztes Modul fertig. ICW-Primärquelle (MarkItDown-PDF-Auswertung)
ist ein Terminologie-Glossar, kein starres Scoring-Schema -- ehrlich so
umgesetzt (strukturelle Felder ICW-verifiziert, Mengenkategorien als
"gängige Praxis" gekennzeichnet). Wund-REGISTER (mehrere Wunden parallel,
chronologischer Verlauf) ergänzt die bestehende TIME-Tagesmomentaufnahme,
ersetzt sie nicht. Echter Playwright-Test bestätigt Heilungsverlauf-Tracking
funktioniert. Version 2026-10-10-003.

ALLE DREI René-beauftragten Module fertig: BTM-Nachweisbuch, Medizinproduktebuch,
ICW-Wunddokumentation. Details je Modul: CLAUDE.md § Nachtrag 2026-10-10 (1)-(3).
Offen für alle drei: kein Fachagenten-Review (legal-compliance/pflege-diagnostik/
security-privacy) -- dringend empfohlen vor Praxiseinsatz mit echten Daten.

## Nachtrag 2026-10-10 (4) — "Alles offene erledigen": CORS, journald, Tenant-Löschung
3 echte Technikpunkte behoben (CORS-Origin-Einschränkung, journald-Log-Rotation,
echter Tenant-Löschmechanismus Art. 17 DSGVO mit PIN-Bestätigung). Alle 3 per
echtem Playwright-Lauf verifiziert, inkl. echter serverseitiger Löschung (401
bei Login-Versuch danach). 5 reine Entscheidungsfragen bewusst NICHT
eigenmächtig entschieden (Details: CLAUDE.md § Nachtrag). Version 2026-10-10-004.
Nächster Schritt: komplette 11-Agenten-Prüfkette erneut, strikt sequenziell,
diesmal explizit auch auf FEHLENDE Funktionalität prüfen (René-Auftrag).

## Nachtrag 2026-10-10 (5) — Agenten-Prüfkette Runde 2, 1/11: testing-qa
KRITISCHER Fund behoben: BTM-Modul erlaubte negativen Bestand (keine Prüfung
gegen vorhandenen Bestand bei Abgang/Vernichtung) -- live reproduziert und
gefixt, per Playwright verifiziert. Plus: maxlength auf 31 Feldern ergänzt,
neuer automatisierter Test für DELETE /api/tenant (16/16 grün auf dem
vServer). Stammdaten-Editierbarkeit als bewusste Design-Entscheidung
dokumentiert statt UI gebaut (Scope). Version 2026-10-10-005.
Details: CLAUDE.md § Nachtrag (5). Nächster Schritt: Agent 2/11 (security-privacy).

## Nachtrag 2026-10-10 (6) — Agenten-Prüfkette Runde 2, 2/11: security-privacy
2 echte Lücken behoben (Rate-Limiting auf Tenant-Löschbestätigung, Audit-Log-
Tabelle für destruktive Aktionen, beide live+automatisiert verifiziert,
18/18 Tests grün). 1 fundamentaler Architektur-Befund dokumentiert, NICHT
eigenmächtig gelöst: Hash-Ketten von BTM/Medizinprodukte/Wunden/MD-Archiv
schützen nicht gegen die dokumentierende Person selbst (liegen im mutable
Blob, nicht wie der Dienstplan in echter Server-Tabelle) -- echte Lösung
wäre ein Zero-Knowledge-Eingriff, neuer Punkt 7 in "Offene Entscheidungen".
Überzeichnete UI-Formulierungen in allen 4 betroffenen Modulen ehrlich
korrigiert. Version 2026-10-10-006. Details: CLAUDE.md § Nachtrag (6).
Nächster Schritt: Agent 3/11 (legal-compliance).

## Nachtrag 2026-10-10 (7) — Agenten-Prüfkette Runde 2, 3/11: legal-compliance
Datenschutzerklärung enthielt eine seit heute objektiv falsche Aussage
(behauptete, es gäbe keine Mandanten-Löschung -- existiert seit Nachtrag 4)
-- korrigiert. 3 neue Datenkategorien (BTM/Medizinprodukte/Wunden) in §2
ergänzt. WICHTIGER FUND: §1 Abs.3 BtMVV listet ambulante Intensivpflege-
dienste nicht namentlich unter den nachweispflichtigen Einrichtungen --
BTM-Modul-UI von "Nachweis nach §13/14 BtMVV" auf ehrlicheres "internes,
orientiertes Kontrollinstrument" korrigiert, offene Frage als Punkt 8 an
René. MPBetreibV-5-Jahres-Frist verifiziert+ergänzt. Version 2026-10-10-007.
Details: CLAUDE.md § Nachtrag (7). Nächster Schritt: Agent 4/11 (pflege-diagnostik).

## Nachtrag 2026-10-10 (8) — Agenten-Prüfkette Runde 2, 4/11: pflege-diagnostik
ICW-Terminologie 3/3 Stichproben primärquellen-bestätigt korrekt. 1 Doku-
Übertreibung korrigiert (CLAUDE.md behauptete ein nicht gebautes
"Wundoberfläche"-Feld). 2 echte Lücken behoben: Terminologie-Bruch zwischen
TIME-Sektion und neuem ICW-Modul (TIME nachgezogen, Speicherwerte
kompatibel belassen), fehlende Verknüpfung Wund-Register ↔ Braden-Skala/
DNQP-Maßnahmenplan (Hinweistexte ergänzt). Version 2026-10-10-008.
Details: CLAUDE.md § Nachtrag (8). Nächster Schritt: Agent 5/11 (pflege-assessment).

## Nachtrag 2026-10-10 (9) — Agenten-Prüfkette Runde 2, 5/11: pflege-assessment
Keine Regression der bestehenden Scores durch die heutige TIME-Angleichung
(strikte data-af-Namespace-Trennung bestätigt). 2 Hinweis-Fixes: Hersteller-
fristen-Hinweis bei Medizinprodukte-Fälligkeit ergänzt, BTM↔Schmerzassessment-
Verknüpfungshinweis ergänzt. 3 größere fehlende Instrumente dokumentiert
(MRC-Score, Dysphagie-Screening/GUSS, Barthel-Index) -- jeweils eigene
Neu-Instrumente, nicht in dieser Runde gebaut. Version 2026-10-10-009.
Details: CLAUDE.md § Nachtrag (9). Nächster Schritt: Agent 6/11 (accessibility-a11y).

## Nachtrag 2026-10-10 (10) — Agenten-Prüfkette Runde 2, 6/11: accessibility-a11y
1 echte Lücke behoben: fehlendes aria-live auf allen 5 "Kette prüfen"-
Ergebnisanzeigen (3 neue + 2 Altbestand Dienstplanung/MD-Archiv) -- live
verifiziert. Keine WCAG-Kontrastfehler. Live-Tastaturtest nachgeholt (Agent
hatte kein Playwright): Tab-Reihenfolge vollständig+logisch, kein Tab-Trap
(native date/time-Felder haben mehrere interne Tab-Stopps, kein Bug).
Version 2026-10-10-010. Details: CLAUDE.md § Nachtrag (10).
Nächster Schritt: Agent 7/11 (business-finance).

## Nachtrag 2026-10-10 (11) — Agenten-Prüfkette Runde 2, 7/11: business-finance
Echte Lücke teilweise geschlossen: neue Belegkategorie "Medizinprodukte-
Anschaffung & Instandhaltung" in AERIS Buch ergänzt (vorher keine passende
Kategorie, obwohl das Medizinproduktebuch bereits Anschaffungsjahr erfasst).
Gegen-Hinweis im Medizinproduktebuch ergänzt. Volle Datenverknüpfung
zwischen beiden Apps bewusst nicht gebaut (Feature-Build, kein Fix). BTM
bewusst NICHT mit Buchhaltung verknüpft (läuft über Rezept/Kasse, fachlich
korrekt getrennt). AERIS Buch erstmals seit 2026-10-02 versioniert nachgezogen
(2026-10-10-001). AERIS Doku Version 2026-10-10-011.
Details: CLAUDE.md § Nachtrag (11). Nächster Schritt: Agent 8/11 (brand-marketing).

## Nachtrag 2026-10-10 (12) — Agenten-Prüfkette Runde 2, 8/11: brand-marketing
2 echte Funde behoben: eigener AERIS-Buch-Versions-Bump war unvollständig
(app.js:19 APP_VERSION übersehen -> hätte Dauer-Fehlalarm "Update verfügbar"
verursacht, jetzt live verifiziert behoben). Sidebar-Kurztext bei BTM-
Nachweisbuch widersprach der heute selbst gehedgten Rechtsaussage (Nachtrag
7) -- korrigiert. 1 app-weite, nicht-neue Design-Token-Drift dokumentiert
(accent-#B8845A nicht in Masterübersicht), nicht in dieser Runde behoben.
Version 2026-10-10-012 / AERIS Buch 2026-10-10-001.
Details: CLAUDE.md § Nachtrag (12). Nächster Schritt: Agent 9/11 (devops-infra).

## Nachtrag 2026-10-10 (13) — Agenten-Prüfkette Runde 2, 9/11: devops-infra
WICHTIGSTER Fund bisher: Produktiv-DB hatte KEIN Backup. Behoben: täglicher
systemd-Timer-Backup (server/aeris-backup.timer+.service+backup.sh, SQLite-
Online-Backup-API, 30 Tage Aufbewahrung), live getestet (integrity_check ok,
echte Wiederherstellung geprüft). AERIS_ALLOWED_ORIGIN jetzt explizit im
Service-File. Neues deploy-www.sh für den bisher unscripted Haupt-App-Deploy.
Verwaiste server.js.bak entfernt. Zweiter Test-Server-Instanz erwogen, dann
bewusst verworfen (redundant zur bestehenden lokalen Testsuite) -- Restrisiko
bei UI-Playwright-Tests bleibt, jetzt durch das Backup abgefedert statt gelöst.
Details: CLAUDE.md § Nachtrag (13). Nächster Schritt: Agent 10/11 (quality-management).

## Nachtrag 2026-10-10 (14) — Agenten-Prüfkette Runde 2, 10/11: quality-management
Wiederholungsfehler behoben: Root-_MAINTENANCE-MANIFEST.md wurde heute
erneut nicht aktualisiert -- exakt derselbe Fund wie gestern, diesmal
nachgeholt. Vier-Augen-Prinzip, Sequenzialität, Offene-Punkte-Hygiene und
der Zusatzauftrag "auch was fehlt prüfen" (8 von 9 Agenten mit echten
Fehlt-Funden) bestätigt eingehalten. Details: CLAUDE.md § Nachtrag (14).
Nächster Schritt: Agent 11/11 (product-acceptance) — letzter, ganzheitlicher
Agent der kompletten Runde-2-Kette.

## Nachtrag 2026-10-10 (15) — Agenten-Prüfkette Runde 2, 11/11 (LETZTE Instanz): product-acceptance
VERDIKT: SUCCESS MIT VORBEHALTEN. Echter Layout-Bug gefunden, den alle 9
vorherigen Fachagenten übersehen hatten: .md:col-span-4/-3 nirgends in
app.css definiert trotz 18 Verwendungsstellen -- Infektionszeichen-
Checkboxen im Wundregister überlappten sichtbar das Schmerz-Feld. Behoben,
per Screenshot verifiziert. Kleiner Fund: leere Klammern im BTM-Dropdown
bei fehlender Stärke behoben. Kritischer BTM-Fix hält im Live-Test
(Überzugang korrekt abgelehnt). Version 2026-10-10-013.
Details: CLAUDE.md § Nachtrag (15).

## DAMIT IST DIE ZWEITE VOLLSTÄNDIGE 11-AGENTEN-PRÜFKETTE ABGESCHLOSSEN (2026-10-10)
testing-qa, security-privacy, legal-compliance, pflege-diagnostik, pflege-assessment,
accessibility-a11y, business-finance, brand-marketing, devops-infra, quality-management,
product-acceptance -- alle 11 strikt sequenziell gelaufen, jeder mit echten,
eigenständigen Funden (inkl. "auch was fehlt"-Zusatzauftrag), alle Code-Fixes
sofort behoben+deployed+committed+gepusht. Wichtigste Funde des Tages: KRITISCHER
BTM-Negativbestand-Bug (behoben), fehlendes Produktiv-DB-Backup (jetzt täglicher
Timer), fundamentaler Hash-Ketten-Architektur-Befund (dokumentiert, nicht gelöst --
Zero-Knowledge-Konflikt), bedeutende BtMVV-Rechts-Korrektur (UI gehedgt).

## Nachtrag 2026-10-10 (16) — KRITISCHER Fund: renderMp()-Namenskollision behoben
SIS-Maßnahmenplan (zentrale Pflegeplanungs-Funktion) war seit dem Bau des
Medizinproduktebuchs kaputt -- zwei function renderMp() im selben Scope,
Medizinprodukte-Version gewann und überschrieb die SIS-Version. Umbenannt
auf renderMedizinprodukte(), live verifiziert: Maßnahmenplan-Tab + "Maßnahme
hinzufügen" funktionieren wieder korrekt. Version 2026-10-10-014.
Details: CLAUDE.md § Nachtrag (16).

## Nachtrag 2026-10-10 (17) — BTM-Architektur-Umbau auf echte Server-Tabelle (1/3)
René-Entscheidung: echte Tamper-Resistenz hat Vorrang. Neue Server-Tabellen
(btm_praeparate/eintraege/monatspruefungen), serverseitig berechneter Hash
+ Bestandsprüfung, §13 Abs.2-Monatsprüfung umgesetzt. Client verzweigt auf
AE_SERVER_MODE. 2 echte Bugs beim Testen gefunden+behoben: Tenant-Löschung
schlug mit FK-Fehler fehl (Tenant blieb stecken, jetzt behoben+getestet),
Kettenprüfung zeigte falsch "0 Einträge" im Server-Modus. 20/20 Tests grün.
Version 2026-10-10-015. Details: CLAUDE.md § Nachtrag (17).

## Nachtrag 2026-10-10 (18) — Medizinprodukte-Live-Nachtest: echter Feldnamen-Bug gefunden+behoben
Client-Umbau aus Nachtrag 17 war nur syntaxgeprüft, nicht live getestet.
Nachgeholt -- Server lehnte JEDEN MP-Eintrag mit 400 ab: Client sendet
"geraeteId", Server erwartet "geraetId" (BTM/Wunden sind konsistent, nur MP
betroffen). Fix per Übersetzung an der API-Grenze (aeMpNormalizeEintrag).
Live-Test danach grün (2 Einträge, korrekte Kettenprüfung "2 Einträge" statt
fälschlich "0"). Version 2026-10-10-017. Details: CLAUDE.md § Nachtrag (18).

## Nachtrag 2026-10-10 (19) — Wunden-Architektur-Umbau auf echte Server-Tabelle (3/3)
Identisches Dual-Mode-Muster wie BTM/MP. Live-Test: Wunde anlegen, 2
chronologische Verlaufseinträge, Kettenprüfung intakt, Tenant-Aufräumung --
alles grün. 2 neue automatisierte Tests inkl. gezieltem DB-Manipulationstest
(Kette erkennt nachträgliche Änderung korrekt als "nicht intakt"). 21/21
Tests grün. Version 2026-10-10-016 (Client-Deploy vor dem MP-Fix oben).
Details: CLAUDE.md § Nachtrag (19).
## Nachtrag 2026-10-10 (20) — MD-Archiv-Checkpoint-Verankerung (3/3, letztes Architektur-Modul)
Leichteres "Checkpoint-only"-Muster: Server bekommt nur den täglichen
Ketten-Hash (nie Klardaten), dient als externer Zeuge gegen eine komplette
Neuberechnung der lokalen Kette. aeMdKettePruefen() gleicht jetzt zusätzlich
gegen Server-Checkpoints ab (Löschungs-/Manipulationserkennung, Retention-
bedingte legitime Löschung korrekt ausgenommen). Veralteten Lead-Text in
index.html korrigiert (behauptete noch "kein Ersatz für serverseitige
Non-Repudiation" -- jetzt im Server-Modus überholt). Live-Test grün (Anker
setzen, Konflikt bei abweichendem Hash → 409, Original bleibt unverändert).
22/22 Tests grün. Version 2026-10-10-018. Details: CLAUDE.md § Nachtrag (20).

**Damit sind alle 3 René-beauftragten Architektur-Module (BTM, Medizinprodukte,
Wunden, MD-Archiv) umgesetzt, live verifiziert, automatisiert abgesichert.**
Task #54-#57 abgeschlossen.

## Nachtrag 2026-10-10 (21) — Datenschutzerklärung aktualisiert (#58+#59 erledigt)
§3 "Team-/Mandanten-Modus" erweitert: BTM/Medizinprodukte/Wunden-Metadaten +
MD-Audit-Tages-Hash jetzt explizit als unverschlüsselt/Hash-only auf dem
Server offengelegt (analog zur bestehenden Dienstplan-Klausel). Neuer Absatz
erklärt den Tamper-Resistenz-Unterschied lokaler Modus (kein externer Zeuge,
bewusstes Restrisiko) vs. Server-Modus (Lücke geschlossen). Live-verifiziert,
Version 2026-10-10-019. Details: CLAUDE.md § Nachtrag (21).

## Nachtrag 2026-10-10 (22) — MRC-Score ergänzt (Abschnitt 16, #60 erledigt)
Fehlendes Assessment aus dem Korrektur-Potenzial. MRC Muscle Power Scale,
6 Muskelgruppen beidseits, Summe 0-60, Cutoff <48 = ICU-acquired weakness
(De Jonghe 2002/2007). Nach dem etablierten Abschnitt-8-15-Muster integriert
(beide DOM-Scopes, Live-Scoring, Protokollformular, Mapping-Einträge).
Live-Test grün (Default 60/60, Testfall 25/60 mit korrektem Alert).
Version 2026-10-10-020. Details: CLAUDE.md § Nachtrag (22).

## Nachtrag 2026-10-10 (23) — GUSS-ICU-Dysphagie-Screening ergänzt (Abschnitt 17, #61 erledigt)
Primärquelle vollständig per PDF ausgewertet (Troll/Trapl-Grundschober 2023,
donau-uni.ac.at). Voruntersuchung 6/6 Pflicht vor direktem Test, 4
sequenzielle Subtests mit Abbruch-bei-Auffälligkeit, Summe 0-10. Bewusst
dokumentierte Lücke bei Score 9 (Quelle uneindeutig) -- konservativer
Hinweistext statt erfundener IDDSI-Stufe. Live-Test: sequenzielle
Freischaltung + Score + Diätempfehlung pro Stufe alle korrekt.
Version 2026-10-10-021. Details: CLAUDE.md § Nachtrag (23).

## Nachtrag 2026-10-10 (24) — Barthel-Index ergänzt (Abschnitt 18, #62 erledigt)
Barthel-Index (Mahoney & Barthel 1965) statt FIM (zertifizierungspflichtig,
für diese Zielgruppe weniger geeignet). 10 Items, Summe 0-100, exakt nach
Originalpublikation + BfArM-Hamburger-Einstufungsmanual gegengeprüft.
Interpretations-Bänder transparent als Sekundärquelle gekennzeichnet (nicht
Teil der 1965er-Originalpublikation). Live-Test grün (Default 100/100,
Grenzfälle 0/30/40 korrekt). Version 2026-10-10-022.
Details: CLAUDE.md § Nachtrag (24).

**Alle 3 fehlenden Assessment-Instrumente aus dem Korrektur-Potenzial jetzt
ergänzt (Abschnitte 16-18).**

## Nachtrag 2026-10-10 (25) — Design-Token-Drift behoben (#63 erledigt)
#B8845A (97x, nur Checkbox-accent-color) wich vom kanonischen AERIS-Bronze
#B87333 ab (Root-CLAUDE.md, 9x in app.css bestätigt: Buttons/aktive Tabs/
Kalender). Projektweit auf #B87333 korrigiert (index.html + app.css-Regel),
kein Tailwind-Build vorhanden -- direkte Textersetzung ist der korrekte Fix.
Live bestätigt: berechneter accentColor jetzt rgb(184,115,51)=#B87333 exakt.
Version 2026-10-10-023. Details: CLAUDE.md § Nachtrag (25).

**Gesamtes Korrektur-Potenzial (#60-63) jetzt abgearbeitet.**

## Nachtrag 2026-10-10 (26) — QM-Handbuch erstellt (#64 erledigt, SESSION ABGESCHLOSSEN)
Neues echtes AERIS-Eigendokument `dokumente/qm-agenten-pruefschema-handbuch.html`
(nicht nur Session-Notiz -- im Brand-Template, über Dokumente-Liste
erreichbar). 7 Abschnitte: Prüfarchitektur, Vier-Augen-Prinzip,
Primärquellen-Pflicht, 3-stufige Nachweisführung (Git/CLAUDE.md/Tests),
Wirksamkeitsnachweis mit echten Funden (Audit 2026-10-02 + heutiger
Live-Testlauf), offen benannte Grenzen (lokaler-Modus-Kompromiss,
PIN-Entropie), Bezug zu § 114 SGB XI MD-Prüfrichtlinien. Grimmiges Framing:
Wirksamkeit wird durch dokumentierte echte Funde belegt, nicht behauptet.
Live-Test grün (Direktaufruf + App-Dokumentenliste). Version 2026-10-10-024.
Details: CLAUDE.md § Nachtrag (26).

**RENÉ-AUFTRAG DIESER SESSION VOLLSTÄNDIG ABGESCHLOSSEN:** alle 8 offenen
Entscheidungspunkte geklärt, alle 3 Architektur-Module auf Server-
Verankerung umgestellt, Datenschutzerklärung aktualisiert, alle 4
Korrektur-Potenzial-Punkte behoben, QM-Handbuch erstellt. Tasks #50-#64
abgeschlossen.

## Nachtrag 2026-10-10 (27) — PIN-Entropie/Trivial-PINs geschlossen (René: "alle offenen im Loop erledigen")
Letzter im GOAL-FINALIZATION-REPORT genannter offener Punkt behoben: 6-Ziffern-
Pflicht war schon seit 2026-10-09 aktiv (Memory-Stand war veraltet), aber
"111111"/"123456" etc. waren weiterhin als neue PIN wählbar -- real kaum mehr
Entropie als 1-2-stellig. Neue Trivial-PIN-Sperre in allen 3 PIN-Erstellungs-
pfaden (lokaler 2-Schritt-Dialog, Server "Eigene PIN ändern", Server
Team-Start-PIN). Bestehende/kürzere Alt-PINs bleiben bewusst entsperrbar.

ECHTER BUG beim ersten Live-Test gefunden: die neue Meldung kam im lokalen
Dialog nie an, weil der Schritt-1→2-Übergang über einen focus-Handler läuft
(native Formularvalidierung unterdrückt das submit-Event komplett, solange
"confirm" leer ist) -- nur die (kaum erreichbare) submit-Stelle war gefixt.
0 submit-Events feuerten live, dann auf gemeinsame Hilfsfunktion konsolidiert
und an der tatsächlich wirksamen Stelle verdrahtet. Alle 3 Pfade danach live
grün (trivial abgelehnt, echte PIN angenommen + funktionsfähig, inkl.
Tenant-Löschung mit geänderter PIN zur Bestätigung). Version 2026-10-10-027.
Details: CLAUDE.md § Nachtrag (27).

## Nachtrag 2026-10-10 (28) — GUSS-ICU Score-9-Lücke geschlossen + echten IDDSI-Fehler bei Score 8 gefunden
Letztes Korrektur-Potenzial-Item aus dem Report behoben: vertiefte Recherche
fand die vollständige offizielle Rückseiten-Tabelle "GUSS-ICU-EVALUATION"
(Troll et al. 2023, donau-uni.ac.at). Score 9 jetzt vollständig belegt statt
gehedgt. Dabei nebenbei einen echten Fehler bei Score 8 gefunden (war
"IDDSI 6/7", offiziell "IDDSI 5 oder 6") und korrigiert. Alle 6 Stufen auf
wörtlichen offiziellen Text umgestellt, Live-Anzeige + Druckprotokoll auf
eine gemeinsame Funktion konsolidiert (verhindert künftiges Auseinanderlaufen).
Live-Test grün (Score 9 + 10 korrekt). Version 2026-10-10-028.
Details: CLAUDE.md § Nachtrag (28).

## Nachtrag 2026-10-10 (29) — Barthel-Bänder zweitquellen-bestätigt (letztes Item erledigt)
Zweite unabhängige Quelle bestätigt dieselben Bänder (0-30/35-80/85-95/100) --
keine Code-Änderung nötig, bereits korrekt. Zusatzfund BAR-Phasenmodell
(andere Bänder für Reha-Phasenzuordnung, nicht für häusliche Doku relevant)
bewusst nicht übernommen, nur als Kommentar dokumentiert. Version
2026-10-10-029. Details: CLAUDE.md § Nachtrag (29).

**Damit sind ALLE Punkte aus [OFFEN] und [KORREKTUR-POTENZIAL] des
vorherigen GOAL-FINALIZATION-REPORTs abgearbeitet.** Nächster Schritt:
keiner offen aus diesem Auftrag -- bei Bedarf neue Session/neuen Auftrag
von René abwarten.
