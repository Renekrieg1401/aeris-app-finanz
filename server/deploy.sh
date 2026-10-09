#!/bin/bash
# AERIS-Server-Deploy (devops-infra-Fund 2026-10-09: bisher nur als Chat-Wissen
# existierender rsync-Befehl, nirgends im Repo dokumentiert -- jetzt als Skript fixiert).
# Spielt server/ auf den vServer, OHNE die laufende DB/das JWT-Secret zu überschreiben.
set -euo pipefail

SSH_KEY="$HOME/.ssh/aeris_server_ed25519"
REMOTE_HOST="root@212.132.117.130"
REMOTE_DIR="/opt/aeris-server"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Deploy server/ -> ${REMOTE_HOST}:${REMOTE_DIR}"
/usr/bin/rsync -a --exclude node_modules --exclude "aeris.db*" --exclude jwt-secret.txt \
  -e "ssh -i ${SSH_KEY}" "${LOCAL_DIR}/" "${REMOTE_HOST}:${REMOTE_DIR}/"

# Die echte systemd-Unit liegt unter /etc/systemd/system/, NICHT im rsync-Zielordner
# (devops-infra-Fund 2026-10-09: wurde beim bisherigen Ad-hoc-Deploy übersehen).
scp -i "${SSH_KEY}" "${LOCAL_DIR}/aeris-server.service" "${REMOTE_HOST}:/etc/systemd/system/aeris-server.service"

ssh -i "${SSH_KEY}" "${REMOTE_HOST}" "chown -R www-data:www-data ${REMOTE_DIR} && systemctl daemon-reload && systemctl restart aeris-server && sleep 1 && systemctl is-active aeris-server"

echo "Deploy abgeschlossen."
