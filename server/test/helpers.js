// Test-Infrastruktur: startet eine ECHTE server.js-Instanz als Kindprozess gegen eine Wegwerf-SQLite-
// Datei (AERIS_DB_PATH) auf einem freien Port -- Blackbox-Test gegen exakt das, was auch produktiv
// läuft, kein Mock/kein In-Process-Require. Korrektur-Potenzial-Fund 2026-10-09: "keine automatisierten
// Tests, die die Tenant-Isolation dauerhaft absichern" -- dieser Helfer ist die Grundlage dafür.
var { spawn } = require('node:child_process');
var path = require('node:path');
var fs = require('node:fs');
var os = require('node:os');
var crypto = require('node:crypto');

function freierPort() {
  return new Promise(function (resolve, reject) {
    var net = require('node:net');
    var srv = net.createServer();
    srv.listen(0, '127.0.0.1', function () {
      var port = srv.address().port;
      srv.close(function () { resolve(port); });
    });
    srv.on('error', reject);
  });
}

async function starteMitPfaden(port, dbPath, secretPath) {
  var proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: Object.assign({}, process.env, { PORT: String(port), AERIS_DB_PATH: dbPath, AERIS_JWT_SECRET_PATH: secretPath, NODE_ENV: 'test' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  var basis = 'http://127.0.0.1:' + port;
  // Auf Bereitschaft pollen statt fester Wartezeit -- fester Sleep waere auf langsamen CI-Runnern fragil.
  var bereit = false;
  for (var i = 0; i < 100 && !bereit; i++) {
    try { await fetch(basis + '/api/me'); bereit = true; } catch (e) { await new Promise(function (r) { setTimeout(r, 100); }); }
  }
  if (!bereit) throw new Error('Server ist nach 10s nicht bereit geworden.');
  return { basis: basis, proc: proc, stoppen: function () { return new Promise(function (resolve) { proc.once('exit', resolve); proc.kill('SIGTERM'); }); } };
}

async function starteServer() {
  var port = await freierPort();
  var kennung = crypto.randomBytes(8).toString('hex');
  var dbPath = path.join(os.tmpdir(), 'aeris-test-' + kennung + '.db');
  var secretPath = path.join(os.tmpdir(), 'aeris-test-' + kennung + '.jwt-secret.txt');
  var instanz = await starteMitPfaden(port, dbPath, secretPath);
  return {
    basis: instanz.basis,
    dbPath: dbPath,
    proc: instanz.proc,
    stoppen: instanz.stoppen,
    // Stoppt den aktuellen Prozess und startet einen NEUEN mit identischem DB-/Secret-Pfad+Port --
    // für den Test "übersteht Rate-Limit-Sperre einen Server-Neustart" (genau der Korrektur-
    // Potenzial-Fund, den die SQLite-Umstellung beheben sollte).
    neuStarten: async function () {
      await this.stoppen();
      var neu = await starteMitPfaden(port, dbPath, secretPath);
      this.proc = neu.proc; this.stoppen = neu.stoppen;
      return neu;
    },
    aufraeumen: function () {
      ['', '-wal', '-shm'].forEach(function (suffix) {
        try { fs.unlinkSync(dbPath + suffix); } catch (e) {}
      });
      try { fs.unlinkSync(secretPath); } catch (e) {}
    }
  };
}

function api(basis, pfad, opts) {
  opts = opts || {};
  opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  return fetch(basis + '/api' + pfad, opts).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (body) { return { status: r.status, body: body }; });
  });
}

module.exports = { starteServer: starteServer, api: api };
