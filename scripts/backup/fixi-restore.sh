#!/usr/bin/env bash
# RESTAURATION RÉELLE (en cas de panne) — écrase la base cible. À lancer à la main seulement.
#   ./fixi-restore.sh fixi-db-20261107-0230.dump.gpg postgresql://fixi:mdp@db:5432/fixi
set -Eeuo pipefail
# Les URL Prisma contiennent « ?schema=public », refusé par pg_dump/psql : on le retire.
pgurl() { echo "$1" | sed -E 's/([?&])schema=[^&]*(&|$)/\1/; s/[?&]$//'; }
FILE="${1:?fichier .dump.gpg}"; TARGET="${2:?URL de la base cible}"; : "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE manquant}"
echo "⚠️  La base $TARGET va être REMPLACÉE par $FILE."; read -r -p "Tapez RESTAURER pour continuer : " ok; [ "$ok" = "RESTAURER" ] || exit 1
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
gpg --batch --quiet --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" -o "$TMP" -d "$FILE"
pg_restore --clean --if-exists --no-owner --no-privileges -d "$(pgurl "$TARGET")" "$TMP"
echo "✅ Restauration terminée. Redémarrez l'application."
