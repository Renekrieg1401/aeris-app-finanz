// AERIS-Server: Multi-User/Mandanten-Backend. Siehe db.js für das Sicherheitsprinzip
// (Server sieht nie DEK oder Klardaten). Läuft hinter dem bestehenden Nginx-Reverse-Proxy
// (HTTPS + Basic-Auth) auf 212.132.117.130, lokal nur HTTP auf 127.0.0.1:8787.
var express = require('express');
var cors = require('cors');
var crypto = require('crypto');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var fs = require('fs');
var path = require('path');
var db = require('./db');

// AERIS_JWT_SECRET_PATH überschreibt den Pfad (für die Testsuite, analog AERIS_DB_PATH in db.js) --
// nie die echte, produktive jwt-secret.txt für Tests anfassen/löschen.
var SECRET_FILE = process.env.AERIS_JWT_SECRET_PATH || path.join(__dirname, 'jwt-secret.txt');
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
var JWT_SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();

var app = express();
app.set('trust proxy', true); // hinter Nginx (X-Forwarded-For) -- req.ip sonst immer 127.0.0.1
// AERIS_ALLOWED_ORIGIN überschreibt den erlaubten CORS-Origin (devops-infra-Fund 2026-10-09:
// vorher Wildcard `cors()` ohne jede Origin-Einschränkung). Der Client ruft die API ausschließlich
// relativ (`/api/...`, s. aeris-server.js) vom selben Origin auf -- Zugriffe von jedem ANDEREN
// Origin sind architektonisch nicht vorgesehen, daher harte Einschränkung statt Wildcard. Bei einem
// künftigen Domain-Wechsel (s. "Offene Entscheidungen" Punkt 6, echtes CA-Zertifikat) genügt eine
// Env-Var-Änderung, kein Code-Fix.
// Nachtrag 2026-10-11 (René-Auftrag "Server-Verbindung herstellen"): Die Desktop-App (Electron) lädt
// über `file://`, nicht über https://212.132.117.130 -- ein Fetch von dort schickt den Origin "null"
// (fester, von Webseiten nicht fälschbarer Wert für lokale Dateikontexte, kein Freibrief für beliebige
// Drittseiten). Ohne diesen zusätzlichen Eintrag konnte die Desktop-App den Team-/Server-Modus
// technisch nie erreichen -- der eigentliche Zugriffsschutz bleibt ohnehin das JWT-Bearer-Token, CORS
// ist hier nur die zweite Schicht.
var ALLOWED_ORIGINS = [process.env.AERIS_ALLOWED_ORIGIN || 'https://212.132.117.130', 'null'];
app.use(cors({ origin: function (origin, cb) { cb(null, !origin || ALLOWED_ORIGINS.indexOf(origin) !== -1); } }));
app.use(express.json({ limit: '20mb' }));

function uuid() { return crypto.randomUUID(); }
function nowIso() { return new Date().toISOString(); }
function sha256Hex(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }
// René-Direktive 2026-10-09: NEUE PINs müssen genau 6 Ziffern haben (kein 4-5-stelliges Wahlrecht
// mehr). Serverseitig geprüft (nicht nur im Client, s. aeris-server.js), da Client-Validierung sich
// umgehen lässt (z.B. direkter API-Aufruf). Gilt für /api/setup, /api/users (POST), /password-reset,
// /api/me/password -- NICHT für /api/login (das prüft eine bereits bestehende, evtl. ältere PIN).
function istGueltigeNeuePin(p) { return /^\d{6}$/.test(p || ''); }

// ---------- Zeit-Helfer für Eskalationsberechnung (Organisationsstruktur Phase 5,
// Auftrag 2026-10-24/25) -- bewusst NICHT von der Prozess-TZ des Servers abhängig
// (vServer könnte unter UTC laufen, Pflegekräfte/Dienstzeiten sind Europe/Berlin-Wandzeit).
// Ermittelt den Berlin-UTC-Offset für einen gegebenen Zeitpunkt (CET/CEST-DST-sicher) über
// Intl.DateTimeFormat statt eines fest kodierten Offsets.
function berlinOffsetMinuten(utcMs) {
  var dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  var teile = dtf.formatToParts(new Date(utcMs)).reduce(function (acc, p) { acc[p.type] = p.value; return acc; }, {});
  var stunde = teile.hour === '24' ? '00' : teile.hour;
  var alsUtc = Date.UTC(Number(teile.year), Number(teile.month) - 1, Number(teile.day), Number(stunde), Number(teile.minute), Number(teile.second));
  return Math.round((alsUtc - utcMs) / 60000);
}
// Wandelt eine Europe/Berlin-Wandzeit (Datum+HH:MM) in einen echten UTC-Epoch-Millisekunden-
// Wert um -- zweistufig (Offset am Grobschätz-Zeitpunkt, dann am korrigierten Zeitpunkt erneut
// geprüft), damit DST-Übergangstage korrekt behandelt werden.
function berlinWandzeitZuEpoch(datumIso, hhmm) {
  var dp = datumIso.split('-').map(Number), tp = hhmm.split(':').map(Number);
  var grobUtc = Date.UTC(dp[0], dp[1] - 1, dp[2], tp[0], tp[1], 0);
  var offset = berlinOffsetMinuten(grobUtc);
  var utcMs = grobUtc - offset * 60000;
  var offset2 = berlinOffsetMinuten(utcMs);
  if (offset2 !== offset) utcMs = grobUtc - offset2 * 60000;
  return utcMs;
}
function pad2Srv(n) { return n < 10 ? '0' + n : '' + n; }
// Reine Kalenderarithmetik (Date.UTC statt lokaler Zeitzone) -- unabhängig von Server-TZ.
function isoPlusTageSrv(iso, n) {
  var p = iso.split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() + n);
  return d.getUTCFullYear() + '-' + pad2Srv(d.getUTCMonth() + 1) + '-' + pad2Srv(d.getUTCDate());
}
function timeToMinutesSrv(hhmm) {
  if (!hhmm) return null;
  var parts = String(hhmm).split(':');
  if (parts.length !== 2) return null;
  var h = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}
// Spiegelt app.js' schichtZeitraum() server-seitig (gleiche Mitternacht-Überlauf-Logik:
// bis < von -> Schichtende liegt am Folgetag), nur mit echten Berlin-Epoch-Zeitpunkten statt
// reiner Browser-lokaler new Date()-Interpretation.
function schichtZeitraumSrv(datum, von, bis) {
  var s = timeToMinutesSrv(von), e = timeToMinutesSrv(bis);
  if (s === null || e === null) return null;
  var endDatum = e > s ? datum : isoPlusTageSrv(datum, 1);
  return { start: berlinWandzeitZuEpoch(datum, von), end: berlinWandzeitZuEpoch(endDatum, bis) };
}

// ---------- Rate-Limiting /api/login (security-privacy-Gegenprüfung 2026-10-09: PIN ist nur
// 4-6-stellig, max. 1 Mio. Kombinationen -- ohne Schutz wäre das ein triviales Online-Brute-Force-
// Ziel, sobald der Server erreichbar ist). Persistent in SQLite (Korrektur-Potenzial-Fund
// 2026-10-09, Nachtrag: ein rein In-Memory-Lockout überlebt keinen Server-Neustart/Deploy und
// wäre damit wirkungslos genau in dem Moment, in dem ein Angreifer einen Neustart erzwingen
// könnte, z.B. über den ohnehin vorhandenen systemd-Restart-on-failure). Sperrdauer/Schwelle
// identisch zum bereits bestehenden lokalen PIN-Gate (app.js AE_PIN_MAX=5, 15 Min). ----------
var LOGIN_MAX = 5, IP_MAX = 20, LOCK_MS = 15 * 60 * 1000;
var DUMMY_HASH = bcrypt.hashSync('kein-echtes-konto', 10); // gegen Username-Enumeration per Timing (s. u.)
function gesperrtBis(art, key) {
  var row = db.prepare('SELECT bis FROM login_sperre WHERE art = ? AND schluessel = ?').get(art, key);
  if (!row || !row.bis) return 0;
  var bis = new Date(row.bis).getTime();
  if (bis <= Date.now()) { db.prepare('DELETE FROM login_sperre WHERE art = ? AND schluessel = ?').run(art, key); return 0; }
  return bis;
}
function vermerkeFehlversuch(art, key, max) {
  var row = db.prepare('SELECT fehl FROM login_sperre WHERE art = ? AND schluessel = ?').get(art, key);
  var fehl = (row ? row.fehl : 0) + 1;
  var bis = '';
  if (fehl >= max) { bis = new Date(Date.now() + LOCK_MS).toISOString(); fehl = 0; }
  db.prepare(
    'INSERT INTO login_sperre (art, schluessel, fehl, bis) VALUES (?,?,?,?) ' +
    'ON CONFLICT(art, schluessel) DO UPDATE SET fehl = excluded.fehl, bis = excluded.bis'
  ).run(art, key, fehl, bis);
}
function entsperre(art, key) { db.prepare('DELETE FROM login_sperre WHERE art = ? AND schluessel = ?').run(art, key); }
function sperrMinuten(bis) { return Math.max(1, Math.ceil((bis - Date.now()) / 60000)); }

function publicUser(u) {
  return {
    id: u.id, username: u.username, displayName: u.display_name, role: u.role, telefon: u.telefon,
    // Phase 2 (Organisationsstruktur, software-architect-Konzept 2026-10-24): "role" (Singular)
    // bleibt als Anzeige-Altfeld bestehen, "roles" (Array aus user_roles) ist ab jetzt die alleinige
    // Autorisierungs-Quelle -- NICHT das Gegenteil annehmen, role wird nirgends mehr für 403/Scope
    // ausgewertet, nur noch für UI-Labels (s. aeris-server.js/app.js hatRolle()-Umstellung).
    roles: db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(u.id).map(function (r) { return r.role; }),
    active: !!u.active, mustChangePassword: !!u.must_change_password, pfkKuerzel: u.pfk_kuerzel || '',
    vorname: u.vorname || '', nachname: u.nachname || '', adresse: u.adresse || '',
    firma: u.firma || '', personalnummer: u.personalnummer || '', berufsstand: u.berufsstand || '',
    // Organisationsstruktur Phase 3 (2026-10-24): team_id als Lese-Feld ergaenzt -- Phase 1/2 kannten
    // nur die Spalte selbst, kein Aufrufer las sie bisher aus. Noetig fuer die Scope-Filter in
    // GET /api/bezirke|teams (teamleiter/ma sehen nur ihr eigenes Team ueber req.user.team_id).
    teamId: u.team_id || null
  };
}
// René-Auftrag 2026-10-11: Profil-Felder (Vor-/Nachname, Adresse, Firma, Personalnummer, Berufsstand,
// PFK-Kuerzel) aus dem Request-Body herausloesen -- von /setup, POST /users UND PATCH /users/:id
// gleichermassen genutzt, damit alle drei Stellen identisch trimmen/begrenzen.
function profilFelderAus(b) {
  return {
    vorname: String(b.vorname || '').trim().slice(0, 60),
    nachname: String(b.nachname || '').trim().slice(0, 60),
    adresse: String(b.adresse || '').trim().slice(0, 300),
    firma: String(b.firma || '').trim().slice(0, 120),
    personalnummer: String(b.personalnummer || '').trim().slice(0, 40),
    berufsstand: String(b.berufsstand || '').trim().slice(0, 60),
    pfkKuerzel: String(b.pfkKuerzel || '').trim().slice(0, 10)
  };
}

// security-privacy-Gegenprüfung 2026-10-09: must_change_password war bis hierhin reines Client-UI-
// Theater -- ein direkter API-Aufruf mit dem gültigen Bearer-Token konnte den Pflicht-PIN-Wechsel
// komplett umgehen, der Server prüfte das Flag nirgends. Erlaubt bleiben nur die Routen, die der
// Pflicht-Wechsel-Ablauf selbst braucht (eigene Daten lesen, um sie im Speicher zu halten + die
// PIN tatsächlich ändern) -- alles andere (Schreiben, Team-Verwaltung, Dienstplan, ...) ist gesperrt,
// bis die Person eine eigene PIN gesetzt hat.
var AUTH_TROTZ_PFLICHT_WECHSEL_ERLAUBT = { 'GET /api/me': true, 'GET /api/blob': true, 'POST /api/me/password': true };
function auth(req, res, next) {
  var h = req.headers.authorization || '';
  var m = /^Bearer (.+)$/.exec(h);
  if (!m) return res.status(401).json({ error: 'Kein Token.' });
  try {
    var payload = jwt.verify(m[1], JWT_SECRET);
    var user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'Account nicht mehr aktiv.' });
    if (user.must_change_password && !AUTH_TROTZ_PFLICHT_WECHSEL_ERLAUBT[req.method + ' ' + req.path]) {
      return res.status(403).json({ error: 'PIN muss zuerst geändert werden.', mustChangePassword: true });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token ungültig oder abgelaufen.' });
  }
}
// Organisationsstruktur Phase 2 (2026-10-24, software-architect-Konzept, René 1:1 bestaetigt):
// user_roles (Mengen-Tabelle, s. db.js) ist ab jetzt die ALLEINIGE Quelle der Wahrheit fuer
// Autorisierungsentscheidungen -- users.role (Singular) bleibt nur als Anzeige-Altfeld bestehen
// (publicUser()), wird hier NICHT mehr gelesen. Zentrale Helper statt Inline-Vergleich an jeder
// Stelle (Architektur-Vorgabe).
function hatRolle(userId, rolle) {
  return !!db.prepare('SELECT 1 FROM user_roles WHERE user_id = ? AND role = ?').get(userId, rolle);
}
function hatEineRolle(userId, rollenArray) {
  if (!rollenArray || !rollenArray.length) return false;
  var platzhalter = rollenArray.map(function () { return '?'; }).join(',');
  var zeile = db.prepare('SELECT 1 FROM user_roles WHERE user_id = ? AND role IN (' + platzhalter + ') LIMIT 1')
    .get.apply(null, [userId].concat(rollenArray));
  return !!zeile;
}
function requireAdmin(req, res, next) {
  if (!hatRolle(req.user.id, 'admin')) return res.status(403).json({ error: 'Nur für Admins.' });
  next();
}
// K-neu (Feature "Eintrag melden", software-architect-Konzept 2026-10-24, René-bestaetigt Punkt 3):
// Rolle 'teamleiter' -- kann Meldungen entscheiden (annehmen/korrigieren/ablehnen), hat aber
// NICHT die vollen Admin-Rechte (kein Team verwalten, kein Tenant loeschen, kein /api/blob-fin --
// bleibt admin-only, s. requireAdmin dort). 'hr' (Phase 2, neu) ist bewusst NICHT in diesem Array --
// HR verwaltet Dienstplan/Zeiterfassung/Nutzer, darf aber AUSDRÜCKLICH nicht in die Meldungen-
// Entscheidungskette (software-architect-Risikopunkt).
var GUELTIGE_ROLLEN = ['admin', 'ma', 'teamleiter', 'hr', 'bezirksleitung'];
function requireTeamleiterOderAdmin(req, res, next) {
  if (!hatEineRolle(req.user.id, ['admin', 'teamleiter'])) return res.status(403).json({ error: 'Nur für Teamleiter/-innen oder Admins.' });
  next();
}
// Hilfsfunktion fuer POST/PATCH /api/users: liefert ein validiertes Rollen-Array (nie leer).
// Mehrfachrollen-Faehigkeit (René-Entscheidung "eine Person darf mehrere Rollen haben"): b.roles
// (Array) hat Vorrang, b.role (Einzelstring) bleibt als Rueckwaertskompatibilitaet erhalten.
function gueltigeRollenAusBody(b, fallbackRolle) {
  if (Array.isArray(b.roles)) {
    var gefiltert = [];
    b.roles.forEach(function (r) {
      if (GUELTIGE_ROLLEN.indexOf(r) !== -1 && gefiltert.indexOf(r) === -1) gefiltert.push(r);
    });
    return gefiltert.length ? gefiltert : [fallbackRolle];
  }
  return [GUELTIGE_ROLLEN.indexOf(b.role) !== -1 ? b.role : fallbackRolle];
}

