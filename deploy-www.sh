#!/bin/bash
# AERIS Doku + AERIS Buch: Haupt-App-Deploy (devops-infra-Fund 2026-10-10: bisher nur als
# Chat-/Sitzungswissen existierender rsync-Befehl, nirgends im Repo dokumentiert -- identisches
# Muster wie der frueher behobene server/deploy.sh-Fund). Spielt index.html/app.js/aeris-*.js/
# buchhaltung/ usw. auf den vServer, OHNE server/-Backend-Dateien/Secrets/Build-Artefakte.
set -euo pipefail

SSH_KEY="$HOME/.ssh/aeris_server_ed25519"
REMOTE_HOST="root@212.132.117.130"
REMOTE_DIR="/var/www/aeris"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Deploy ${LOCAL_DIR} -> ${REMOTE_HOST}:${REMOTE_DIR}"
/usr/bin/rsync -a \
  --exclude .git --exclude node_modules --exclude ios --exclude android \
  --exclude desktop --exclude server --exclude package.json --exclude package-lock.json \
  --exclude capacitor.config.json --exclude CLAUDE.md --exclude handoff.md \
  --exclude .DS_Store --exclude www --exclude deploy-www.sh \
  -e "ssh -i ${SSH_KEY}" "${LOCAL_DIR}/" "${REMOTE_HOST}:${REMOTE_DIR}/"

ssh -i "${SSH_KEY}" "${REMOTE_HOST}" "chown -R www-data:www-data ${REMOTE_DIR}"

echo "Deploy abgeschlossen."
