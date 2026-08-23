#!/usr/bin/env bash
# Copia de seguridad de la base de datos de producción.
# Uso: ./scripts/backup-db.sh
# Pensado para un cron diario en el VPS (ver docs/09-despliegue.md).
set -euo pipefail
cd "$(dirname "$0")/.."

DEST=${BACKUP_DIR:-./backups}
mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$DEST/veline-$STAMP.sql.gz"

docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "${POSTGRES_USER:-veline}" "${POSTGRES_DB:-veline}" | gzip > "$FILE"

echo "Copia guardada en $FILE"

# Conserva solo los últimos 14 días para no llenar el disco.
find "$DEST" -name 'veline-*.sql.gz' -mtime +14 -delete