// Organisationsstruktur Phase 3 (2026-10-24, Auftrag "CRUD + Pro-Klient-DEK-Provisionierung +
// Login-Vertrag umbauen"): admin ODER bezirksleitung-mit-Zugriff-auf-das-Ziel-Team darf einen
// Klienten in genau diesem Team anlegen -- bezirksleitung NUR, wenn das Ziel-Team zu einem von ihr
// geleiteten Bezirk gehoert (serverseitig geprueft, nicht dem Client ueberlassen).
function requireAdminOderBezirksleitungFuerTeam(req, res, next) {
  if (hatRolle(req.user.id, 'admin')) return next();
  if (!hatRolle(req.user.id, 'bezirksleitung')) {
    return res.status(403).json({ error: 'Nur für Admins oder Bezirksleitung.' });
  }
  var teamId = req.body && req.body.teamId;
  if (!teamId) return res.status(400).json({ error: 'teamId erforderlich.' });
  var team = db.prepare('SELECT * FROM teams WHERE id = ? AND tenant_id = ?').get(teamId, req.user.tenant_id);
  if (!team) return res.status(404).json({ error: 'Team nicht gefunden.' });
  var bezirk = db.prepare('SELECT id FROM bezirke WHERE id = ? AND leiter_user_id = ?').get(team.bezirk_id, req.user.id);
  if (!bezirk) return res.status(403).json({ error: 'Kein Zugriff auf dieses Team (anderer Bezirk).' });
  next();
}
function rowToBezirk(r) { return { id: r.id, name: r.name, leiterUserId: r.leiter_user_id, createdAt: r.created_at }; }
function rowToTeam(r) { return { id: r.id, name: r.name, bezirkId: r.bezirk_id, bezirkName: r.bezirk_name, leiterUserId: r.leiter_user_id, createdAt: r.created_at }; }
function teamMitBezirk(teamId) {
  return rowToTeam(db.prepare('SELECT t.*, b.name AS bezirk_name FROM teams t JOIN bezirke b ON b.id = t.bezirk_id WHERE t.id = ?').get(teamId));
}
// K5 Public-Key-Envelope (2026-10-25): 'pubkey' ergaenzt -- s. db.js-Kommentar bei klient_dek_wraps.
var KLIENT_WRAP_ARTEN = ['pin', 'recovery', 'pubkey'];

// ---------- Setup: neuer Mandant + Erst-Accounts (Organisationsstruktur-Umbau 2026-10-24,
// René-Direktive "4-Rollen-Pflicht, aber Mehrfachrollen auf einem Account zulaessig") ----------
// Pflichtrollen: fuer jede dieser 4 Rollen muss nach der Registrierung GENAU EIN Account
// existieren, der sie trägt -- egal ob 1 Account mit allen 4 Rollen oder bis zu 4 getrennte Accounts.
var PFLICHT_ROLLEN_SETUP = ['admin', 'hr', 'bezirksleitung', 'teamleiter'];
var STANDARD_BEZIRK_NAME = 'Hauptbezirk';
var STANDARD_TEAM_NAME = 'Hauptteam';

app.post('/api/setup', function (req, res) {
  var b = req.body || {};
  if (!b.tenantName) return res.status(400).json({ error: 'tenantName erforderlich.' });

  // Rueckwaertskompatibilitaet (explizite Vorgabe): fehlt "accounts" im Body, wird das alte
  // Singular-Format als Abkuerzung fuer GENAU EINEN Admin-Account interpretiert -- die
  // 4-Rollen-Pflicht greift in diesem Fall bewusst NICHT (Altverhalten fuer bestehende
  // Tests/Integrationen bleibt erhalten). Es wird TROTZDEM ein Default-Bezirk/-Team angelegt,
  // damit auch dieser Pfad in die neue Organisationsstruktur eingebettet ist.
  var vierRollenPflicht = Array.isArray(b.accounts);
  var accountsEingabe;
  if (vierRollenPflicht) {
    accountsEingabe = b.accounts;
  } else {
    if (!b.username || !b.password || !b.displayName || !b.wrappedDek) {
      return res.status(400).json({ error: 'tenantName, username, password, displayName, wrappedDek erforderlich (oder "accounts"-Array übergeben).' });
    }
    accountsEingabe = [Object.assign({}, b, { roles: ['admin'] })];
  }

  if (!Array.isArray(accountsEingabe) || accountsEingabe.length < 1 || accountsEingabe.length > 4) {
    return res.status(400).json({ error: '"accounts" muss ein Array mit 1 bis 4 Einträgen sein.' });
  }

  // Validierung jedes einzelnen Accounts + Rollen-Zaehlung fuer die 4-Rollen-Pflicht, VOR jeder
  // DB-Schreibaktion (keine Teil-Anlage bei einem spaeten Validierungsfehler).
  var usernamesGesehen = {}, rollenZaehler = {}, geparst = [];
  PFLICHT_ROLLEN_SETUP.forEach(function (r) { rollenZaehler[r] = 0; });
  for (var i = 0; i < accountsEingabe.length; i++) {
    var acc = accountsEingabe[i] || {};
    if (!acc.username || !acc.password || !acc.displayName || !acc.wrappedDek) {
      return res.status(400).json({ error: 'Account ' + (i + 1) + ': username, password, displayName, wrappedDek erforderlich.' });
    }
    if (!istGueltigeNeuePin(acc.password)) {
      return res.status(400).json({ error: 'Account ' + (i + 1) + ' (' + acc.username + '): PIN muss genau 6 Ziffern haben.' });
    }
    if (usernamesGesehen[acc.username]) {
      return res.status(400).json({ error: 'Benutzername "' + acc.username + '" ist innerhalb des Requests mehrfach vergeben.' });
    }
    usernamesGesehen[acc.username] = true;
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(acc.username)) {
      return res.status(409).json({ error: 'Benutzername "' + acc.username + '" bereits vergeben.' });
    }
    var rollen = gueltigeRollenAusBody(acc, 'admin');
    rollen.forEach(function (r) { if (rollenZaehler.hasOwnProperty(r)) rollenZaehler[r]++; });
    geparst.push({ raw: acc, rollen: rollen, pf: profilFelderAus(acc) });
  }

  if (vierRollenPflicht) {
    var fehlend = [], doppelt = [];
    PFLICHT_ROLLEN_SETUP.forEach(function (r) {
      if (rollenZaehler[r] === 0) fehlend.push(r);
      else if (rollenZaehler[r] > 1) doppelt.push(r);
    });
    if (fehlend.length) {
      return res.status(400).json({ error: 'Folgende Pflichtrolle(n) sind von keinem Account abgedeckt: ' + fehlend.join(', ') + '.' });
    }
    if (doppelt.length) {
      return res.status(400).json({ error: 'Folgende Rolle(n) sind auf mehrere Accounts verteilt (jede Rolle darf nur EINMAL vorkommen): ' + doppelt.join(', ') + '.' });
    }
  }

  var tenantId = uuid(), bezirkId = uuid(), teamId = uuid(), ts = nowIso();
  var ergebnisUsers = [];
  var tx = db.transaction(function () {
    db.prepare('INSERT INTO tenants (id, name, created_at) VALUES (?,?,?)').run(tenantId, b.tenantName, ts);
    db.prepare('INSERT INTO bezirke (id, tenant_id, name, leiter_user_id, created_at) VALUES (?,?,?,?,?)')
      .run(bezirkId, tenantId, b.bezirkName ? String(b.bezirkName).trim().slice(0, 120) : STANDARD_BEZIRK_NAME, null, ts);
    db.prepare('INSERT INTO teams (id, tenant_id, bezirk_id, name, leiter_user_id, created_at) VALUES (?,?,?,?,?,?)')
      .run(teamId, tenantId, bezirkId, b.teamName ? String(b.teamName).trim().slice(0, 120) : STANDARD_TEAM_NAME, null, ts);

    var teamleiterUserId = null, bezirksleitungUserId = null;
    geparst.forEach(function (g) {
      var userId = uuid(), pf = g.pf;
      // "teamleiter"-Rolle gewinnt bei der team_id-Zuordnung IMMER, auch in Kombination mit "admin"
      // (Vorgabe woertlich: "egal welche anderen Rollen er noch hat") -- nur ein admin-Account OHNE
      // teamleiter-Rolle bleibt ohne team_id.
      var hatTeamleiter = g.rollen.indexOf('teamleiter') !== -1;
      var userTeamId = hatTeamleiter ? teamId : null;
      db.prepare(
        'INSERT INTO users (id, tenant_id, username, password_hash, display_name, role, telefon, wrapped_dek_salt, wrapped_dek_iv, wrapped_dek_ct, active, pfk_kuerzel, vorname, nachname, adresse, firma, personalnummer, berufsstand, team_id, created_at) ' +
        'VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?)'
      ).run(userId, tenantId, g.raw.username, bcrypt.hashSync(g.raw.password, 10), g.raw.displayName, g.rollen[0], g.raw.telefon || '',
        g.raw.wrappedDek.salt, g.raw.wrappedDek.iv, g.raw.wrappedDek.ct,
        pf.pfkKuerzel, pf.vorname, pf.nachname, pf.adresse, pf.firma, pf.personalnummer, pf.berufsstand, userTeamId, ts);
      g.rollen.forEach(function (r) { db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?,?)').run(userId, r); });
      if (hatTeamleiter) teamleiterUserId = userId;
      if (g.rollen.indexOf('bezirksleitung') !== -1) bezirksleitungUserId = userId;
      ergebnisUsers.push({ id: userId, username: g.raw.username, roles: g.rollen });
    });
    // Henne-Ei-Aufloesung (Architektur-Vorgabe): Bezirk/Team werden ohne Leiter angelegt, erst NACH
    // Anlage aller User die Leiter-Referenz nachtragen.
    if (teamleiterUserId) db.prepare('UPDATE teams SET leiter_user_id = ? WHERE id = ?').run(teamleiterUserId, teamId);
    if (bezirksleitungUserId) db.prepare('UPDATE bezirke SET leiter_user_id = ? WHERE id = ?').run(bezirksleitungUserId, bezirkId);
  });
  tx();
  res.json({ tenantId: tenantId, bezirkId: bezirkId, teamId: teamId, users: ergebnisUsers });
});

// ---------- Login ----------
app.post('/api/login', function (req, res) {
  var b = req.body || {};
  var username = b.username || '', ip = req.ip;
  var ipBis = gesperrtBis('ip', ip);
  if (ipBis) return res.status(429).json({ error: 'Zu viele Anmeldeversuche von dieser Verbindung — bitte in ' + sperrMinuten(ipBis) + ' Minute(n) erneut versuchen.' });
  var userBis = gesperrtBis('user', username);
  if (userBis) return res.status(429).json({ error: 'Zu viele Fehlversuche für diesen Benutzernamen — bitte in ' + sperrMinuten(userBis) + ' Minute(n) erneut versuchen.' });
  var u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  // Gegen Konto existiert vs. Passwort falsch unterscheidbar via Antwortzeit: bcrypt läuft IMMER
  // (gegen einen Dummy-Hash bei unbekanntem Username), nicht nur wenn der Account real existiert.
  var passwortOk = bcrypt.compareSync(b.password || '', u ? u.password_hash : DUMMY_HASH);
  if (!u || !u.active || !passwortOk) {
    vermerkeFehlversuch('user', username, LOGIN_MAX);
    vermerkeFehlversuch('ip', ip, IP_MAX);
    return res.status(401).json({ error: 'Benutzername oder Passwort falsch, oder Account deaktiviert.' });
  }
  entsperre('user', username); entsperre('ip', ip);
  var tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(u.tenant_id);
  var token = jwt.sign({ sub: u.id, tenantId: u.tenant_id, role: u.role }, JWT_SECRET, { expiresIn: '12h' });
  // Organisationsstruktur Phase 3 (2026-10-24, Architektur-Vorgabe "Login-Vertrag umbauen"): liefert
  // ALLE klient_dek_wraps-Zeilen des Nutzers als Rohdaten (NICHT entschluesselt -- der Server kann/darf
  // das ohnehin nicht, s. db.js-Sicherheitsprinzip). BEWUSST kein eager PBKDF2 hier -- das waere Client-
  // seitige Aufgabe, und zwar lazy erst beim tatsaechlichen Oeffnen eines Klienten (Performance-Vorgabe:
  // 150k Iterationen x N Klienten beim Login waere bei vielen Klienten spuerbar langsam).
  // Legacy-Feld "wrappedDek" (Tenant-weiter Pfad fuer Firmenstammdaten/settings/pfks, s. /api/blob)
  // bleibt BEWUSST zusaetzlich erhalten -- Phase 4 (Frontend) ist noch nicht umgestellt, ein ersatzloses
  // Entfernen wuerde den bisherigen Login-Vertrag fuer die produktive App sofort brechen.
  var klientenListe = db.prepare(
    'SELECT w.wrap_salt, w.wrap_iv, w.wrap_ct, w.wrap_art, k.id AS klient_id, k.label AS klient_label, t.name AS team_name ' +
    'FROM klient_dek_wraps w JOIN klienten k ON k.id = w.klient_id LEFT JOIN teams t ON t.id = k.team_id ' +
    'WHERE w.user_id = ? AND k.tenant_id = ? ORDER BY k.label'
  ).all(u.id, u.tenant_id).map(function (r) {
    return {
      id: r.klient_id, label: r.klient_label, teamName: r.team_name || null, wrapArt: r.wrap_art,
      wrappedDek: { salt: r.wrap_salt, iv: r.wrap_iv, ct: r.wrap_ct }
    };
  });
  res.json({
    token: token,
    user: publicUser(u),
    tenantId: tenant.id,
    tenantName: tenant.name,
    wrappedDek: { salt: u.wrapped_dek_salt, iv: u.wrapped_dek_iv, ct: u.wrapped_dek_ct },
    // K5 Public-Key-Envelope (2026-10-25): eigenes RSA-OAEP-Schluesselpaar NUR fuer den eingeloggten
    // Nutzer selbst (s. db.js-Kommentar bei users) -- damit der Client weiss, ob er noch eines per
    // POST /api/users/me/keypair generieren+hochladen muss. publicKey eines FREMDEN Nutzers kommt
    // ausschliesslich ueber GET /api/users/:id/public-key, niemals hier. null, solange noch keines
    // existiert (Bestandsnutzer vor diesem Feature, oder lazy noch nicht generiert).
    publicKey: u.public_key || null,
    wrappedPrivkey: u.public_key ? { salt: u.wrapped_privkey_salt, iv: u.wrapped_privkey_iv, ct: u.wrapped_privkey_ct } : null,
    klienten: klientenListe
  });
});

app.get('/api/me', auth, function (req, res) {
  var tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.user.tenant_id);
  res.json({ user: publicUser(req.user), tenantId: tenant.id, tenantName: tenant.name });
});

// ---------- K5 Public-Key-Envelope (2026-10-25, security-privacy-Architektur "Variante B") ----------
// Setzt das eigene RSA-OAEP-Schluesselpaar EINMALIG (der Client generiert es, der Server sieht den
// privaten Schluessel nie im Klartext -- wrappedPrivkey ist bereits mit der eigenen PIN gewrappt,
// identisches Prinzip wie wrapped_dek_*). "Einmal setzen, danach 409 ohne force" (s. Auftrag) --
// force=true erlaubt eine spaetere, bewusste Rotation (noch kein Aufrufer in dieser Phase, aber
// serverseitig schon vorgesehen, damit eine kuenftige Rotation keinen weiteren Endpunkt-Umbau braucht).
app.post('/api/users/me/keypair', auth, function (req, res) {
  var b = req.body || {};
  var wp = b.wrappedPrivkey || {};
  if (!b.publicKey || !wp.salt || !wp.iv || !wp.ct) {
    return res.status(400).json({ error: 'publicKey und wrappedPrivkey{salt,iv,ct} erforderlich.' });
  }
  if (req.user.public_key && !b.force) {
    return res.status(409).json({ error: 'Es existiert bereits ein Schlüsselpaar für diesen Account.' });
  }
  db.prepare(
    'UPDATE users SET public_key = ?, wrapped_privkey_salt = ?, wrapped_privkey_iv = ?, wrapped_privkey_ct = ? WHERE id = ?'
  ).run(b.publicKey, wp.salt, wp.iv, wp.ct, req.user.id);
  res.json({ publicKey: b.publicKey, wrappedPrivkey: { salt: wp.salt, iv: wp.iv, ct: wp.ct } });
});

