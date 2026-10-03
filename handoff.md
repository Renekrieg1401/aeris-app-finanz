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
