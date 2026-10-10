#!/bin/bash
# AERIS-Server: taegliches DB-Backup (devops-infra-Fund 2026-10-10: Produktiv-DB
# hatte KEINERLEI Backup -- Festplattendefekt oder Fehlbedienung = irreversibler
# Totalverlust aller Tenant-/Dienstplan-/Audit-Daten). Nutzt SQLites eingebaute
# Online-Backup-API (".backup"), konsistent auch bei laufenden Schreibzugriffen
# im WAL-Modus -- kein Stop des Services noetig.
set -euo pipefail

DB_PATH="/opt/aeris-server/aeris.db"
BACKUP_DIR="/opt/aeris-backups"
AUFBEWAHRUNG_TAGE=30

mkdir -p "${BACKUP_DIR}"
ZEITSTEMPEL="$(date +%Y-%m-%d-%H%M%S)"
ZIEL="${BACKUP_DIR}/aeris-${ZEITSTEMPEL}.db"

sqlite3 "${DB_PATH}" ".backup '${ZIEL}'"
gzip "${ZIEL}"

# Alte Backups jenseits der Aufbewahrungsfrist entfernen, damit das Verzeichnis
# nicht unbegrenzt waechst.
find "${BACKUP_DIR}" -name 'aeris-*.db.gz' -mtime +${AUFBEWAHRUNG_TAGE} -delete

echo "Backup abgeschlossen: ${ZIEL}.gz"
