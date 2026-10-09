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

## Offene Entscheidungen (an René)
1. Soll `aeris-web` (Landingpage) ebenfalls importiert und demselben Silo zugeordnet werden?
2. Eigentumsklärung ggü. GitHub-Org (`Renekrieg1401` persönlich vs. `YNA-Digital`)?

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
