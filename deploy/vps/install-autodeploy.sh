#!/usr/bin/env bash
# Active les mises à jour automatiques : toutes les 2 minutes, le serveur regarde si GitHub a une nouvelle version
# de la branche « main » et la met en ligne (voir deploy.sh pour les sécurités).
#   ./install-autodeploy.sh            installe
#   ./install-autodeploy.sh --remove   désinstalle
set -euo pipefail
VPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARK="# fixi-autodeploy"
chmod +x "$VPS_DIR"/*.sh

current="$( (crontab -l 2>/dev/null || true) | grep -v "$MARK" || true)"

if [ "${1:-}" = "--remove" ]; then
  printf '%s\n' "$current" | sed '/^$/d' | crontab -
  echo "Mises à jour automatiques désactivées."
  exit 0
fi

command -v git >/dev/null && command -v docker >/dev/null && command -v flock >/dev/null || { echo "git, docker et flock sont requis." >&2; exit 1; }
[ -f "$VPS_DIR/.env" ] || { echo "Créez d'abord le fichier .env (./make-env.sh votre-domaine.tn)." >&2; exit 1; }
git -C "$VPS_DIR" remote get-url origin >/dev/null || { echo "Ce dossier doit venir de « git clone »." >&2; exit 1; }

# La version actuellement en ligne est la version de départ.
mkdir -p "$VPS_DIR/.state"
git -C "$VPS_DIR" rev-parse HEAD > "$VPS_DIR/.state/deployed"

{ printf '%s\n' "$current" | sed '/^$/d'; echo "*/2 * * * * $VPS_DIR/deploy.sh >/dev/null 2>&1 $MARK"; } | crontab -

echo "✅ Mises à jour automatiques activées (toutes les 2 minutes)."
echo "   Voir l'état :        $VPS_DIR/deploy.sh --status"
echo "   Mettre en pause :    touch $VPS_DIR/.state/pause      (reprendre : rm $VPS_DIR/.state/pause)"
echo "   Forcer maintenant :  $VPS_DIR/deploy.sh --force"
