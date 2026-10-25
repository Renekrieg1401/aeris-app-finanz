// Test-only Shim (NICHT Teil der Produktionslogik): ersetzt better-sqlite3 durch das in Node
// eingebaute node:sqlite (DatabaseSync), weil better-sqlite3 auf diesem lokalen Mac mit
// Node v26.4.0 nicht mehr nativ kompiliert (NODE_MODULE_VERSION-Mismatch 127 vs. 147 --
// bekanntes, bereits mehrfach dokumentiertes Problem, s. backend-server-Rollen-Gedaechtnis
// 2026-10-24). Identische API-Oberflaeche (Konstruktor, pragma/exec/prepare().get|all|run/
// transaction/close) -- die ECHTE, committete Produktionslogik (db.js/server.js) laeuft dadurch
// unveraendert, es wird NICHTS an der Fachlogik gemockt, nur die SQLite-Bindung selbst getauscht.
// Aktivierung: NODE_OPTIONS="--require <dieser Pfad>" vor einem beliebigen node-Aufruf (z. B.
// `npm test`, `node server.js`) -- vererbt sich automatisch an per spawn() gestartete
// Kindprozesse (test/helpers.js), da NODE_OPTIONS Teil von process.env ist.
var Module = require('node:module');
var { DatabaseSync } = require('node:sqlite');

function ShimDatabase(pfad) {
  this._db = new DatabaseSync(pfad);
}
ShimDatabase.prototype.pragma = function (anweisung) {
  return this._db.exec('PRAGMA ' + anweisung);
};
ShimDatabase.prototype.exec = function (sql) {
  return this._db.exec(sql);
};
ShimDatabase.prototype.prepare = function (sql) {
  var stmt = this._db.prepare(sql);
  return {
    get: function () { return stmt.get.apply(stmt, arguments); },
    all: function () { return stmt.all.apply(stmt, arguments); },
    run: function () { return stmt.run.apply(stmt, arguments); }
  };
};
ShimDatabase.prototype.transaction = function (fn) {
  var self = this;
  return function () {
    self._db.exec('BEGIN');
    try {
      var ergebnis = fn.apply(null, arguments);
      self._db.exec('COMMIT');
      return ergebnis;
    } catch (fehler) {
      try { self._db.exec('ROLLBACK'); } catch (e2) { /* Rollback-Fehler nicht verschlucken-wichtig, aber Original-Fehler hat Vorrang */ }
      throw fehler;
    }
  };
};
ShimDatabase.prototype.close = function () {
  return this._db.close();
};

var urspruenglichesLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'better-sqlite3') return ShimDatabase;
  return urspruenglichesLoad.apply(this, arguments);
};
