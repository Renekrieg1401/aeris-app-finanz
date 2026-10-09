const { app, BrowserWindow, session } = require('electron');
const path = require('path');

// AERIS Dokumentation — Desktop-Huelle (Electron). Laedt dieselben Dateien wie die
// iOS/Android-App (../www), kein eigener Code-Pfad -- ein Quellcode fuer alle Plattformen.
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
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
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
