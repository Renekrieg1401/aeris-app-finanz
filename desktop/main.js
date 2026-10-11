const { app, BrowserWindow, session } = require('electron');
const path = require('path');

// AERIS Dokumentation — Desktop-Huelle (Electron). Laedt dieselben Dateien wie die
// iOS/Android-App (../www), kein eigener Code-Pfad -- ein Quellcode fuer alle Plattformen.
// René-Korrektur 2026-10-11 "Server-Verbindung herstellen": der AERIS-Server laeuft bewusst mit
// selbstsigniertem Zertifikat (Root-CLAUDE.md "Offene Entscheidungen" Punkt 6, SEALED -- keine
// oeffentliche Domain, bewusst akzeptierte Konsequenz). Electron vertraut einem solchen Zertifikat
// standardmaessig NICHT (anders als ein Browser mit "Risiko akzeptieren"-Klick) -- jeder fetch()
// zur absoluten AE_API_BASE-Adresse (app.js) schlaegt sonst mit einem nichtssagenden "Failed to
// fetch" fehl. Die Ausnahme ist bewusst eng auf genau diesen einen, bekannten internen Host begrenzt
// (kein pauschales "alle Zertifikate akzeptieren").
var VERTRAUTER_HOST = '212.132.117.130';
app.on('certificate-error', function (event, webContents, url, error, certificate, callback) {
  var istVertrauterHost = false;
  try { istVertrauterHost = new URL(url).hostname === VERTRAUTER_HOST; } catch (e) { istVertrauterHost = false; }
  if (istVertrauterHost) { event.preventDefault(); callback(true); return; }
  callback(false);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 820,
    minHeight: 600,
    title: 'AERIS Dokumentation',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'www', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
