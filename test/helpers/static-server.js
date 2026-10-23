// Minimaler statischer Datei-Server fuer die Frontend-Testsuite (test/frontend.test.js) --
// liefert den gesamten AERIS-Silo-Root (inkl. buchhaltung/) unter EINER Origin aus, analog
// `python3 -m http.server` im bisherigen manuellen Verify-Workflow (s. testing-qa-Memory
// "AERIS (Web-PWA) -- Cross-App-Abhaengigkeit AERIS Doku <-> AERIS Buch: ... erfordert
// zwingend selbe Origin"). Dynamischer Port (listen(0)), damit paralleles `node --test`
// nie an einem belegten Port scheitert.
var http = require('http');
var fs = require('fs');
var path = require('path');

var MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon'
};

function starteStaticServer(root) {
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      var full = path.normalize(path.join(root, urlPath));
      if (full.indexOf(path.normalize(root)) !== 0) { res.writeHead(403); res.end(); return; }
      fs.readFile(full, function (err, data) {
        if (err) { res.writeHead(404); res.end('not found: ' + urlPath); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', function () {
      var port = server.address().port;
      resolve({
        basis: 'http://127.0.0.1:' + port,
        stoppen: function () { return new Promise(function (r) { server.close(r); }); }
      });
    });
  });
}

module.exports = { starteStaticServer: starteStaticServer };