// Liefert NUR den oeffentlichen Schluessel eines BELIEBIGEN Nutzers desselben Mandanten (unkritisch im
// Klartext, s. db.js-Kommentar) -- wird von der gewaehrenden Person aufgerufen, um die Klient-DEK fuer
// die Zielperson zu verschluesseln. Liefert NIEMALS wrappedPrivkey eines fremden Nutzers.
app.get('/api/users/:id/public-key', auth, function (req, res) {
  var u = db.prepare('SELECT public_key FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!u) return res.status(404).json({ error: 'Nutzer nicht gefunden.' });
  res.json({ publicKey: u.public_key || null });
});

// ---------- Nutzerverwaltung (Mandant-intern) ----------
app.get('/api/users', auth, function (req, res) {
  var rows = db.prepare('SELECT * FROM users WHERE tenant_id = ? ORDER BY display_name').all(req.user.tenant_id);
  res.json(rows.map(publicUser));
});

app.post('/api/users', auth, requireAdmin, function (req, res) {
  var b = req.body || {};
  if (!b.username || !b.password || !b.displayName || !b.wrappedDek) {
    return res.status(400).json({ error: 'username, password, displayName, wrappedDek erforderlich.' });
  }
  if (!istGueltigeNeuePin(b.password)) return res.status(400).json({ error: 'Start-PIN muss genau 6 Ziffern haben.' });
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(b.username)) {
    return res.status(409).json({ error: 'Benutzername bereits vergeben.' });
  }
  var userId = uuid(), ts = nowIso(), pf = profilFelderAus(b);
  var rollen = gueltigeRollenAusBody(b, 'ma');
  // must_change_password = 1: René-Direktive 2026-10-09 -- eine vom Admin vergebene PIN ist eine
  // Einmal-PIN, die Person MUSS sie beim ersten Login sofort durch eine eigene ersetzen.
  // Profil-Felder (René-Auftrag 2026-10-11 "Profil-Anlage über die Master-Instanz"): alle optional --
  // fehlende Angaben blockieren das Anlegen nicht, bleiben nur leer bis nachgetragen (PATCH).
  // users.role (Singular) erhaelt die erste gueltige Rolle als Anzeige-Altfeld (publicUser()) --
  // user_roles (Mengen-Tabelle) ist die eigentliche Autorisierungs-Quelle, beide in einer Transaktion
  // konsistent gehalten.
  var txNeu = db.transaction(function () {
    db.prepare(
      'INSERT INTO users (id, tenant_id, username, password_hash, display_name, role, telefon, wrapped_dek_salt, wrapped_dek_iv, wrapped_dek_ct, active, must_change_password, pfk_kuerzel, vorname, nachname, adresse, firma, personalnummer, berufsstand, created_at) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?,1,1,?,?,?,?,?,?,?,?)'
    ).run(userId, req.user.tenant_id, b.username, bcrypt.hashSync(b.password, 10), b.displayName,
      rollen[0], b.telefon || '', b.wrappedDek.salt, b.wrappedDek.iv, b.wrappedDek.ct,
      pf.pfkKuerzel, pf.vorname, pf.nachname, pf.adresse, pf.firma, pf.personalnummer, pf.berufsstand, ts);
    rollen.forEach(function (r) { db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?,?)').run(userId, r); });
  });
  txNeu();
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId)));
});

app.patch('/api/users/:id', auth, requireAdmin, function (req, res) {
  var u = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!u) return res.status(404).json({ error: 'Nicht gefunden.' });
  var b = req.body || {};
  // Phase 2: Rollenaenderung haelt users.role (Anzeige-Altfeld) UND user_roles (Autorisierungs-
  // Quelle) konsistent. Weder b.roles noch b.role im Body -> Rollen bleiben vollstaendig unberuehrt
  // (kein versehentliches Zuruecksetzen bei einem reinen Profil-/Aktiv-Update).
  var rollenGesetzt = Array.isArray(b.roles) || typeof b.role === 'string';
  var rollen = rollenGesetzt ? gueltigeRollenAusBody(b, u.role) : null;
  var neueSingularRolle = rollen ? rollen[0] : u.role;
  // Organisationsstruktur Phase 3 (2026-10-24): teamId setzbar -- ordnet den Nutzer einem Team zu/um.
  // WICHTIG, bewusst NICHT in dieser Route erledigt: die eigentliche DEK-Freigabe fuer die Klienten
  // dieses Teams passiert NICHT automatisch -- das waere ein Server-seitiges Krypto-Wunder, das es
  // nicht geben kann (Server hat nie eine entschluesselte DEK). Ein separater Schritt ueber
  // POST /api/klienten/:id/wraps (durch jemanden, der die DEK bereits im Speicher haelt) ist zwingend
  // nötig, bevor die neu zugeordnete Person tatsaechlich auf die Klienten des Teams zugreifen kann.
  var teamIdGesetzt = typeof b.teamId !== 'undefined';
  var neuesTeamId = u.team_id;
  if (teamIdGesetzt) {
    if (b.teamId === null) {
      neuesTeamId = null;
    } else {
      var teamZiel = db.prepare('SELECT id FROM teams WHERE id = ? AND tenant_id = ?').get(b.teamId, req.user.tenant_id);
      if (!teamZiel) return res.status(400).json({ error: 'teamId ungültig oder nicht in diesem Mandanten.' });
      neuesTeamId = b.teamId;
    }
  }
  var txPatch = db.transaction(function () {
    db.prepare(
      'UPDATE users SET display_name = ?, telefon = ?, role = ?, active = ?, pfk_kuerzel = ?, vorname = ?, nachname = ?, adresse = ?, firma = ?, personalnummer = ?, berufsstand = ?, team_id = ? WHERE id = ?'
    ).run(
      typeof b.displayName === 'string' ? b.displayName : u.display_name,
      typeof b.telefon === 'string' ? b.telefon : u.telefon,
      neueSingularRolle,
      typeof b.active === 'boolean' ? (b.active ? 1 : 0) : u.active,
      typeof b.pfkKuerzel === 'string' ? b.pfkKuerzel.trim().slice(0, 10) : u.pfk_kuerzel,
      typeof b.vorname === 'string' ? b.vorname.trim().slice(0, 60) : u.vorname,
      typeof b.nachname === 'string' ? b.nachname.trim().slice(0, 60) : u.nachname,
      typeof b.adresse === 'string' ? b.adresse.trim().slice(0, 300) : u.adresse,
      typeof b.firma === 'string' ? b.firma.trim().slice(0, 120) : u.firma,
      typeof b.personalnummer === 'string' ? b.personalnummer.trim().slice(0, 40) : u.personalnummer,
      typeof b.berufsstand === 'string' ? b.berufsstand.trim().slice(0, 60) : u.berufsstand,
      neuesTeamId,
      u.id
    );
    if (rollen) {
      db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(u.id);
      rollen.forEach(function (r) { db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?,?)').run(u.id, r); });
    }
  });
  txPatch();
  res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)));
});

// Passwort-Reset durch Admin: Admin hat die DEK im Speicher (nach eigenem Login) und wrappt sie
// client-seitig mit dem neuen Passwort des Ziel-Nutzers neu -- der Server bekommt nur das Ergebnis.
app.post('/api/users/:id/password-reset', auth, requireAdmin, function (req, res) {
  var u = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!u) return res.status(404).json({ error: 'Nicht gefunden.' });
  var b = req.body || {};
  if (!b.password || !b.wrappedDek) return res.status(400).json({ error: 'password, wrappedDek erforderlich.' });
  if (!istGueltigeNeuePin(b.password)) return res.status(400).json({ error: 'PIN muss genau 6 Ziffern haben.' });
  // Ein Admin-Reset ist ebenfalls eine Einmal-PIN -- erneut Pflicht-Änderung beim nächsten Login,
  // DEK bleibt dabei unverändert (nur neu gewrappt), also kein Datenverlust/keine Sperre der
  // bisherigen Dokumentations-Einträge (René-Direktive, "Achtung"-Punkt).
  db.prepare('UPDATE users SET password_hash = ?, wrapped_dek_salt = ?, wrapped_dek_iv = ?, wrapped_dek_ct = ?, must_change_password = 1 WHERE id = ?')
    .run(bcrypt.hashSync(b.password, 10), b.wrappedDek.salt, b.wrappedDek.iv, b.wrappedDek.ct, u.id);
  res.json({ ok: true });
});

// Eigenes Passwort ändern (Nutzer hat die DEK selbst im Speicher, wrappt client-seitig neu) --
// hebt must_change_password auf, da die Person jetzt selbst eine eigene PIN gewählt hat.
app.post('/api/me/password', auth, function (req, res) {
  var b = req.body || {};
  if (!b.password || !b.wrappedDek) return res.status(400).json({ error: 'password, wrappedDek erforderlich.' });
  if (!istGueltigeNeuePin(b.password)) return res.status(400).json({ error: 'PIN muss genau 6 Ziffern haben.' });
  db.prepare('UPDATE users SET password_hash = ?, wrapped_dek_salt = ?, wrapped_dek_iv = ?, wrapped_dek_ct = ?, must_change_password = 0 WHERE id = ?')
    .run(bcrypt.hashSync(b.password, 10), b.wrappedDek.salt, b.wrappedDek.iv, b.wrappedDek.ct, req.user.id);
  res.json({ ok: true });
});

// ---------- Organisationsstruktur Phase 3 (2026-10-24): Bezirke/Teams-CRUD ----------
app.post('/api/bezirke', auth, requireAdmin, function (req, res) {
  var b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'name erforderlich.' });
  var row = { id: uuid(), tenant_id: req.user.tenant_id, name: String(b.name).trim().slice(0, 120), leiter_user_id: null, created_at: nowIso() };
  db.prepare('INSERT INTO bezirke (id, tenant_id, name, leiter_user_id, created_at) VALUES (@id,@tenant_id,@name,@leiter_user_id,@created_at)').run(row);
  res.json(rowToBezirk(row));
});

