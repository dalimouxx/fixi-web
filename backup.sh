#!/bin/sh
set -eu
mkdir -p backups
TS=$(date +%Y%m%d_%H%M%S)
DB_FILE="backups/fixi_$TS.sql.gz"
FILES_FILE="backups/fixi_uploads_$TS.tar.gz"

docker compose exec -T db pg_dump --clean --if-exists --no-owner -U fixi -d fixi | gzip > "$DB_FILE"
docker compose exec -T web sh -c 'tar -czf - -C /app/data uploads 2>/dev/null || true' > "$FILES_FILE"

echo "Sauvegarde DB : $DB_FILE"
echo "Fichiers       : $FILES_FILE"
