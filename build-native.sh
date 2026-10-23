#!/bin/bash
# AERIS Doku: Native-Build-Vorstufe (devops-infra-Fund 2026-10-23 -- bisher gab es
# KEINEN Sync-Mechanismus zwischen dem echten Source-Stand (index.html/app.js/...)
# und den vier nativen Wrapper-Kopien (www/, desktop/www/, ios/.../public/,
# android/.../assets/public/) -- bis zu 14 Tage Drift gemessen, uneinheitlich
# zwischen den Kopien. Dieses Skript MUSS vor jedem nativen Build laufen.
#
# Schritt 1: Cache-Wipe (Analog zum Expo-CACHE_WIPE_PROTOCOL, hier fuer Gradle/Electron)
# Schritt 2: Source -> www/ synchronisieren (identische Exclude-Liste wie deploy-www.sh)
# Schritt 3: www/ -> desktop/www/ synchronisieren (Electron laedt aus eigener Kopie)
# Schritt 4: npx cap copy (Capacitor: www/ -> ios/App/App/public + android/.../assets/public)
set -euo pipefail

LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$LOCAL_DIR"

echo "[1/4] Cache-Wipe (Gradle/Electron-Build-Verzeichnisse)..."
rm -rf android/.gradle android/build android/app/build desktop/release

echo "[2/4] Source -> www/ synchronisieren..."
/usr/bin/rsync -a --delete \
  --exclude .git --exclude node_modules --exclude ios --exclude android \
  --exclude desktop --exclude server --exclude package.json --exclude package-lock.json \
  --exclude capacitor.config.json --exclude CLAUDE.md --exclude handoff.md \
  --exclude .DS_Store --exclude www --exclude deploy-www.sh --exclude build-native.sh \
  "${LOCAL_DIR}/" "${LOCAL_DIR}/www/"

echo "[3/4] www/ -> desktop/www/ synchronisieren..."
/usr/bin/rsync -a --delete "${LOCAL_DIR}/www/" "${LOCAL_DIR}/desktop/www/"

echo "[4/4] npx cap copy (www/ -> ios/android native assets)..."
npx cap copy

echo "Fertig. www/, desktop/www/, ios/App/App/public/, android/.../assets/public/ sind jetzt synchron zum aktuellen Source-Stand."