app.patch('/api/bezirke/:id', auth, requireAdmin, function (req, res) {
  var bez = db.prepare('SELECT * FROM bezirke WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!bez) return res.status(404).json({ error: 'Nicht gefunden.' });
  var b = req.body || {};
  var neuerLeiter = bez.leiter_user_id;
  if (typeof b.leiterUserId !== 'undefined') {
    if (b.leiterUserId === null) {
      neuerLeiter = null;
    } else {
      var leiter = db.prepare('SELECT id FROM users WHERE id = ? AND tenant_id = ?').get(b.leiterUserId, req.user.tenant_id);
      // Architektur-Vorgabe: leiter_user_id MUSS ein Nutzer mit Rolle "bezirksleitung" sein -- die Rolle
      // muss also VORHER per PATCH /api/users/:id vergeben worden sein (zweistufiger Ablauf, kein Fehler).
      if (!leiter || !hatRolle(leiter.id, 'bezirksleitung')) {
        return res.status(400).json({ error: 'leiterUserId muss ein Nutzer mit Rolle "bezirksleitung" in diesem Mandanten sein.' });
      }
      neuerLeiter = b.leiterUserId;
    }
  }
  var neuerName = typeof b.name === 'string' ? b.name.trim().slice(0, 120) : bez.name;
  db.prepare('UPDATE bezirke SET name = ?, leiter_user_id = ? WHERE id = ?').run(neuerName, neuerLeiter, bez.id);
  res.json(rowToBezirk(db.prepare('SELECT * FROM bezirke WHERE id = ?').get(bez.id)));
});

app.post('/api/teams', auth, requireAdmin, function (req, res) {
  var b = req.body || {};
  if (!b.name || !b.bezirkId) return res.status(400).json({ error: 'name, bezirkId erforderlich.' });
  var bezirk = db.prepare('SELECT id FROM bezirke WHERE id = ? AND tenant_id = ?').get(b.bezirkId, req.user.tenant_id);
  if (!bezirk) return res.status(404).json({ error: 'Bezirk nicht gefunden.' });
  var row = { id: uuid(), tenant_id: req.user.tenant_id, bezirk_id: b.bezirkId, name: String(b.name).trim().slice(0, 120), leiter_user_id: null, created_at: nowIso() };
  db.prepare('INSERT INTO teams (id, tenant_id, bezirk_id, name, leiter_user_id, created_at) VALUES (@id,@tenant_id,@bezirk_id,@name,@leiter_user_id,@created_at)').run(row);
  res.json(teamMitBezirk(row.id));
});

app.patch('/api/teams/:id', auth, requireAdmin, function (req, res) {
  var team = db.prepare('SELECT * FROM teams WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!team) return res.status(404).json({ error: 'Nicht gefunden.' });
  var b = req.body || {};
  var neuerLeiter = team.leiter_user_id;
  if (typeof b.leiterUserId !== 'undefined') {
    if (b.leiterUserId === null) {
      neuerLeiter = null;
    } else {
      var leiter = db.prepare('SELECT id FROM users WHERE id = ? AND tenant_id = ?').get(b.leiterUserId, req.user.tenant_id);
      if (!leiter || !hatRolle(leiter.id, 'teamleiter')) {
        return res.status(400).json({ error: 'leiterUserId muss ein Nutzer mit Rolle "teamleiter" in diesem Mandanten sein.' });
      }
      neuerLeiter = b.leiterUserId;
    }
  }
  var neuerName = typeof b.name === 'string' ? b.name.trim().slice(0, 120) : team.name;
  db.prepare('UPDATE teams SET name = ?, leiter_user_id = ? WHERE id = ?').run(neuerName, neuerLeiter, team.id);
  res.json(teamMitBezirk(team.id));
});

// GET /api/bezirke, GET /api/teams: serverseitig scope-gefiltert nach Architektur-Vorgabe --
// admin/hr sehen alles, bezirksleitung nur den/die eigenen Bezirk(e)+dessen Teams, teamleiter/ma nur
// das eigene Team (+Bezirk-Name). Mehrfachrollen (Phase 2): die breiteste zutreffende Sicht gewinnt
// (admin/hr > bezirksleitung > eigenes Team) -- wer z.B. bezirksleitung UND ma ist, sieht den vollen
// Bezirk, nicht nur das eigene Team.
app.get('/api/bezirke', auth, function (req, res) {
  var rows;
  if (hatEineRolle(req.user.id, ['admin', 'hr'])) {
    rows = db.prepare('SELECT * FROM bezirke WHERE tenant_id = ? ORDER BY name').all(req.user.tenant_id);
  } else if (hatRolle(req.user.id, 'bezirksleitung')) {
    rows = db.prepare('SELECT * FROM bezirke WHERE tenant_id = ? AND leiter_user_id = ? ORDER BY name').all(req.user.tenant_id, req.user.id);
  } else if (req.user.team_id) {
    rows = db.prepare('SELECT b.* FROM bezirke b JOIN teams t ON t.bezirk_id = b.id WHERE t.id = ? AND b.tenant_id = ?').all(req.user.team_id, req.user.tenant_id);
  } else {
    rows = [];
  }
  res.json(rows.map(rowToBezirk));
});
app.get('/api/teams', auth, function (req, res) {
  var rows;
  if (hatEineRolle(req.user.id, ['admin', 'hr'])) {
    rows = db.prepare('SELECT t.*, b.name AS bezirk_name FROM teams t JOIN bezirke b ON b.id = t.bezirk_id WHERE t.tenant_id = ? ORDER BY b.name, t.name').all(req.user.tenant_id);
  } else if (hatRolle(req.user.id, 'bezirksleitung')) {
    rows = db.prepare('SELECT t.*, b.name AS bezirk_name FROM teams t JOIN bezirke b ON b.id = t.bezirk_id WHERE t.tenant_id = ? AND b.leiter_user_id = ? ORDER BY t.name').all(req.user.tenant_id, req.user.id);
  } else if (req.user.team_id) {
    rows = db.prepare('SELECT t.*, b.name AS bezirk_name FROM teams t JOIN bezirke b ON b.id = t.bezirk_id WHERE t.id = ? AND t.tenant_id = ?').all(req.user.team_id, req.user.tenant_id);
  } else {
    rows = [];
  }
  res.json(rows.map(rowToTeam));
});

// ---------- Organisationsstruktur Phase 3: Klienten-CRUD + Pro-Klient-DEK-Provisionierung ----------
// Der Client (NICHT der Server) erzeugt die Klient-DEK und verschluesselt sie initial fuer mind. den
// anfragenden Account -- der Server sieht nur das fertige Wrap-Ergebnis, nie die Klartext-DEK.
app.post('/api/klienten', auth, requireAdminOderBezirksleitungFuerTeam, function (req, res) {
  var b = req.body || {};
  if (!b.teamId || !b.label) return res.status(400).json({ error: 'teamId, label erforderlich.' });
  var team = db.prepare('SELECT id FROM teams WHERE id = ? AND tenant_id = ?').get(b.teamId, req.user.tenant_id);
  if (!team) return res.status(404).json({ error: 'Team nicht gefunden.' });
  var wraps = Array.isArray(b.initialeWraps) ? b.initialeWraps : [];
  if (!wraps.length) return res.status(400).json({ error: 'initialeWraps erforderlich (mindestens ein Wrap).' });
  for (var i = 0; i < wraps.length; i++) {
    var w = wraps[i];
    if (!w || !w.userId || !w.wrapArt || !w.wrapSalt || !w.wrapIv || !w.wrapCt) {
      return res.status(400).json({ error: 'Jeder Eintrag in initialeWraps braucht userId, wrapArt, wrapSalt, wrapIv, wrapCt.' });
    }
    if (KLIENT_WRAP_ARTEN.indexOf(w.wrapArt) === -1) return res.status(400).json({ error: 'Ungültige wrapArt (nur "pin"/"recovery").' });
    var zielNutzer = db.prepare('SELECT id FROM users WHERE id = ? AND tenant_id = ?').get(w.userId, req.user.tenant_id);
    if (!zielNutzer) return res.status(400).json({ error: 'initialeWraps enthält einen Nutzer außerhalb dieses Mandanten.' });
  }
  // Server-seitige Invariante (eigene, ueber den Wortlaut der Architektur-Vorgabe hinausgehende
  // Entscheidung, hier bewusst dokumentiert statt stillschweigend angenommen): mindestens der
  // anfragende Account selbst MUSS unter den initialen Wraps sein -- sonst entstuende ein Klient, den
  // serverseitig niemand mehr entschluesseln kann (Zero-Knowledge-Sackgasse, nicht reparierbar).
  var eigenerWrapDabei = wraps.some(function (w) { return w.userId === req.user.id; });
  if (!eigenerWrapDabei) return res.status(400).json({ error: 'initialeWraps muss mindestens einen Wrap für den anfragenden Account enthalten.' });

  var klientId = uuid(), ts = nowIso();
  var txKlient = db.transaction(function () {
    db.prepare('INSERT INTO klienten (id, tenant_id, team_id, label, status, created_at) VALUES (?,?,?,?,\'aktiv\',?)')
      .run(klientId, req.user.tenant_id, b.teamId, String(b.label).trim().slice(0, 160), ts);
    wraps.forEach(function (w) {
      db.prepare(
        'INSERT INTO klient_dek_wraps (klient_id, user_id, wrap_salt, wrap_iv, wrap_ct, wrap_art, granted_by, granted_at) VALUES (?,?,?,?,?,?,?,?)'
      ).run(klientId, w.userId, w.wrapSalt, w.wrapIv, w.wrapCt, w.wrapArt, req.user.id, ts);
    });
  });
  txKlient();
  res.json({ klientId: klientId });
});

// GET /api/klienten (bislang fehlend -- ohne diesen Endpunkt kann niemand serverseitig die
// Klienten eines Teams einsehen, um gezielt Zugriff per POST /:id/wraps zu gewaehren). Scope
// identisch zum Muster von GET /api/teams/GET /api/bezirke: admin/hr alle Klienten des Tenants,
// bezirksleitung nur Klienten der Teams des eigenen Bezirks, teamleiter/ma nur Klienten des
// eigenen Teams. Nur Metadaten (KEIN Blob-Inhalt) -- Zero-Knowledge bleibt gewahrt.
app.get('/api/klienten', auth, function (req, res) {
  var rows;
  if (hatEineRolle(req.user.id, ['admin', 'hr'])) {
    rows = db.prepare(
      'SELECT k.*, t.name AS team_name FROM klienten k LEFT JOIN teams t ON t.id = k.team_id WHERE k.tenant_id = ? ORDER BY t.name, k.label'
    ).all(req.user.tenant_id);
  } else if (hatRolle(req.user.id, 'bezirksleitung')) {
    rows = db.prepare(
      'SELECT k.*, t.name AS team_name FROM klienten k JOIN teams t ON t.id = k.team_id JOIN bezirke b ON b.id = t.bezirk_id ' +
      'WHERE k.tenant_id = ? AND b.leiter_user_id = ? ORDER BY t.name, k.label'
    ).all(req.user.tenant_id, req.user.id);
  } else if (req.user.team_id) {
    rows = db.prepare(
      'SELECT k.*, t.name AS team_name FROM klienten k JOIN teams t ON t.id = k.team_id WHERE k.team_id = ? AND k.tenant_id = ? ORDER BY k.label'
    ).all(req.user.team_id, req.user.tenant_id);
  } else {
    rows = [];
  }
  res.json(rows.map(function (r) {
    return { id: r.id, label: r.label, teamId: r.team_id, teamName: r.team_name, status: r.status };
  }));
});

// Provisionierung: der AUFRUFENDE Client hat die Klient-DEK bereits entschluesselt im Speicher
// (sonst koennte er sie gar nicht fuer einen Dritten neu wrappen) und liefert hier nur das fertige
// Wrap-Objekt fuer den Ziel-Nutzer ab -- reiner Transport, keine Server-seitige Krypto.
app.post('/api/klienten/:id/wraps', auth, function (req, res) {
  var klient = db.prepare('SELECT * FROM klienten WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!klient) return res.status(404).json({ error: 'Klient nicht gefunden.' });
  // Plausibilitaetspruefung (KEINE Krypto-Pruefung, die kann der Server nicht leisten): der Aufrufer
  // muss selbst bereits einen Wrap fuer diesen Klienten haben, sonst koennte er technisch gar nicht
  // wissen, was er da an einen Dritten weitergibt.
  var eigenerWrap = db.prepare('SELECT 1 FROM klient_dek_wraps WHERE klient_id = ? AND user_id = ?').get(klient.id, req.user.id);
  if (!eigenerWrap) return res.status(403).json({ error: 'Kein eigener Zugriff auf diesen Klienten — kann die DEK nicht weitergeben.' });

  var b = req.body || {};
  if (!b.userId || !b.wrapArt || !b.wrapSalt || !b.wrapIv || !b.wrapCt) {
    return res.status(400).json({ error: 'userId, wrapArt, wrapSalt, wrapIv, wrapCt erforderlich.' });
  }
  if (KLIENT_WRAP_ARTEN.indexOf(b.wrapArt) === -1) return res.status(400).json({ error: 'Ungültige wrapArt (nur "pin"/"recovery").' });
  var zielNutzer = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?').get(b.userId, req.user.tenant_id);
  if (!zielNutzer) return res.status(404).json({ error: 'Zielnutzer nicht in diesem Mandanten gefunden.' });

  // Rollen-/Scope-Pruefung: Admin immer; Bezirksleitung fuer Klienten/User des eigenen Bezirks;
  // Teamleiter (René-Direktive 2026-10-24, Alltagstauglichkeit "neue MA braucht nicht erst Admin/
  // Bezirksleitung") NUR fuer Klienten des EIGENEN Teams UND NUR an Ziel-Nutzer desselben Teams --
  // spiegelt das Bezirksleitung-Scope-Prinzip eine Ebene tiefer. Teamzugehoerigkeit wird ueber
  // users.team_id geprueft (nicht teams.leiter_user_id), da das die bereits etablierte "eigenes
  // Team"-Pruefung aus GET /api/teams/GET /api/bezirke ist (robuster: funktioniert auch, wenn ein
  // Team noch keinen formal gesetzten leiter_user_id hat, was ein separater, optionaler Admin-
  // Schritt via PATCH /api/teams/:id ist). Sonst 403.
  var darfGewaehren = false;
  if (hatRolle(req.user.id, 'admin')) {
    darfGewaehren = true;
  } else if (hatRolle(req.user.id, 'bezirksleitung') && klient.team_id) {
    var klientTeam = db.prepare('SELECT * FROM teams WHERE id = ?').get(klient.team_id);
    var eigenerBezirk = klientTeam ? db.prepare('SELECT id FROM bezirke WHERE id = ? AND leiter_user_id = ?').get(klientTeam.bezirk_id, req.user.id) : null;
    if (eigenerBezirk) {
      var zielTeam = zielNutzer.team_id ? db.prepare('SELECT bezirk_id FROM teams WHERE id = ?').get(zielNutzer.team_id) : null;
      darfGewaehren = (zielTeam && zielTeam.bezirk_id === klientTeam.bezirk_id) || zielNutzer.id === req.user.id;
    }
  } else if (hatRolle(req.user.id, 'teamleiter') && klient.team_id && req.user.team_id === klient.team_id) {
    darfGewaehren = zielNutzer.team_id === klient.team_id || zielNutzer.id === req.user.id;
  }
  if (!darfGewaehren) return res.status(403).json({ error: 'Kein Recht, diesem Nutzer Zugriff auf diesen Klienten zu gewähren.' });

  db.prepare(
    'INSERT INTO klient_dek_wraps (klient_id, user_id, wrap_salt, wrap_iv, wrap_ct, wrap_art, granted_by, granted_at) VALUES (?,?,?,?,?,?,?,?) ' +
    'ON CONFLICT(klient_id, user_id, wrap_art) DO UPDATE SET wrap_salt = excluded.wrap_salt, wrap_iv = excluded.wrap_iv, wrap_ct = excluded.wrap_ct, granted_by = excluded.granted_by, granted_at = excluded.granted_at'
  ).run(klient.id, b.userId, b.wrapSalt, b.wrapIv, b.wrapCt, b.wrapArt, req.user.id, nowIso());
  res.json({ ok: true });
});

// ---------- Pro-Klient-Blob (persist()-Gegenstück, identisches Muster wie /api/blob) ----------
// 404 bei fehlendem eigenem Wrap (statt 403) -- analog bestehendem Cross-Tenant-Schutz-Muster, kein
// Leak, ob der Klient ueberhaupt existiert, wenn der Aufrufer keinen Zugriff hat.
app.get('/api/klient-blob/:klientId', auth, function (req, res) {
  var klient = db.prepare('SELECT id FROM klienten WHERE id = ? AND tenant_id = ?').get(req.params.klientId, req.user.tenant_id);
  if (!klient) return res.status(404).json({ error: 'Klient nicht gefunden.' });
  var eigenerWrap = db.prepare('SELECT 1 FROM klient_dek_wraps WHERE klient_id = ? AND user_id = ?').get(klient.id, req.user.id);
  if (!eigenerWrap) return res.status(404).json({ error: 'Klient nicht gefunden.' });
  var row = db.prepare('SELECT * FROM klient_blob WHERE klient_id = ?').get(klient.id);
  if (!row) return res.status(404).json({ error: 'Noch kein Datenstand.' });
  res.json({ iv: row.iv, ct: row.ct, updatedAt: row.updated_at });
});
app.put('/api/klient-blob/:klientId', auth, function (req, res) {
  var klient = db.prepare('SELECT id FROM klienten WHERE id = ? AND tenant_id = ?').get(req.params.klientId, req.user.tenant_id);
  if (!klient) return res.status(404).json({ error: 'Klient nicht gefunden.' });
  var eigenerWrap = db.prepare('SELECT 1 FROM klient_dek_wraps WHERE klient_id = ? AND user_id = ?').get(klient.id, req.user.id);
  if (!eigenerWrap) return res.status(404).json({ error: 'Klient nicht gefunden.' });
  var b = req.body || {};
  if (!b.iv || !b.ct) return res.status(400).json({ error: 'iv, ct erforderlich.' });
  var ts = nowIso();
  db.prepare(
    'INSERT INTO klient_blob (klient_id, tenant_id, iv, ct, updated_at, updated_by) VALUES (?,?,?,?,?,?) ' +
    'ON CONFLICT(klient_id) DO UPDATE SET iv = excluded.iv, ct = excluded.ct, updated_at = excluded.updated_at, updated_by = excluded.updated_by'
  ).run(klient.id, req.user.tenant_id, b.iv, b.ct, ts, req.user.id);
  res.json({ ok: true, updatedAt: ts });
});

// ---------- Tenant-Löschung (Art. 17 DSGVO, René-Auftrag 2026-10-10) ----------
// Vorher gab es nur Deaktivieren einzelner Nutzer (users.active), keine echte Loeschung eines
// ganzen Mandanten -- legal-compliance-Fund 2026-10-02 ("kein echter Loeschmechanismus"). Admin-
// only, verlangt die eigene PIN erneut als Bestaetigung (schuetzt gegen versehentliches/CSRF-
// ausgeloestes Loeschen ueber einen reinen Button-Klick). Unwiderruflich -- loescht in einer
// Transaktion alle Tenant-skopierten Zeilen (Dienstplan, Blob, alle Nutzer) + den Tenant selbst.
// security-privacy-Fund Runde 2 (2026-10-10): die PIN-Reauthentifizierung hatte KEIN Lockout --
// wer an ein gueltiges Admin-JWT kommt, haette die 6-stellige PIN unbegrenzt online durchprobieren
// und am Ende den gesamten Mandanten unwiderruflich loeschen koennen. Gleicher Mechanismus wie
// /api/login (persistent, ueberlebt einen Neustart), eigener 'tenant_delete'-Sperr-Typ pro User-ID.
var TENANT_DELETE_MAX = 5;
app.delete('/api/tenant', auth, requireAdmin, function (req, res) {
  var b = req.body || {};
  var sperrBis = gesperrtBis('tenant_delete', req.user.id);
  if (sperrBis) return res.status(429).json({ error: 'Zu viele Fehlversuche — bitte in ' + sperrMinuten(sperrBis) + ' Minute(n) erneut versuchen.' });
  if (!b.password) return res.status(400).json({ error: 'Eigene PIN zur Bestätigung erforderlich.' });
  if (!bcrypt.compareSync(b.password, req.user.password_hash)) {
    vermerkeFehlversuch('tenant_delete', req.user.id, TENANT_DELETE_MAX);
    return res.status(401).json({ error: 'PIN stimmt nicht überein.' });
  }
  entsperre('tenant_delete', req.user.id);
  var tenantId = req.user.tenant_id;
  var tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
  // Audit-Log VOR der Loeschung schreiben (security-privacy-Fund: "kein Audit-Log, wer wann
  // welchen Mandanten geloescht hat") -- eigene Tabelle, nicht Teil der Loesch-Transaktion unten,
  // damit der Eintrag die Loeschung selbst ueberlebt.
  db.prepare('INSERT INTO audit_log (id, aktion, akteur_user_id, akteur_username, ziel_tenant_id, ziel_tenant_name, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(uuid(), 'tenant_geloescht', req.user.id, req.user.username, tenantId, tenant ? tenant.name : '', nowIso());
  // devops-infra/testing-qa-Fund 2026-10-10 (Live-Test nach dem Architektur-Umbau): die neuen
  // BTM-/Medizinprodukte-/Wunden-/MD-Archiv-Tabellen (Fremdschluessel auf tenants) fehlten hier --
  // ein echter Loeschversuch schlug mit "FOREIGN KEY constraint failed" fehl (500), der Tenant blieb
  // unloeschbar stehen. Kind-Tabellen (eintraege) muessen vor den zugehoerigen Stammdaten-Tabellen
  // geloescht werden, da diese wiederum von den Eintraegen referenziert werden.
  var tx = db.transaction(function () {
    db.prepare('DELETE FROM dienst_eintraege WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM btm_eintraege WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM btm_monatspruefungen WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM btm_praeparate WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM mp_eintraege WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM mp_geraete WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM wunde_eintraege WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM wunden WHERE tenant_id = ?').run(tenantId);
    // Eigenstaendig beim Schreiben von Phase 3 gefundener, VORBESTEHENDER Luecke (kein Teil des
    // Architektur-Auftrags, aber direkt angrenzend): "meldungen" wurde hier bisher GAR NICHT geloescht
    // (seit der "Eintrag melden"-Funktion vom 2026-10-24) -- waere unter FK-Erzwingung (node:sqlite-
    // Testshim) UND als Organisationsstruktur-Phase-3-Blocker relevant geworden (meldungen.klient_id
    // referenziert klienten(id), s. u.). Gleich mitbehoben statt separat gemeldet.
    db.prepare('DELETE FROM meldungen WHERE tenant_id = ?').run(tenantId);
    // Organisationsstruktur Phase 3 (2026-10-24): neue Tabellen, Kind-vor-Stamm-Reihenfolge wie oben.
    // klient_dek_wraps/klient_blob referenzieren klienten(id), teams referenziert bezirke(id).
    db.prepare('DELETE FROM klient_dek_wraps WHERE klient_id IN (SELECT id FROM klienten WHERE tenant_id = ?)').run(tenantId);
    db.prepare('DELETE FROM klient_blob WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM klienten WHERE tenant_id = ?').run(tenantId);
    // devops-infra-Fund 2026-10-25 (zweiter Deploy-Verifikationsversuch): "teams" VOR "users" zu
    // loeschen schlaegt fehl, weil users.team_id REFERENCES teams(id) (additive Spalte, db.js:552) --
    // ABER "users" VOR "teams"/"bezirke" zu loeschen schlaegt GENAUSO fehl, weil teams.leiter_user_id/
    // bezirke.leiter_user_id REFERENCES users(id). Das ist ein ECHTER Zyklus teams<->users -- keine
    // reine Loeschreihenfolge kann ihn aufloesen. Fix: beide Richtungen vorher auf NULL setzen, danach
    // ist die Reihenfolge der folgenden DELETEs bzgl. dieses Zyklus unkritisch.
    db.prepare('UPDATE users SET team_id = NULL WHERE tenant_id = ?').run(tenantId);
    db.prepare('UPDATE teams SET leiter_user_id = NULL WHERE tenant_id = ?').run(tenantId);
    db.prepare('UPDATE bezirke SET leiter_user_id = NULL WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM teams WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM bezirke WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM md_archiv_checkpoints WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM blob WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM blob_fin WHERE tenant_id = ?').run(tenantId);
    // Phase-2-Fund (eigenstaendig beim Test-Lauf entdeckt, kein Architektur-Auftrag): user_roles
    // referenziert users(id) -- MUSS vor "DELETE FROM users" geloescht werden, sonst FOREIGN KEY
    // constraint failed (identisches Muster wie der bereits bestehende Kind-vor-Stamm-Kommentar
    // oben, hier fuer die neue Mengen-Rollen-Tabelle nachgezogen). Reproduziert mit dem node:sqlite-
    // Testshim, der (anders als better-sqlite3 in Produktion) foreign_keys standardmaessig erzwingt --
    // unabhaengig davon sind das sonst orphan-Zeilen, also auch fuer die Produktion ein echter Fix.
    db.prepare('DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE tenant_id = ?)').run(tenantId);
    db.prepare('DELETE FROM users WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM tenants WHERE id = ?').run(tenantId);
  });
  tx();
  res.json({ ok: true });
});

// ---------- Tenant-Blob (verschlüsselte Pflege-/Finanzdokumentation, s. db.js) ----------
app.get('/api/blob', auth, function (req, res) {
  var row = db.prepare('SELECT * FROM blob WHERE tenant_id = ?').get(req.user.tenant_id);
  if (!row) return res.status(404).json({ error: 'Noch kein Datenstand.' });
  res.json({ iv: row.iv, ct: row.ct, updatedAt: row.updated_at });
});
app.put('/api/blob', auth, function (req, res) {
  var b = req.body || {};
  if (!b.iv || !b.ct) return res.status(400).json({ error: 'iv, ct erforderlich.' });
  var ts = nowIso();
  db.prepare(
    'INSERT INTO blob (tenant_id, iv, ct, updated_at, updated_by) VALUES (?,?,?,?,?) ' +
    'ON CONFLICT(tenant_id) DO UPDATE SET iv = excluded.iv, ct = excluded.ct, updated_at = excluded.updated_at, updated_by = excluded.updated_by'
  ).run(req.user.tenant_id, b.iv, b.ct, ts, req.user.id);
  res.json({ ok: true, updatedAt: ts });
});

// ---------- AERIS Buch eigener Tenant-Blob (René-Direktive 2026-10-18, s. db.js blob_fin) ----------
// Identisches Muster wie /api/blob oben, bewusst eigene Tabelle (kein gemeinsames Last-Write-Wins
// zwischen Doku und Buch) -- beide Apps bleiben unabhaengig, teilen sich nur dieselbe Mandanten-DEK.
// René-Direktive 2026-10-24 (software-architect-Konzept "eigener Buch-Login, admin-only"): AERIS
// Buch im Server-Modus ist ausschliesslich fuer Admin-Accounts gedacht -- MA-Accounts bekommen beim
// Buch-Login zwar ein gueltiges Token (s. /api/login), /api/blob-fin lehnt fuer sie aber mit 403 ab.
app.get('/api/blob-fin', auth, requireAdmin, function (req, res) {
  var row = db.prepare('SELECT * FROM blob_fin WHERE tenant_id = ?').get(req.user.tenant_id);
  if (!row) return res.status(404).json({ error: 'Noch kein Datenstand.' });
  res.json({ iv: row.iv, ct: row.ct, updatedAt: row.updated_at });
});
app.put('/api/blob-fin', auth, requireAdmin, function (req, res) {
  var b = req.body || {};
  if (!b.iv || !b.ct) return res.status(400).json({ error: 'iv, ct erforderlich.' });
  var ts = nowIso();
  db.prepare(
    'INSERT INTO blob_fin (tenant_id, iv, ct, updated_at, updated_by) VALUES (?,?,?,?,?) ' +
    'ON CONFLICT(tenant_id) DO UPDATE SET iv = excluded.iv, ct = excluded.ct, updated_at = excluded.updated_at, updated_by = excluded.updated_by'
  ).run(req.user.tenant_id, b.iv, b.ct, ts, req.user.id);
  res.json({ ok: true, updatedAt: ts });
});

// ---------- Dienstplan: append-only, hash-verkettet (manipulationssicher) ----------
// WICHTIG (Organisationsstruktur Phase 1, 2026-10-24, nach eigenem Gegentest korrigiert): klient_id
// wird HIER BEWUSST NICHT in den Hash-Inhalt aufgenommen, obwohl das Muster auf den ersten Blick wie
// der chargen_nr/verfallsdatum-Fall (K7) aussieht. Unterschied: die Phase-1-Migration BACKFILLT
// klient_id auf bereits bestehenden, laengst hash-gesicherten Alt-Zeilen (UPDATE ... WHERE klient_id
// IS NULL, s. db.js) -- der gespeicherte hash-Wert dieser Zeilen wurde aber VOR der Migration berechnet,
// als klient_id noch gar nicht existierte. Eine NULL-sichere Aufnahme (wie bei chargen_nr, das NIE
// rueckwirkend befuellt wird) wuerde bei genau diesen migrierten Alt-Zeilen zu einem false-positive
// "Kette manipuliert" fuehren, weil der Verifikations-Hash klient_id dann mitrechnet, der gespeicherte
// Original-Hash aber nicht. Per echtem Migrationstest reproduziert (test/phase1-migration.test.js) --
// solange kein API-Endpunkt klient_id aktiv beim INSERT setzt, bleibt der Hash-Inhalt unveraendert.
function dienstContentHash(e, prevHash) {
  return sha256Hex(JSON.stringify({
    tenantId: e.tenant_id, userId: e.user_id, datum: e.datum, typ: e.typ, kuerzel: e.kuerzel,
    von: e.von, bis: e.bis, status: e.status, notiz: e.notiz, createdBy: e.created_by, createdAt: e.created_at
  }) + '|' + prevHash);
}
function rowToDienst(r) {
  return { id: r.id, userId: r.user_id, datum: r.datum, typ: r.typ, kuerzel: r.kuerzel, von: r.von, bis: r.bis, status: r.status, notiz: r.notiz, createdBy: r.created_by, createdAt: r.created_at };
}

app.get('/api/dienst', auth, function (req, res) {
  var von = req.query.von || '0000-01-01', bis = req.query.bis || '9999-12-31';
  var rows = db.prepare(
    'SELECT d.*, u.display_name AS user_name, u.telefon AS user_telefon FROM dienst_eintraege d ' +
    'JOIN users u ON u.id = d.user_id WHERE d.tenant_id = ? AND d.datum >= ? AND d.datum <= ? ORDER BY d.datum, d.rowid'
  ).all(req.user.tenant_id, von, bis);
  res.json(rows.map(function (r) {
    var o = rowToDienst(r); o.userName = r.user_name; o.userTelefon = r.user_telefon; return o;
  }));
});

// Jeder Mandant-Nutzer darf einen neuen Eintrag anlegen -- auch für eine andere Person (deckt den
// Auftrag "aktueller Dienst vermerkt, dass der NÄCHSTE Dienst krank ist" ab). Append-only: das
// überschreibt nichts, es fügt ein neues Ereignis an -- "gültiger Stand" ist der jüngste Eintrag
// pro (user,datum), die Historie bleibt für die Manipulationsprüfung vollständig erhalten.
app.post('/api/dienst', auth, function (req, res) {
  var b = req.body || {};
  if (!b.userId || !b.datum || !b.typ) return res.status(400).json({ error: 'userId, datum, typ erforderlich.' });
  var ziel = db.prepare('SELECT id FROM users WHERE id = ? AND tenant_id = ?').get(b.userId, req.user.tenant_id);
  if (!ziel) return res.status(404).json({ error: 'Zielnutzer nicht in diesem Mandanten gefunden.' });
  var last = db.prepare('SELECT hash FROM dienst_eintraege WHERE tenant_id = ? ORDER BY rowid DESC LIMIT 1').get(req.user.tenant_id);
  var prevHash = last ? last.hash : '';
  var e = {
    id: uuid(), tenant_id: req.user.tenant_id, user_id: b.userId, datum: b.datum, typ: b.typ,
    kuerzel: b.kuerzel || '', von: b.von || '', bis: b.bis || '', status: b.status || 'aktiv',
    notiz: b.notiz || '', created_by: req.user.id, created_at: nowIso()
  };
  e.hash = dienstContentHash(e, prevHash);
  e.prev_hash = prevHash;
  db.prepare(
    'INSERT INTO dienst_eintraege (id, tenant_id, user_id, datum, typ, kuerzel, von, bis, status, notiz, hash, prev_hash, created_by, created_at) ' +
    'VALUES (@id,@tenant_id,@user_id,@datum,@typ,@kuerzel,@von,@bis,@status,@notiz,@hash,@prev_hash,@created_by,@created_at)'
  ).run(e);
  res.json(rowToDienst(e));
});

app.get('/api/dienst/kette-pruefen', auth, function (req, res) {
  var rows = db.prepare('SELECT * FROM dienst_eintraege WHERE tenant_id = ? ORDER BY rowid').all(req.user.tenant_id);
  var prevHash = '', manipuliert = null;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.prev_hash !== prevHash || dienstContentHash(r, prevHash) !== r.hash) { manipuliert = r.id; break; }
    prevHash = r.hash;
  }
  res.json({ anzahl: rows.length, intakt: manipuliert === null, ersterManipulierterEintrag: manipuliert });
});

// ---------- Meldungen ("Eintrag melden", software-architect-Konzept 2026-10-24, René-bestaetigt) ----------
// Hybrid-Verschluesselung wie beim Tenant-Blob (s. db.js-Kommentar bei "meldungen"): der eigentliche
// Meldungsinhalt (gemeldeter Wert, Begruendungen) ist im payload_ct/payload_iv client-seitig mit der
// Tenant-DEK verschluesselt -- der Server fasst diese beiden Felder nie inhaltlich an, reicht sie nur durch.
// eskalationsStufe-Parameter optional (Performance: wird im GET-Listing einmal pro Zeile
// berechnet und hier nur durchgereicht, statt ihn für jede Antwort erneut zu berechnen).
function rowToMeldung(r, stufe) {
  return {
    id: r.id, pfad: r.pfad, iso: r.iso, status: r.status, gemeldetVon: r.gemeldet_von,
    entschiedenVon: r.entschieden_von || null, entschiedenAm: r.entschieden_am,
    verknuepfterEintragPfad: r.verknuepfter_eintrag_pfad, createdAt: r.created_at,
    payload: { iv: r.payload_iv, ct: r.payload_ct },
    eskalationsStufe: typeof stufe === 'number' ? stufe : meldungEskalationsStufe(r)
  };
}
var MELDUNG_STATUS = ['offen', 'angenommen', 'korrigiert', 'abgelehnt'];

// ---------- Eskalationsberechnung (Organisationsstruktur Phase 5, Auftrag 2026-10-24/25) ----------
// Stufe 1 (Team->Bezirksleitung): Ende der Schicht der meldenden PFK. Stufe 2 (Bezirksleitung->
// Geschaeftsfuehrung): 3 Tage nach Stufe-1-Zeitpunkt. Beide on-read berechnet (kein Cron), reine
// Funktion von bereits vorhandenen, stabilen Daten (letzter Dienstplan-Eintrag + Meldungsdatum).
//
// meldung.iso ist laut POST /api/meldungen optional (b.iso || '') -- fehlt es, gibt es keinen
// eindeutigen Schichttag zum Nachschlagen. Eigene, hier dokumentierte Entscheidung: in diesem Fall
// wird der Kalendertag von created_at als Ersatz-Schichttag verwendet (konservativ, nie blockierend --
// identisches Fallback-Prinzip wie "kein Dienstplan-Eintrag gefunden" unten).
function meldungEffektivesDatum(m) {
  if (m.iso) return m.iso;
  return m.created_at ? m.created_at.slice(0, 10) : null;
}
// Letzte dienst_eintraege-Zeile fuer (user_id, datum) -- append-only, "aktueller Stand" ist immer
// die juengste Zeile fuer diese Kombination (identisches Prinzip wie dienstContentHash-Kette).
function letzterDienstEintrag(tenantId, userId, datum) {
  return db.prepare(
    'SELECT * FROM dienst_eintraege WHERE tenant_id = ? AND user_id = ? AND datum = ? ORDER BY rowid DESC LIMIT 1'
  ).get(tenantId, userId, datum);
}
// Schichtende der meldenden PFK -- Dienstplan-Eintrag vorhanden: schichtZeitraumSrv() spiegelt
// app.js' schichtZeitraum() (Mitternacht-Ueberlauf: bis < von -> Ende liegt am Folgetag). Kein
// Dienstplan-Eintrag: Fallback = Ende des Kalendertags (23:59:59 Europe/Berlin), konservativ.
function meldungSchichtEnde(m) {
  var datum = meldungEffektivesDatum(m);
  if (!datum) return null;
  var eintrag = letzterDienstEintrag(m.tenant_id, m.gemeldet_von, datum);
  if (eintrag) {
    var z = schichtZeitraumSrv(datum, eintrag.von, eintrag.bis);
    if (z) return z.end;
  }
  return berlinWandzeitZuEpoch(datum, '23:59') + 59000; // + 59s fuer 23:59:59
}
var DREI_TAGE_MS = 3 * 24 * 60 * 60 * 1000;
function meldungEskalationsStufe(m) {
  var ende = meldungSchichtEnde(m);
  if (ende === null) return 0;
  var jetzt = Date.now();
  if (jetzt < ende) return 0;
  return jetzt >= (ende + DREI_TAGE_MS) ? 2 : 1;
}
// Team-/Bezirkszuordnung einer Meldung -- meldungen.klient_id wird bei KEINEM Insert gesetzt
// (bestaetigter Code-Fund, Organisationsstruktur-Phase-4-Luecke, s. POST /api/meldungen oben: die
// INSERT-Anweisung enthaelt die Spalte nicht) -- die robusteste verfuegbare Verknuepfung ist daher
// ueber die meldende Person selbst: gemeldet_von -> users.team_id -> teams.bezirk_id (identisches
// Scope-Prinzip wie GET /api/teams/klienten). Hat der/die Meldende (noch) kein Team zugeordnet
// (Alt-Daten/Testkonten ohne Organisationsstruktur-Migration), bleibt teamId/bezirkId null --
// kannMeldungSehen()/kannMeldungEntscheiden() behandeln das als bewussten Fallback (s. dort).
function meldungTeamUndBezirk(m) {
  var melder = db.prepare('SELECT team_id FROM users WHERE id = ?').get(m.gemeldet_von);
  var teamId = melder ? melder.team_id : null;
  var bezirkId = null;
  if (teamId) {
    var team = db.prepare('SELECT bezirk_id FROM teams WHERE id = ?').get(teamId);
    bezirkId = team ? team.bezirk_id : null;
  }
  return { teamId: teamId, bezirkId: bezirkId };
}
// Gemeinsame Sichtbarkeits-/Entscheidungslogik -- EINE Funktion fuer GET UND PATCH (Architektur-
// Vorgabe, verhindert dass beide Routen unabhaengig auseinanderlaufen). Sichtbarkeits-/
// Entscheidungsberechtigung erweitert sich mit der Eskalationsstufe: Stufe 0 = eigenes Team,
// Stufe >=1 ZUSAeTZLICH Bezirksleitung des zustaendigen Bezirks (Bezirksleitung behaelt diese
// Sicht auch bei Stufe 2 -- admin/hr sehen ueber den ersten Zweig unten ohnehin bereits alles,
// Stufe 2 fuegt dem keine weitere Einschraenkung hinzu).
//
// Team-/Bezirks-Fallback bei fehlender Teamzuordnung (teamId/bezirkId === null): JEDE/R
// teamleiter bzw. bezirksleitung sieht/entscheidet eine solche Meldung weiterhin (identisches
// Verhalten zum VORHERIGEN, ungescopten Code-Stand) -- sonst wuerden bereits bestehende, (noch)
// nicht Team-zugeordnete Meldungen/Testkonten fuer niemanden mehr entscheidbar.
function kannMeldungSehen(user, m, stufe) {
  if (hatEineRolle(user.id, ['admin', 'hr'])) return true;
  if (m.gemeldet_von === user.id) return true; // eigene Meldung immer sichtbar (ma sieht eigene)
  var z = meldungTeamUndBezirk(m);
  if (hatRolle(user.id, 'teamleiter') && (!z.teamId || user.team_id === z.teamId)) return true;
  if (stufe >= 1 && hatRolle(user.id, 'bezirksleitung')) {
    if (!z.bezirkId) return true;
    if (db.prepare('SELECT 1 FROM bezirke WHERE id = ? AND leiter_user_id = ?').get(z.bezirkId, user.id)) return true;
  }
  return false;
}
// Entscheiden ist bewusst KEINE Obermenge von "eigene Meldung sehen" -- 'ma' darf auch die eigene
// Meldung nie selbst entscheiden (bestehender Vertrag, s. Test "ma darf NICHT PATCH").
function kannMeldungEntscheiden(user, m, stufe) {
  if (hatRolle(user.id, 'admin')) return true;
  var z = meldungTeamUndBezirk(m);
  if (hatRolle(user.id, 'teamleiter') && (!z.teamId || user.team_id === z.teamId)) return true;
  if (stufe >= 1 && hatRolle(user.id, 'bezirksleitung')) {
    if (!z.bezirkId) return true;
    if (db.prepare('SELECT 1 FROM bezirke WHERE id = ? AND leiter_user_id = ?').get(z.bezirkId, user.id)) return true;
  }
  return false;
}

// gemeldet_von kommt bewusst AUSSCHLIESSLICH aus dem Token (req.user.id), nie vom Client-Body --
// sonst könnte eine ma-Person eine Meldung im Namen einer anderen Person anlegen und so den
// serverseitigen Rollenfilter in GET /api/meldungen unterlaufen.
app.post('/api/meldungen', auth, function (req, res) {
  var b = req.body || {};
  if (!b.pfad || !b.payload || !b.payload.iv || !b.payload.ct) {
    return res.status(400).json({ error: 'pfad, payload.iv, payload.ct erforderlich.' });
  }
  var m = {
    id: uuid(), tenant_id: req.user.tenant_id, pfad: b.pfad, iso: b.iso || '', status: 'offen',
    gemeldet_von: req.user.id, entschieden_von: null, entschieden_am: '',
    verknuepfter_eintrag_pfad: b.verknuepfterEintragPfad || '', created_at: nowIso(),
    payload_iv: b.payload.iv, payload_ct: b.payload.ct
  };
  db.prepare(
    'INSERT INTO meldungen (id, tenant_id, pfad, iso, status, gemeldet_von, entschieden_von, entschieden_am, verknuepfter_eintrag_pfad, created_at, payload_iv, payload_ct) ' +
    'VALUES (@id,@tenant_id,@pfad,@iso,@status,@gemeldet_von,@entschieden_von,@entschieden_am,@verknuepfter_eintrag_pfad,@created_at,@payload_iv,@payload_ct)'
  ).run(m);
  res.json(rowToMeldung(m));
});

// Rollenfilter SERVERSEITIG (K-neu Punkt 1, René-bestaetigt "ma sieht nur eigene Meldungen") --
// nicht im Client filtern, da ein direkter API-Aufruf das sonst umgehen könnte.
// Phase 2: Basis-Zugriffsgate NUR fuer admin/teamleiter/ma/bezirksleitung (hatEineRolle statt
// req.user.role) -- 'hr' faellt hier bewusst durch 403 (Architektur-Risikopunkt "HR darf nicht
// versehentlich mitentscheiden können", gilt unveraendert fuer Lesezugriff).
// Phase 5 (Eskalation, 2026-10-24/25): fein-granulare Sicht pro Zeile laeuft jetzt ueber die
// gemeinsame kannMeldungSehen()-Funktion (Team-Scope + Eskalationsstufen-abhaengige Bezirks-
// Sicht), nicht mehr pauschal "jede/r teamleiter sieht alle Meldungen des Mandanten".
app.get('/api/meldungen', auth, function (req, res) {
  if (!hatEineRolle(req.user.id, ['admin', 'teamleiter', 'ma', 'bezirksleitung'])) {
    return res.status(403).json({ error: 'Kein Zugriff auf Meldungen.' });
  }
  var alle = db.prepare('SELECT * FROM meldungen WHERE tenant_id = ? ORDER BY created_at DESC').all(req.user.tenant_id);
  var sichtbar = [];
  alle.forEach(function (m) {
    var stufe = meldungEskalationsStufe(m);
    if (kannMeldungSehen(req.user, m, stufe)) sichtbar.push(rowToMeldung(m, stufe));
  });
  res.json(sichtbar);
});

// Phase 5: requireTeamleiterOderAdmin-Middleware entfernt -- die Zugriffspruefung laeuft jetzt
// vollstaendig ueber kannMeldungEntscheiden() (Team-/Bezirks-Scope statt pauschal "jede/r
// teamleiter/admin"). 'ma'/'hr' bekommen weiterhin 403 (beide Rollen liefern dort nie true).
app.patch('/api/meldungen/:id', auth, function (req, res) {
  // Cross-Tenant-Schutz (identisches Muster wie /api/blob-fin): tenant_id des Datensatzes MUSS mit
  // req.user.tenant_id uebereinstimmen, sonst 404 statt 403 (kein Leak, ob die id ueberhaupt existiert).
  var m = db.prepare('SELECT * FROM meldungen WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenant_id);
  if (!m) return res.status(404).json({ error: 'Nicht gefunden.' });
  var stufe = meldungEskalationsStufe(m);
  if (!kannMeldungEntscheiden(req.user, m, stufe)) return res.status(403).json({ error: 'Kein Zugriff auf diese Meldung (anderes Team/Bezirk oder keine Entscheidungsrolle).' });
  var b = req.body || {};
  if (b.status && MELDUNG_STATUS.indexOf(b.status) === -1) return res.status(400).json({ error: 'Ungültiger Status.' });
  db.prepare(
    'UPDATE meldungen SET status = ?, entschieden_von = ?, entschieden_am = ?, verknuepfter_eintrag_pfad = ?, payload_iv = ?, payload_ct = ? WHERE id = ?'
  ).run(
    b.status && MELDUNG_STATUS.indexOf(b.status) !== -1 ? b.status : m.status,
    req.user.id,
    nowIso(),
    typeof b.verknuepfterEintragPfad === 'string' ? b.verknuepfterEintragPfad : m.verknuepfter_eintrag_pfad,
    typeof b.payload === 'object' && b.payload && b.payload.iv ? b.payload.iv : m.payload_iv,
    typeof b.payload === 'object' && b.payload && b.payload.ct ? b.payload.ct : m.payload_ct,
    m.id
  );
  res.json(rowToMeldung(db.prepare('SELECT * FROM meldungen WHERE id = ?').get(m.id)));
});

// ---------- Reports (Organisationsstruktur Phase 5, Auftrag 2026-10-24/25) ----------
// Nur serverseitig berechenbare Kennzahlen aus bereits vorhandenen Klartext-Tabellen (Meldungen-
// Metadaten, dienst_eintraege) -- KEIN Entschluesseln noetig. Pflegequalitaets-Kennzahlen bleiben
// bewusst client-seitig (NICHT Teil dieses Auftrags).
function requireTeamReportZugriff(req, res, next) {
  var team = db.prepare(
    'SELECT t.*, b.leiter_user_id AS bezirk_leiter FROM teams t JOIN bezirke b ON b.id = t.bezirk_id WHERE t.id = ? AND t.tenant_id = ?'
  ).get(req.params.teamId, req.user.tenant_id);
  if (!team) return res.status(404).json({ error: 'Team nicht gefunden.' });
  var erlaubt = hatEineRolle(req.user.id, ['admin', 'hr'])
    || (hatRolle(req.user.id, 'bezirksleitung') && team.bezirk_leiter === req.user.id)
    || (hatRolle(req.user.id, 'teamleiter') && req.user.team_id === team.id);
  if (!erlaubt) return res.status(403).json({ error: 'Kein Zugriff auf diesen Team-Report.' });
  req.aeTeam = team;
  next();
}
function requireBezirkReportZugriff(req, res, next) {
  var bezirk = db.prepare('SELECT * FROM bezirke WHERE id = ? AND tenant_id = ?').get(req.params.bezirkId, req.user.tenant_id);
  if (!bezirk) return res.status(404).json({ error: 'Bezirk nicht gefunden.' });
  var erlaubt = hatEineRolle(req.user.id, ['admin', 'hr']) || (hatRolle(req.user.id, 'bezirksleitung') && bezirk.leiter_user_id === req.user.id);
  if (!erlaubt) return res.status(403).json({ error: 'Kein Zugriff auf diesen Bezirk-Report.' });
  req.aeBezirk = bezirk;
  next();
}
function meldungenZahlenFuerUserIds(tenantId, userIds) {
  if (!userIds.length) return { offeneMeldungen: 0, eskalierteMeldungen: 0 };
  var platzhalter = userIds.map(function () { return '?'; }).join(',');
  var rows = db.prepare('SELECT * FROM meldungen WHERE tenant_id = ? AND gemeldet_von IN (' + platzhalter + ')')
    .all.apply(null, [tenantId].concat(userIds));
  var offen = 0, eskaliert = 0;
  rows.forEach(function (m) {
    if (m.status === 'offen') offen++;
    if (meldungEskalationsStufe(m) >= 1) eskaliert++;
  });
  return { offeneMeldungen: offen, eskalierteMeldungen: eskaliert };
}
function berlinJetztTeile() {
  var dtf = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' });
  var teile = dtf.formatToParts(new Date()).reduce(function (acc, p) { acc[p.type] = p.value; return acc; }, {});
  return { jahr: Number(teile.year), monat: Number(teile.month) }; // monat 1-12
}
// Days-in-month-Trick: new Date(jahr, monat, 0) mit 1-basiertem monat liefert den letzten Tag
// DIESES Monats (monat als 0-basierter monthIndex verschiebt effektiv um +1) -- reine Kalender-
// arithmetik mit Integer-Argumenten, unabhaengig von Server-Prozess-TZ (kein String-Parsing).
function tageImMonatSrv(jahr, monat) { return new Date(jahr, monat, 0).getDate(); }
function aktuelleDienstRowsFuerMonat(tenantId, userIds, von, bis) {
  if (!userIds.length) return [];
  var platzhalter = userIds.map(function () { return '?'; }).join(',');
  return db.prepare(
    'SELECT d.* FROM dienst_eintraege d WHERE d.tenant_id = ? AND d.user_id IN (' + platzhalter + ') AND d.datum >= ? AND d.datum <= ? ' +
    'AND d.rowid = (SELECT MAX(d2.rowid) FROM dienst_eintraege d2 WHERE d2.tenant_id = d.tenant_id AND d2.user_id = d.user_id AND d2.datum = d.datum)'
  ).all.apply(null, [tenantId].concat(userIds, [von, bis]));
}
var DIENSTPLAN_AKTIVE_TYPEN = ['frueh', 'spaet', 'nacht', 'bereitschaft'];
// Besetzungsgrad (eigene, hier dokumentierte Entscheidung -- AERIS kennt keine Soll-Dienstplan-
// Daten/Mindestbesetzung, daher kein echter Soll-Ist-Vergleich moeglich): Anteil der Kalendertage
// im aktuellen Monat, an denen fuer das Team/den Bezirk MINDESTENS EIN aktiver, nicht-krank
// Dienst-Eintrag (typ in frueh/spaet/nacht/bereitschaft) vorliegt -- eine Tagesabdeckungs-
// Annaeherung, kein Soll-Ist-Verhaeltnis. "Krankmeldung" ist laut app.js (grep bestaetigt, s.
// aeStempleKrank()) ein status='krank'-Wert auf einem bestehenden Eintrag, NICHT ein eigener
// typ-Wert -- AKTIVE_TYPEN/Krankzaehlung lesen daher status, nicht typ, fuer die Krank-Erkennung.
function dienstplanAuslastungBerechnen(tenantId, userIds) {
  var berlin = berlinJetztTeile();
  var tageGesamt = tageImMonatSrv(berlin.jahr, berlin.monat);
  var monatPrefix = berlin.jahr + '-' + pad2Srv(berlin.monat);
  var von = monatPrefix + '-01', bis = monatPrefix + '-' + pad2Srv(tageGesamt);
  var rows = aktuelleDienstRowsFuerMonat(tenantId, userIds, von, bis);
  var besetzteTage = {}, krankAnzahl = 0;
  rows.forEach(function (r) {
    if (r.status === 'krank') { krankAnzahl++; return; }
    if (DIENSTPLAN_AKTIVE_TYPEN.indexOf(r.typ) !== -1) besetzteTage[r.datum] = true;
  });
  var besetzteTageAnzahl = Object.keys(besetzteTage).length;
  return {
    monat: monatPrefix,
    besetzungsgrad: tageGesamt > 0 ? Math.round((besetzteTageAnzahl / tageGesamt) * 1000) / 1000 : 0,
    besetzteTage: besetzteTageAnzahl,
    tageGesamt: tageGesamt,
    ausfaelleKrankmeldungen: krankAnzahl,
    hinweis: 'Besetzungsgrad = Anteil der Kalendertage mit mindestens einer aktiven Schicht (frueh/spaet/nacht/bereitschaft) im Team/Bezirk -- AERIS kennt keine Soll-Dienstplan-Daten, dies ist eine Tagesabdeckungs-Annaeherung, kein Soll-Ist-Vergleich.'
  };
}
app.get('/api/reports/team/:teamId', auth, requireTeamReportZugriff, function (req, res) {
  var team = req.aeTeam;
  var userIds = db.prepare('SELECT id FROM users WHERE tenant_id = ? AND team_id = ?').all(req.user.tenant_id, team.id).map(function (r) { return r.id; });
  res.json(Object.assign(
    { teamId: team.id, teamName: team.name, bezirkId: team.bezirk_id },
    meldungenZahlenFuerUserIds(req.user.tenant_id, userIds),
    { dienstplanAuslastung: dienstplanAuslastungBerechnen(req.user.tenant_id, userIds) }
  ));
});
app.get('/api/reports/bezirk/:bezirkId', auth, requireBezirkReportZugriff, function (req, res) {
  var bezirk = req.aeBezirk;
  var teamIds = db.prepare('SELECT id FROM teams WHERE tenant_id = ? AND bezirk_id = ?').all(req.user.tenant_id, bezirk.id).map(function (r) { return r.id; });
  var userIds = [];
  if (teamIds.length) {
    var ph = teamIds.map(function () { return '?'; }).join(',');
    userIds = db.prepare('SELECT id FROM users WHERE tenant_id = ? AND team_id IN (' + ph + ')')
      .all.apply(null, [req.user.tenant_id].concat(teamIds)).map(function (r) { return r.id; });
  }
  res.json(Object.assign(
    { bezirkId: bezirk.id, bezirkName: bezirk.name },
    meldungenZahlenFuerUserIds(req.user.tenant_id, userIds),
    { dienstplanAuslastung: dienstplanAuslastungBerechnen(req.user.tenant_id, userIds) }
  ));
});

// ---------- BTM-Nachweisbuch: append-only, server-seitig hash-verkettet (echte Tamper-Resistenz,
// René-Entscheidung 2026-10-10 nach security-privacy-Fund Runde 2: die vorherige client-seitige
// Kette im mutable Blob bot keinen Schutz gegen die dokumentierende Person). Bestand wird
// SERVERSEITIG aus der Historie nachgerechnet, nicht vom Client uebernommen -- ein manipulierter
// Client kann keinen falschen bestandNachher einschleusen. Kein UPDATE/DELETE-Endpunkt.
function btmContentHash(e, prevHash) {
  // K7-Fix 2026-10-23: chargen_nr/verfallsdatum nur in den Hash-Inhalt aufnehmen, wenn die Spalte
  // nicht NULL ist (echte Alt-Zeilen vor dieser Migration) -- s. ausfuehrlicher Kommentar in db.js.
  var basis = {
    tenantId: e.tenant_id, praeparatId: e.praeparat_id, typ: e.typ, menge: e.menge, einheit: e.einheit,
    datum: e.datum, uhrzeit: e.uhrzeit, bestandVorher: e.bestand_vorher, bestandNachher: e.bestand_nachher,
    gegenpart: e.gegenpart, verordner: e.verordner, rezeptNr: e.rezept_nr, pflegekraft: e.pflegekraft,
    zeuge: e.zeuge, bemerkung: e.bemerkung, createdBy: e.created_by, createdAt: e.created_at
  };
  if (e.chargen_nr !== null && e.chargen_nr !== undefined) basis.chargenNr = e.chargen_nr;
  if (e.verfallsdatum !== null && e.verfallsdatum !== undefined) basis.verfallsdatum = e.verfallsdatum;
  // klient_id BEWUSST NICHT aufgenommen (Organisationsstruktur Phase 1, 2026-10-24) -- anders als
  // chargen_nr/verfallsdatum wird klient_id auf Alt-Zeilen per Migration RUECKWIRKEND befuellt, s.
  // ausfuehrlicher Kommentar bei dienstContentHash() oben.
  return sha256Hex(JSON.stringify(basis) + '|' + prevHash);
}
function rowToBtmPraeparat(r) { return { id: r.id, bezeichnung: r.bezeichnung, wirkstoff: r.wirkstoff, staerke: r.staerke, darreichungsform: r.darreichungsform, createdAt: r.created_at }; }
function rowToBtmEintrag(r) {
  return { id: r.id, praeparatId: r.praeparat_id, typ: r.typ, menge: r.menge, einheit: r.einheit, datum: r.datum, uhrzeit: r.uhrzeit,
    bestandVorher: r.bestand_vorher, bestandNachher: r.bestand_nachher, gegenpart: r.gegenpart, verordner: r.verordner,
    rezeptNr: r.rezept_nr, chargenNr: r.chargen_nr || '', verfallsdatum: r.verfallsdatum || '', pflegekraft: r.pflegekraft, zeuge: r.zeuge, bemerkung: r.bemerkung, hash: r.hash, createdAt: r.created_at };
}

app.get('/api/btm/praeparate', auth, function (req, res) {
  res.json(db.prepare('SELECT * FROM btm_praeparate WHERE tenant_id = ? ORDER BY bezeichnung').all(req.user.tenant_id).map(rowToBtmPraeparat));
});
app.post('/api/btm/praeparate', auth, function (req, res) {
  var b = req.body || {};
  if (!b.bezeichnung) return res.status(400).json({ error: 'bezeichnung erforderlich.' });
  var p = { id: uuid(), tenant_id: req.user.tenant_id, bezeichnung: b.bezeichnung, wirkstoff: b.wirkstoff || '', staerke: b.staerke || '', darreichungsform: b.darreichungsform || '', created_by: req.user.id, created_at: nowIso() };
  db.prepare('INSERT INTO btm_praeparate (id, tenant_id, bezeichnung, wirkstoff, staerke, darreichungsform, created_by, created_at) VALUES (@id,@tenant_id,@bezeichnung,@wirkstoff,@staerke,@darreichungsform,@created_by,@created_at)').run(p);
  res.json(rowToBtmPraeparat(p));
});

app.get('/api/btm/eintraege', auth, function (req, res) {
  res.json(db.prepare('SELECT * FROM btm_eintraege WHERE tenant_id = ? ORDER BY rowid').all(req.user.tenant_id).map(rowToBtmEintrag));
});
app.post('/api/btm/eintraege', auth, function (req, res) {
  var b = req.body || {};
  if (!b.praeparatId || !b.typ || !b.menge || !b.datum) return res.status(400).json({ error: 'praeparatId, typ, menge, datum erforderlich.' });
  var praeparat = db.prepare('SELECT id FROM btm_praeparate WHERE id = ? AND tenant_id = ?').get(b.praeparatId, req.user.tenant_id);
  if (!praeparat) return res.status(404).json({ error: 'Präparat nicht gefunden.' });
  var menge = parseFloat(b.menge);
  if (!(menge > 0)) return res.status(400).json({ error: 'Menge muss größer als 0 sein.' });
  var letzter = db.prepare('SELECT bestand_nachher, hash FROM btm_eintraege WHERE tenant_id = ? AND praeparat_id = ? ORDER BY rowid DESC LIMIT 1').get(req.user.tenant_id, b.praeparatId);
  var bestandVorher = letzter ? letzter.bestand_nachher : 0;
  var bestandNachher = b.typ === 'zugang' ? bestandVorher + menge : bestandVorher - menge;
  if (b.typ !== 'zugang' && bestandNachher < 0) {
    return res.status(400).json({ error: 'Abgang/Vernichtung übersteigt den aktuellen Bestand (' + bestandVorher.toFixed(2).replace('.', ',') + ').' });
  }
  var letzterGlobal = db.prepare('SELECT hash FROM btm_eintraege WHERE tenant_id = ? ORDER BY rowid DESC LIMIT 1').get(req.user.tenant_id);
  var prevHash = letzterGlobal ? letzterGlobal.hash : '';
  var e = {
    id: uuid(), tenant_id: req.user.tenant_id, praeparat_id: b.praeparatId, typ: b.typ, menge: menge, einheit: b.einheit || '',
    datum: b.datum, uhrzeit: b.uhrzeit || '', bestand_vorher: bestandVorher, bestand_nachher: bestandNachher,
    gegenpart: b.gegenpart || '', verordner: b.verordner || '', rezept_nr: b.rezeptNr || '',
    chargen_nr: b.chargenNr || '', verfallsdatum: b.verfallsdatum || '', pflegekraft: b.pflegekraft || '',
    zeuge: b.zeuge || '', bemerkung: b.bemerkung || '', created_by: req.user.id, created_at: nowIso()
  };
  e.hash = btmContentHash(e, prevHash);
  e.prev_hash = prevHash;
  db.prepare(
    'INSERT INTO btm_eintraege (id, tenant_id, praeparat_id, typ, menge, einheit, datum, uhrzeit, bestand_vorher, bestand_nachher, gegenpart, verordner, rezept_nr, chargen_nr, verfallsdatum, pflegekraft, zeuge, bemerkung, hash, prev_hash, created_by, created_at) ' +
    'VALUES (@id,@tenant_id,@praeparat_id,@typ,@menge,@einheit,@datum,@uhrzeit,@bestand_vorher,@bestand_nachher,@gegenpart,@verordner,@rezept_nr,@chargen_nr,@verfallsdatum,@pflegekraft,@zeuge,@bemerkung,@hash,@prev_hash,@created_by,@created_at)'
  ).run(e);
  res.json(rowToBtmEintrag(e));
});

app.get('/api/btm/kette-pruefen', auth, function (req, res) {
  var rows = db.prepare('SELECT * FROM btm_eintraege WHERE tenant_id = ? ORDER BY rowid').all(req.user.tenant_id);
  var prevHash = '', manipuliert = null;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.prev_hash !== prevHash || btmContentHash(r, prevHash) !== r.hash) { manipuliert = r.id; break; }
    prevHash = r.hash;
  }
  res.json({ anzahl: rows.length, intakt: manipuliert === null, ersterManipulierterEintrag: manipuliert });
});

app.get('/api/btm/monatspruefungen', auth, function (req, res) {
  var rows = db.prepare('SELECT * FROM btm_monatspruefungen WHERE tenant_id = ? ORDER BY monat DESC').all(req.user.tenant_id);
  res.json(rows.map(function (r) { return { id: r.id, praeparatId: r.praeparat_id, monat: r.monat, namenszeichen: r.namenszeichen, pruefdatum: r.pruefdatum, createdAt: r.created_at }; }));
});
app.post('/api/btm/monatspruefungen', auth, function (req, res) {
  var b = req.body || {};
  if (!b.praeparatId || !b.monat || !b.namenszeichen || !b.pruefdatum) return res.status(400).json({ error: 'praeparatId, monat, namenszeichen, pruefdatum erforderlich.' });
  var praeparat = db.prepare('SELECT id FROM btm_praeparate WHERE id = ? AND tenant_id = ?').get(b.praeparatId, req.user.tenant_id);
  if (!praeparat) return res.status(404).json({ error: 'Präparat nicht gefunden.' });
  var p = { id: uuid(), tenant_id: req.user.tenant_id, praeparat_id: b.praeparatId, monat: b.monat, namenszeichen: b.namenszeichen, pruefdatum: b.pruefdatum, created_by: req.user.id, created_at: nowIso() };
  db.prepare('INSERT INTO btm_monatspruefungen (id, tenant_id, praeparat_id, monat, namenszeichen, pruefdatum, created_by, created_at) VALUES (@id,@tenant_id,@praeparat_id,@monat,@namenszeichen,@pruefdatum,@created_by,@created_at)').run(p);
  res.json({ ok: true });
});

// ---------- Medizinproduktebuch: identisches Muster wie BTM-Nachweisbuch ----------
// klient_id BEWUSST NICHT im Hash-Inhalt (Organisationsstruktur Phase 1, 2026-10-24) -- s. ausfuehr-
// licher Kommentar bei dienstContentHash() oben (Backfill-Problem, kein chargen_nr-aehnlicher Fall).
function mpContentHash(e, prevHash) {
  return sha256Hex(JSON.stringify({
    tenantId: e.tenant_id, geraetId: e.geraet_id, typ: e.typ, datum: e.datum, person: e.person, detail: e.detail,
    naechsteFaelligkeit: e.naechste_faelligkeit, folgen: e.folgen, bemerkung: e.bemerkung, createdBy: e.created_by, createdAt: e.created_at
  }) + '|' + prevHash);
}
function rowToMpGeraet(r) {
  return { id: r.id, bezeichnung: r.bezeichnung, artTyp: r.art_typ, loscodeSeriennummer: r.loscode_seriennummer, anschaffungsjahr: r.anschaffungsjahr,
    herstellerName: r.hersteller_name, herstellerAnschrift: r.hersteller_anschrift, betrieblicheId: r.betriebliche_id, standort: r.standort, createdAt: r.created_at };
}
function rowToMpEintrag(r) {
  return { id: r.id, geraetId: r.geraet_id, typ: r.typ, datum: r.datum, person: r.person, detail: r.detail,
    naechsteFaelligkeit: r.naechste_faelligkeit, folgen: r.folgen, bemerkung: r.bemerkung, hash: r.hash, createdAt: r.created_at };
}

app.get('/api/mp/geraete', auth, function (req, res) {
  res.json(db.prepare('SELECT * FROM mp_geraete WHERE tenant_id = ? ORDER BY bezeichnung').all(req.user.tenant_id).map(rowToMpGeraet));
});
app.post('/api/mp/geraete', auth, function (req, res) {
  var b = req.body || {};
  if (!b.bezeichnung) return res.status(400).json({ error: 'bezeichnung erforderlich.' });
  var g = { id: uuid(), tenant_id: req.user.tenant_id, bezeichnung: b.bezeichnung, art_typ: b.artTyp || '', loscode_seriennummer: b.loscodeSeriennummer || '',
    anschaffungsjahr: b.anschaffungsjahr || '', hersteller_name: b.herstellerName || '', hersteller_anschrift: b.herstellerAnschrift || '',
    betriebliche_id: b.betrieblicheId || '', standort: b.standort || '', created_by: req.user.id, created_at: nowIso() };
  db.prepare('INSERT INTO mp_geraete (id, tenant_id, bezeichnung, art_typ, loscode_seriennummer, anschaffungsjahr, hersteller_name, hersteller_anschrift, betriebliche_id, standort, created_by, created_at) VALUES (@id,@tenant_id,@bezeichnung,@art_typ,@loscode_seriennummer,@anschaffungsjahr,@hersteller_name,@hersteller_anschrift,@betriebliche_id,@standort,@created_by,@created_at)').run(g);
  res.json(rowToMpGeraet(g));
});

app.get('/api/mp/eintraege', auth, function (req, res) {
  res.json(db.prepare('SELECT * FROM mp_eintraege WHERE tenant_id = ? ORDER BY rowid').all(req.user.tenant_id).map(rowToMpEintrag));
});
app.post('/api/mp/eintraege', auth, function (req, res) {
  var b = req.body || {};
  if (!b.geraetId || !b.typ || !b.datum) return res.status(400).json({ error: 'geraetId, typ, datum erforderlich.' });
  var geraet = db.prepare('SELECT id FROM mp_geraete WHERE id = ? AND tenant_id = ?').get(b.geraetId, req.user.tenant_id);
  if (!geraet) return res.status(404).json({ error: 'Gerät nicht gefunden.' });
  var letzterGlobal = db.prepare('SELECT hash FROM mp_eintraege WHERE tenant_id = ? ORDER BY rowid DESC LIMIT 1').get(req.user.tenant_id);
  var prevHash = letzterGlobal ? letzterGlobal.hash : '';
  var e = {
    id: uuid(), tenant_id: req.user.tenant_id, geraet_id: b.geraetId, typ: b.typ, datum: b.datum, person: b.person || '',
    detail: b.detail || '', naechste_faelligkeit: b.naechsteFaelligkeit || '', folgen: b.folgen || '', bemerkung: b.bemerkung || '',
    created_by: req.user.id, created_at: nowIso()
  };
  e.hash = mpContentHash(e, prevHash);
  e.prev_hash = prevHash;
  db.prepare(
    'INSERT INTO mp_eintraege (id, tenant_id, geraet_id, typ, datum, person, detail, naechste_faelligkeit, folgen, bemerkung, hash, prev_hash, created_by, created_at) ' +
    'VALUES (@id,@tenant_id,@geraet_id,@typ,@datum,@person,@detail,@naechste_faelligkeit,@folgen,@bemerkung,@hash,@prev_hash,@created_by,@created_at)'
  ).run(e);
  res.json(rowToMpEintrag(e));
});

app.get('/api/mp/kette-pruefen', auth, function (req, res) {
  var rows = db.prepare('SELECT * FROM mp_eintraege WHERE tenant_id = ? ORDER BY rowid').all(req.user.tenant_id);
  var prevHash = '', manipuliert = null;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.prev_hash !== prevHash || mpContentHash(r, prevHash) !== r.hash) { manipuliert = r.id; break; }
    prevHash = r.hash;
  }
  res.json({ anzahl: rows.length, intakt: manipuliert === null, ersterManipulierterEintrag: manipuliert });
});

