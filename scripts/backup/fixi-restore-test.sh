#!/usr/bin/env bash
# Test de restauration : prend la DERNIÈRE sauvegarde, la déchiffre et la restaure dans une base
# temporaire, vérifie qu'on y retrouve des boutiques et des réparations, puis supprime la base.
# Une sauvegarde jamais testée n'est pas une sauvegarde.
# Variables : RESTORE_ADMIN_URL (connexion à un serveur PostgreSQL où créer la base de test,
#             ex. postgresql://postgres:mdp@localhost:5432/postgres), BACKUP_PASSPHRASE,
#             BACKUP_DIR ou BACKUP_REMOTE, APP_URL + CRON_SECRET (compte rendu).
set -Eeuo pipefail
# Les URL Prisma contiennent « ?schema=public », refusé par pg_dump/psql : on le retire.
pgurl() { echo "$1" | sed -E 's/([?&])schema=[^&]*(&|$)/\1/; s/[?&]$//'; }
: "${RESTORE_ADMIN_URL:?RESTORE_ADMIN_URL manquant}"; : "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE manquant}"
RESTORE_ADMIN_URL="$(pgurl "$RESTORE_ADMIN_URL")"
DIR="${BACKUP_DIR:-/backups}"; WORK="$(mktemp -d)"; TESTDB="fixi_restore_test"
report() { [ -n "${APP_URL:-}" ] && [ -n "${CRON_SECRET:-}" ] || return 0
  curl -fsS -m 20 -X POST "$APP_URL/api/system/backup-status" -H "x-cron-secret: $CRON_SECRET" -H 'Content-Type: application/json' -d "{\"kind\":\"$1\",\"message\":\"$2\",\"details\":${3:-{\}}}" >/dev/null || true; }
cleanup() { psql "$RESTORE_ADMIN_URL" -qc "DROP DATABASE IF EXISTS $TESTDB" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap 'report RESTORE_TEST_FAIL "Test de restauration échoué (ligne $LINENO)"; cleanup' ERR
trap cleanup EXIT

if [ -n "${BACKUP_REMOTE:-}" ]; then
  LAST=$(rclone lsf "$BACKUP_REMOTE" --include 'fixi-db-*.dump.gpg' | sort | tail -1)
  [ -n "$LAST" ] || { echo "Aucune sauvegarde distante"; false; }
  rclone copyto "$BACKUP_REMOTE/$LAST" "$WORK/$LAST"; rclone copyto "$BACKUP_REMOTE/$LAST.sha256" "$WORK/$LAST.sha256" || true
else
  LAST=$(ls -1 "$DIR"/fixi-db-*.dump.gpg | sort | tail -1 | xargs -n1 basename)
  cp "$DIR/$LAST" "$WORK/"; cp "$DIR/$LAST.sha256" "$WORK/" 2>/dev/null || true
fi
if [ -f "$WORK/$LAST.sha256" ]; then (cd "$WORK" && sed "s#  .*/#  #" "$LAST.sha256" | sha256sum -c -); fi
gpg --batch --quiet --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" -o "$WORK/db.dump" -d "$WORK/$LAST"

psql "$RESTORE_ADMIN_URL" -qc "DROP DATABASE IF EXISTS $TESTDB" -c "CREATE DATABASE $TESTDB"
TEST_URL="$(echo "$RESTORE_ADMIN_URL" | sed -E "s#/[^/?]+(\?|$)#/$TESTDB\1#")"
pg_restore --no-owner --no-privileges --exit-on-error -d "$TEST_URL" "$WORK/db.dump"
COUNTS=$(psql "$TEST_URL" -At -c 'SELECT (SELECT count(*) FROM "Shop")||'"' '"'||(SELECT count(*) FROM "Repair")||'"' '"'||(SELECT count(*) FROM "Client")||'"' '"'||(SELECT count(*) FROM "Payment")')
read -r SHOPS REPAIRS CLIENTS PAYMENTS <<<"$COUNTS"
[ "${SHOPS:-0}" -gt 0 ] || { echo "Restauration vide (0 boutique)"; false; }
echo "Restauration OK depuis $LAST : $SHOPS boutiques, $REPAIRS réparations, $CLIENTS clients, $PAYMENTS paiements."
report RESTORE_TEST_OK "Restauration testée ($LAST) : $SHOPS boutiques, $REPAIRS réparations, $CLIENTS clients" "{\"file\":\"$LAST\",\"shops\":$SHOPS,\"repairs\":$REPAIRS,\"clients\":$CLIENTS,\"payments\":$PAYMENTS}"
