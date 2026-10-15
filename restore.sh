#!/bin/sh
set -eu
if [ $# -lt 1 ]; then
  echo "Usage: ./restore.sh backups/fixi_YYYYMMDD_HHMMSS.sql.gz [backups/fixi_uploads_....tar.gz]"
  exit 1
fi
DB="$1"; FILES="${2:-}"
[ -f "$DB" ] || { echo "Sauvegarde DB introuvable"; exit 1; }
echo "ATTENTION : cette opération remplace TOUTES les données actuelles de Fixi."
printf "Tapez RESTAURER pour continuer : "; read CONFIRM
[ "$CONFIRM" = "RESTAURER" ] || exit 1

# Ferme les connexions applicatives pendant la restauration pour éviter des écritures concurrentes.
docker compose stop web >/dev/null 2>&1 || true
trap 'docker compose start web >/dev/null 2>&1 || true' EXIT

# Nettoyage explicite du schéma : permet également de restaurer d'anciennes sauvegardes
# qui n'auraient pas été créées avec --clean.
printf 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO fixi; GRANT ALL ON SCHEMA public TO public;\n' \
  | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U fixi -d fixi >/dev/null
gzip -dc "$DB" | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U fixi -d fixi >/dev/null

if [ -n "$FILES" ]; then
  [ -f "$FILES" ] || { echo "Archive de fichiers introuvable: $FILES"; exit 1; }
  docker compose run --rm --no-deps --user root web sh -c 'rm -rf /app/data/uploads && mkdir -p /app/data/uploads' >/dev/null
  cat "$FILES" | docker compose run --rm -T --no-deps --user root web sh -c 'mkdir -p /app/data && tar -xzf - -C /app/data' >/dev/null
fi

docker compose start web >/dev/null
trap - EXIT
echo "Restauration terminée."