// ---------- ICW-Wunddokumentation: identisches Muster wie BTM-Nachweisbuch ----------
function wundeContentHash(e, prevHash) {
  return sha256Hex(JSON.stringify({
    tenantId: e.tenant_id, wundeId: e.wunde_id, datum: e.datum, laenge: e.laenge, breite: e.breite, tiefe: e.tiefe,
    unterminierung: e.unterminierung, wundgrund: e.wundgrund, wundbelag: e.wundbelag, wundrand: e.wundrand, wundumgebung: e.wundumgebung,
    mazeration: e.mazeration, erythem: e.erythem, exsudatMenge: e.exsudat_menge, exsudatArt: e.exsudat_art, geruch: e.geruch,
    infektionszeichen: e.infektionszeichen, schmerzNrs: e.schmerz_nrs, fotoVermerk: e.foto_vermerk, verbandsmaterial: e.verbandsmaterial,
    pflegekraft: e.pflegekraft, bemerkung: e.bemerkung, createdBy: e.created_by, createdAt: e.created_at
  }) + '|' + prevHash);
}
function rowToWunde(r) { return { id: r.id, bezeichnung: r.bezeichnung, wundart: r.wundart, lokalisation: r.lokalisation, erstdokumentiert: r.erstdokumentiert, createdAt: r.created_at }; }
function rowToWundeEintrag(r) {
  return { id: r.id, wundeId: r.wunde_id, datum: r.datum, laenge: r.laenge, breite: r.breite, tiefe: r.tiefe, unterminierung: r.unterminierung,
    wundgrund: r.wundgrund, wundbelag: r.wundbelag, wundrand: r.wundrand, wundumgebung: r.wundumgebung, mazeration: !!r.mazeration, erythem: !!r.erythem,
    exsudatMenge: r.exsudat_menge, exsudatArt: r.exsudat_art, geruch: !!r.geruch, infektionszeichen: JSON.parse(r.infektionszeichen || '[]'),
    schmerzNrs: r.schmerz_nrs, fotoVermerk: !!r.foto_vermerk, verbandsmaterial: r.verbandsmaterial, pflegekraft: r.pflegekraft, bemerkung: r.bemerkung,
    hash: r.hash, createdAt: r.created_at };
}

