#!/bin/bash
# AERIS-Server: Offsite-Kopie der taeglichen DB-Backups auf Renés Mac.
# devops-infra-Fund 2026-10-23 (K3, business-consultant-Architekturbericht):
# backup.sh legt Backups bisher NUR auf derselben vServer-Platte ab
# (/opt/aeris-backups) -- ein Plattendefekt/Fehlbedienung dort vernichtet
# Produktivdaten UND Backup gleichzeitig. Dieses Skript zieht (pull, nicht
# push) die Backups per rsync ueber den bereits bestehenden SSH-Key auf
# diesen Mac -- bewusst Pull statt Push, da der vServer eine statische IP
# hat und der Mac nicht zuverlässig von aussen erreichbar ist (NAT/dynamische
# IP). Laeuft ueber den LaunchAgent com.irisdigital.aeris-backup-pull
# (RunAtLoad + taeglich), idempotent -- rsync kopiert nur neue Dateien.
set -euo pipefail

SSH_KEY="$HOME/.ssh/aeris_server_ed25519"
REMOTE="root@212.132.117.130"
REMOTE_DIR="/opt/aeris-backups/"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backups-offsite/"

mkdir -p "${LOCAL_DIR}"

/usr/bin/rsync -az -e "ssh -i ${SSH_KEY} -o ConnectTimeout=10 -o BatchMode=yes" \
  "${REMOTE}:${REMOTE_DIR}" "${LOCAL_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Offsite-Pull abgeschlossen: $(ls -1 "${LOCAL_DIR}" | wc -l | tr -d ' ') Dateien lokal."
