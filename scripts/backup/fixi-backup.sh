#!/usr/bin/env bash
# Sauvegarde Fixi : base PostgreSQL (+ fichiers envoyés si UPLOADS_DIR), chiffrée, copiée hors du serveur.
# Variables :
#   DATABASE_URL        (obligatoire) connexion PostgreSQL
#   BACKUP_PASSPHRASE   (obligatoire) phrase de chiffrement AES-256 — à garder AUSSI ailleurs (coffre, papier)
#   BACKUP_DIR          dossier local (défaut /backups)
#   BACKUP_REMOTE       destination rclone hors serveur, ex. "gdrive:fixi-sauvegardes" ou "b2:fixi-backups"
#   UPLOADS_DIR         dossier des photos/fichiers à inclure (ex. /app-data)
#   KEEP_LOCAL_DAYS     jours gardés sur le serveur (défaut 7) ; KEEP_REMOTE_DAYS (défaut 35)
#   APP_URL + CRON_SECRET   pour signaler le résultat à Fixi (alerte Telegram si échec)
set -Eeuo pipefail
# Les URL Prisma contiennent « ?schema=public », refusé par pg_dump/psql : on le retire.
pgurl() { echo "$1" | sed -E 's/([?&])schema=[^&]*(&|$)/\1/; s/[?&]$//'; }
: "${DATABASE_URL:?DATABASE_URL manquant}"; : "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE manquant}"
DIR="${BACKUP_DIR:-/backups}"; mkdir -p "$DIR"
TS="$(date -u +%Y%m%d-%H%M)"; START=$(date +%s)
report() { # kind message details_json
  [ -n "${APP_URL:-}" ] && [ -n "${CRON_SECRET:-}" ] || return 0
  curl -fsS -m 20 -X POST "$APP_URL/api/system/backup-status" -H "x-cron-secret: $CRON_SECRET" -H 'Content-Type: application/json' \
    -d "{\"kind\":\"$1\",\"message\":\"$2\",\"details\":${3:-{\}}}" >/dev/null || true
}
trap 'report BACKUP_FAIL "Sauvegarde échouée (ligne $LINENO) sur $(hostname)"' ERR

DB_DUMP="$DIR/fixi-db-$TS.dump"
pg_dump --format=custom --no-owner --no-privileges --compress=9 --file="$DB_DUMP" "$(pgurl "$DATABASE_URL")"
FILES=("$DB_DUMP")
if [ -n "${UPLOADS_DIR:-}" ] && [ -d "$UPLOADS_DIR" ]; then
  tar -czf "$DIR/fixi-fichiers-$TS.tgz" -C "$UPLOADS_DIR" . ; FILES+=("$DIR/fixi-fichiers-$TS.tgz")
fi
for f in "${FILES[@]}"; do
  gpg --batch --yes --quiet --pinentry-mode loopback --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" -o "$f.gpg" "$f"
  rm -f "$f"; sha256sum "$f.gpg" > "$f.gpg.sha256"
done
SIZE=$(du -cb "$DIR"/*-"$TS".*.gpg | tail -1 | cut -f1)

if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$DIR" "$BACKUP_REMOTE" --include "*-$TS.*" --retries 5 --low-level-retries 10
  rclone delete "$BACKUP_REMOTE" --min-age "${KEEP_REMOTE_DAYS:-35}d" --include "fixi-*" || true
fi
find "$DIR" -name 'fixi-*' -mtime +"${KEEP_LOCAL_DAYS:-7}" -delete || true

DUR=$(( $(date +%s) - START ))
echo "Sauvegarde $TS terminée : $SIZE octets en ${DUR}s${BACKUP_REMOTE:+, copiée vers $BACKUP_REMOTE}."
report BACKUP_OK "Sauvegarde $TS : $(( SIZE / 1024 )) Ko en ${DUR}s${BACKUP_REMOTE:+ → $BACKUP_REMOTE}" "{\"bytes\":$SIZE,\"seconds\":$DUR,\"stamp\":\"$TS\",\"remote\":\"${BACKUP_REMOTE:-}\"}"