app.get('/api/wunden', auth, function (req, res) {
  res.json(db.prepare('SELECT * FROM wunden WHERE tenant_id = ? ORDER BY erstdokumentiert').all(req.user.tenant_id).map(rowToWunde));
});
app.post('/api/wunden', auth, function (req, res) {
  var b = req.body || {};
  if (!b.bezeichnung) return res.status(400).json({ error: 'bezeichnung erforderlich.' });
  var w = { id: uuid(), tenant_id: req.user.tenant_id, bezeichnung: b.bezeichnung, wundart: b.wundart || '', lokalisation: b.lokalisation || '',
    erstdokumentiert: nowIso().slice(0, 10), created_by: req.user.id, created_at: nowIso() };
  db.prepare('INSERT INTO wunden (id, tenant_id, bezeichnung, wundart, lokalisation, erstdokumentiert, created_by, created_at) VALUES (@id,@tenant_id,@bezeichnung,@wundart,@lokalisation,@erstdokumentiert,@created_by,@created_at)').run(w);
  res.json(rowToWunde(w));
});

app.get('/api/wunden/eintraege', auth, function (req, res) {
  res.json(db.prepare('SELECT * FROM wunde_eintraege WHERE tenant_id = ? ORDER BY rowid').all(req.user.tenant_id).map(rowToWundeEintrag));
});
app.post('/api/wunden/eintraege', auth, function (req, res) {
  var b = req.body || {};
  if (!b.wundeId || !b.datum) return res.status(400).json({ error: 'wundeId, datum erforderlich.' });
  var wunde = db.prepare('SELECT id FROM wunden WHERE id = ? AND tenant_id = ?').get(b.wundeId, req.user.tenant_id);
  if (!wunde) return res.status(404).json({ error: 'Wunde nicht gefunden.' });
  var letzterGlobal = db.prepare('SELECT hash FROM wunde_eintraege WHERE tenant_id = ? ORDER BY rowid DESC LIMIT 1').get(req.user.tenant_id);
  var prevHash = letzterGlobal ? letzterGlobal.hash : '';
  var e = {
    id: uuid(), tenant_id: req.user.tenant_id, wunde_id: b.wundeId, datum: b.datum,
    laenge: parseFloat(b.laenge) || 0, breite: parseFloat(b.breite) || 0, tiefe: parseFloat(b.tiefe) || 0,
    unterminierung: b.unterminierung || '', wundgrund: b.wundgrund || '', wundbelag: b.wundbelag || '', wundrand: b.wundrand || '',
    wundumgebung: b.wundumgebung || '', mazeration: b.mazeration ? 1 : 0, erythem: b.erythem ? 1 : 0,
    exsudat_menge: b.exsudatMenge || '', exsudat_art: b.exsudatArt || '', geruch: b.geruch ? 1 : 0,
    infektionszeichen: JSON.stringify(Array.isArray(b.infektionszeichen) ? b.infektionszeichen : []),
    schmerz_nrs: b.schmerzNrs || '', foto_vermerk: b.fotoVermerk ? 1 : 0, verbandsmaterial: b.verbandsmaterial || '',
    pflegekraft: b.pflegekraft || '', bemerkung: b.bemerkung || '', created_by: req.user.id, created_at: nowIso()
  };
  e.hash = wundeContentHash(e, prevHash);
  e.prev_hash = prevHash;
  db.prepare(
    'INSERT INTO wunde_eintraege (id, tenant_id, wunde_id, datum, laenge, breite, tiefe, unterminierung, wundgrund, wundbelag, wundrand, wundumgebung, mazeration, erythem, exsudat_menge, exsudat_art, geruch, infektionszeichen, schmerz_nrs, foto_vermerk, verbandsmaterial, pflegekraft, bemerkung, hash, prev_hash, created_by, created_at) ' +
    'VALUES (@id,@tenant_id,@wunde_id,@datum,@laenge,@breite,@tiefe,@unterminierung,@wundgrund,@wundbelag,@wundrand,@wundumgebung,@mazeration,@erythem,@exsudat_menge,@exsudat_art,@geruch,@infektionszeichen,@schmerz_nrs,@foto_vermerk,@verbandsmaterial,@pflegekraft,@bemerkung,@hash,@prev_hash,@created_by,@created_at)'
  ).run(e);
  res.json(rowToWundeEintrag(e));
});

app.get('/api/wunden/kette-pruefen', auth, function (req, res) {
  var rows = db.prepare('SELECT * FROM wunde_eintraege WHERE tenant_id = ? ORDER BY rowid').all(req.user.tenant_id);
  var prevHash = '', manipuliert = null;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.prev_hash !== prevHash || wundeContentHash(r, prevHash) !== r.hash) { manipuliert = r.id; break; }
    prevHash = r.hash;
  }
  res.json({ anzahl: rows.length, intakt: manipuliert === null, ersterManipulierterEintrag: manipuliert });
});

// ---------- MD-Archiv: nur Hash-Anker, NIE Klardaten (s. db.js-Kommentar bei md_archiv_checkpoints).
// (tenant,datum) ist genau EINMAL beschreibbar -- ein zweiter POST fuer denselben Tag mit
// ABWEICHENDEM Hash wird abgelehnt, das deckt eine nachtraegliche lokale Umschreibung auf.
app.get('/api/md-archiv/checkpoints', auth, function (req, res) {
  var rows = db.prepare('SELECT datum, ketten_hash, created_at FROM md_archiv_checkpoints WHERE tenant_id = ? ORDER BY datum').all(req.user.tenant_id);
  res.json(rows.map(function (r) { return { datum: r.datum, kettenHash: r.ketten_hash, createdAt: r.created_at }; }));
});
app.post('/api/md-archiv/checkpoints', auth, function (req, res) {
  var b = req.body || {};
  if (!b.datum || !b.kettenHash) return res.status(400).json({ error: 'datum, kettenHash erforderlich.' });
  var bestehend = db.prepare('SELECT ketten_hash FROM md_archiv_checkpoints WHERE tenant_id = ? AND datum = ?').get(req.user.tenant_id, b.datum);
  if (bestehend) {
    if (bestehend.ketten_hash !== b.kettenHash) {
      return res.status(409).json({ error: 'Abweichender Hash für bereits verankerten Tag — mögliche Manipulation.', manipulationVerdacht: true });
    }
    return res.json({ ok: true, bereitsVorhanden: true });
  }
  db.prepare('INSERT INTO md_archiv_checkpoints (tenant_id, datum, ketten_hash, created_by, created_at) VALUES (?,?,?,?,?)')
    .run(req.user.tenant_id, b.datum, b.kettenHash, req.user.id, nowIso());
  res.json({ ok: true, bereitsVorhanden: false });
});

// ---------- Cross-Device-Signatur (s. db.js-Kommentar bei signatur_anfragen für das Zero-Knowledge-
// Prinzip: der Server sieht hier NIE Klartext/den echten Schlüssel K, nur Ciphertext + einen
// Lookup-Hash). Ablauf: Gerät A erzeugt K, verschlüsselt Kontext + wrappt K mit einem Kurzcode-
// Schlüssel -- genau dieses Ergebnis landet hier. Gerät B (Signierende/r) bekommt K entweder per
// URL-Fragment (QR, nie serverseitig sichtbar) oder leitet es selbst aus dem Kurzcode ab.
// BEWUSST OHNE auth (René-Korrektur 2026-10-11 "nicht nur im Team-Modus"): diese Funktion braucht
// konzeptionell keinen Mandanten-Login -- der Inhalt ist bereits Ende-zu-Ende verschlüsselt, die
// Autorisierung entsteht allein durch Besitz der unratbaren id bzw. des Kurzcodes (identisches
// Prinzip wie bei den beiden Endpunkten darunter, die schon vorher ohne auth liefen). ----------
var SIGNATUR_CODE_MAX = 5;
// Kuerzere id als die sonst ueblichen uuid() (36 Zeichen inkl. Bindestriche) -- René-Fund 2026-10-11:
// die QR-URL (Host + Pfad + id + K im Fragment) wurde bei realem Kamera-Scan vom Laptop-Bildschirm
// nicht mehr zuverlaessig erkannt (zu dicht gerenderter QR). 16 Zufallsbytes/base64url = 22 Zeichen,
// 128 Bit Entropie -- fuer ein 30-Minuten-Einmal-Token immer noch weit mehr als praktisch angreifbar.
function kurzeId() { return crypto.randomBytes(16).toString('base64url'); }
app.post('/api/signatur/anfragen', function (req, res) {
  var b = req.body || {};
  if (!b.kontextCt || !b.kontextIv || !b.wrappedKSalt || !b.wrappedKIv || !b.wrappedKCt || !b.kurzcodeHash) {
    return res.status(400).json({ error: 'kontextCt, kontextIv, wrappedKSalt/Iv/Ct, kurzcodeHash erforderlich.' });
  }
  var id = kurzeId(), ts = nowIso(), ablauf = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO signatur_anfragen (id, kurzcode_hash, kontext_ct, kontext_iv, wrapped_k_salt, wrapped_k_iv, wrapped_k_ct, status, created_at, ablauf_at) ' +
    'VALUES (?,?,?,?,?,?,?,\'offen\',?,?)'
  ).run(id, b.kurzcodeHash, b.kontextCt, b.kontextIv, b.wrappedKSalt, b.wrappedKIv, b.wrappedKCt, ts, ablauf);
  res.json({ id: id, ablaufAt: ablauf });
});

// Gerät B, QR-Pfad: id ist eine unratbare UUID (kein Rate-Limiting nötig, anders als der Kurzcode-Pfad).
app.get('/api/signatur/kontext', function (req, res) {
  var row;
  if (req.query.id) {
    row = db.prepare('SELECT * FROM signatur_anfragen WHERE id = ?').get(req.query.id);
  } else if (req.query.code) {
    var ip = req.ip;
    var bis = gesperrtBis('signatur-code', ip);
    if (bis) return res.status(429).json({ error: 'Zu viele Versuche — bitte in ' + sperrMinuten(bis) + ' Minute(n) erneut versuchen.' });
    row = db.prepare('SELECT * FROM signatur_anfragen WHERE kurzcode_hash = ?').get(sha256Hex(String(req.query.code)));
    if (!row) { vermerkeFehlversuch('signatur-code', ip, SIGNATUR_CODE_MAX); return res.status(404).json({ error: 'Code ungültig oder abgelaufen.' }); }
    entsperre('signatur-code', ip);
  } else {
    return res.status(400).json({ error: 'id oder code erforderlich.' });
  }
  if (!row) return res.status(404).json({ error: 'Signatur-Anfrage nicht gefunden.' });
  if (row.status !== 'offen') return res.status(410).json({ error: 'Diese Signatur-Anfrage ist bereits erledigt oder ungültig.' });
  if (new Date(row.ablauf_at).getTime() <= Date.now()) return res.status(410).json({ error: 'Diese Signatur-Anfrage ist abgelaufen.' });
  res.json({
    id: row.id, kontextCt: row.kontext_ct, kontextIv: row.kontext_iv,
    wrappedK: { salt: row.wrapped_k_salt, iv: row.wrapped_k_iv, ct: row.wrapped_k_ct }
  });
});

app.post('/api/signatur/einreichen', function (req, res) {
  var b = req.body || {};
  if (!b.id || !b.signaturCt || !b.signaturIv) return res.status(400).json({ error: 'id, signaturCt, signaturIv erforderlich.' });
  var row = db.prepare('SELECT * FROM signatur_anfragen WHERE id = ?').get(b.id);
  if (!row) return res.status(404).json({ error: 'Signatur-Anfrage nicht gefunden.' });
  if (row.status !== 'offen') return res.status(409).json({ error: 'Diese Signatur-Anfrage wurde bereits eingereicht oder ist ungültig.' });
  if (new Date(row.ablauf_at).getTime() <= Date.now()) return res.status(410).json({ error: 'Diese Signatur-Anfrage ist abgelaufen.' });
  db.prepare('UPDATE signatur_anfragen SET status = \'signiert\', signatur_ct = ?, signatur_iv = ?, eingeloest_at = ? WHERE id = ?')
    .run(b.signaturCt, b.signaturIv, nowIso(), b.id);
  res.json({ ok: true });
});

// Gerät A pollt hierauf, um die fertige (verschlüsselte) Signatur abzuholen -- ohne auth (s. Kommentar
// oben bei /signatur/anfragen), hält K bereits im Speicher (hat es beim Anlegen selbst erzeugt),
// entschlüsselt also rein client-seitig. Autorisierung = Besitz der unratbaren id.
app.get('/api/signatur/status', function (req, res) {
  var row = db.prepare('SELECT * FROM signatur_anfragen WHERE id = ?').get(req.query.id);
  if (!row) return res.status(404).json({ error: 'Signatur-Anfrage nicht gefunden.' });
  if (new Date(row.ablauf_at).getTime() <= Date.now() && row.status === 'offen') return res.json({ status: 'abgelaufen' });
  var out = { status: row.status };
  if (row.status === 'signiert') { out.signaturCt = row.signatur_ct; out.signaturIv = row.signatur_iv; }
  res.json(out);
});

app.use(function (err, req, res, next) {
  console.error('Unbehandelter Fehler:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Interner Serverfehler.' });
});

var PORT = process.env.PORT || 8787;
var server = app.listen(PORT, '127.0.0.1', function () { console.log('AERIS-Server läuft auf 127.0.0.1:' + PORT); });

function graceful(signal) {
  console.log('AERIS-Server: ' + signal + ' empfangen, fahre geordnet herunter ...');
  server.close(function () {
    db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', function () { graceful('SIGTERM'); });
process.on('SIGINT', function () { graceful('SIGINT'); });
